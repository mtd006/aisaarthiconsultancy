const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { requireClient } = require('../middleware/auth');
const {
  User, Purchase, Invoice, Subscription, Notification, Ticket, Meeting, OnsiteVisit,
  MaturityAssessment, ROICalculation, UseCase, Consent, Progress, Doc, Product,
} = require('../models');
const { generateUniqueId, logAudit } = require('../utils/helpers');

router.get('/client', requireClient, (req, res) => res.render('client-dashboard', { user: req.session.user }));

const cid = (req) => req.session.user.clientId;

/* ---------- Dashboard stats ---------- */
router.get('/api/client/stats', requireClient, async (req, res) => {
  const [purchases, subs, tickets, notifications] = await Promise.all([
    Purchase.countDocuments({ clientId: cid(req), paymentStatus: 'Paid' }),
    Subscription.countDocuments({ clientId: cid(req), status: 'Active' }),
    Ticket.countDocuments({ clientId: cid(req) }),
    Notification.countDocuments({ clientId: cid(req), read: false }),
  ]);
  res.json({ success: true, stats: { purchases, subs, tickets, unread: notifications } });
});

/* ---------- Catalog (public-to-client browsing) ---------- */
router.get('/api/client/products', requireClient, async (req, res) => {
  res.json({ success: true, products: await Product.find({ active: true }) });
});

/* ---------- Purchases / Subscriptions / Invoices ---------- */
router.get('/api/client/purchases', requireClient, async (req, res) => res.json({ success: true, purchases: await Purchase.find({ clientId: cid(req) }).sort({ createdAt: -1 }) }));
router.get('/api/client/subscriptions', requireClient, async (req, res) => res.json({ success: true, subscriptions: await Subscription.find({ clientId: cid(req) }) }));
router.get('/api/client/invoices', requireClient, async (req, res) => res.json({ success: true, invoices: await Invoice.find({ clientId: cid(req) }).sort({ invoiceDate: -1 }) }));
router.get('/api/client/invoices/:invoiceNumber', requireClient, async (req, res) => {
  const inv = await Invoice.findOne({ invoiceNumber: req.params.invoiceNumber, clientId: cid(req) });
  res.json({ success: !!inv, invoice: inv });
});

/* ---------- Profile ---------- */
router.get('/api/client/profile', requireClient, async (req, res) => {
  const user = await User.findOne({ clientId: cid(req) }).select('-passwordHash -pin');
  res.json({ success: true, profile: user });
});
router.put('/api/client/profile', requireClient, async (req, res) => {
  const allowed = ['companyName', 'industry', 'companySize', 'website', 'fullName', 'designation', 'phone', 'country', 'city', 'address', 'aiInterests', 'challenges'];
  const update = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  const user = await User.findOneAndUpdate({ clientId: cid(req) }, update, { new: true }).select('-passwordHash -pin');
  res.json({ success: true, profile: user });
});
router.put('/api/client/password', requireClient, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.json({ success: false, message: 'Password too short' });
  const hash = await bcrypt.hash(newPassword, 10);
  await User.findOneAndUpdate({ clientId: cid(req) }, { passwordHash: hash });
  res.json({ success: true });
});

/* ---------- Notifications ---------- */
router.get('/api/client/notifications', requireClient, async (req, res) => res.json({ success: true, notifications: await Notification.find({ clientId: cid(req) }).sort({ createdAt: -1 }) }));
router.post('/api/client/notifications/:id/read', requireClient, async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ success: true });
});

/* ---------- Support Tickets ---------- */
router.get('/api/client/tickets', requireClient, async (req, res) => res.json({ success: true, tickets: await Ticket.find({ clientId: cid(req) }).sort({ createdAt: -1 }) }));
router.post('/api/client/tickets', requireClient, async (req, res) => {
  const t = await Ticket.create({ ...req.body, clientId: cid(req), ticketId: generateUniqueId('TKT') });
  res.json({ success: true, ticket: t });
});
router.post('/api/client/tickets/:id/rate', requireClient, async (req, res) => {
  const { rating, feedback } = req.body;
  const t = await Ticket.findOneAndUpdate({ _id: req.params.id, clientId: cid(req) }, { rating, feedback }, { new: true });
  res.json({ success: !!t });
});

/* ---------- Meetings & Onsite Visits ---------- */
router.get('/api/client/meetings', requireClient, async (req, res) => res.json({ success: true, meetings: await Meeting.find({ clientId: cid(req) }).sort({ date: 1 }) }));
router.get('/api/client/visits', requireClient, async (req, res) => res.json({ success: true, visits: await OnsiteVisit.find({ clientId: cid(req) }) }));
router.post('/api/client/visits', requireClient, async (req, res) => {
  const v = await OnsiteVisit.create({ ...req.body, clientId: cid(req), visitId: generateUniqueId('VST'), token: generateUniqueId('TOK') });
  res.json({ success: true, visit: v });
});

/* ---------- AI Maturity Assessment ---------- */
const MATURITY_QUESTIONS = [
  { id: 'q1', text: 'Does your organization have a documented AI strategy?', category: 'Strategy' },
  { id: 'q2', text: 'Is leadership actively sponsoring AI initiatives?', category: 'Leadership' },
  { id: 'q3', text: 'Do you have a centralized, accessible data infrastructure?', category: 'Data' },
  { id: 'q4', text: 'Does your team have in-house AI/ML expertise?', category: 'Talent' },
  { id: 'q5', text: 'Do you have AI governance and ethics policies in place?', category: 'Governance' },
];
router.get('/api/client/maturity/questions', requireClient, (req, res) => res.json({ success: true, questions: MATURITY_QUESTIONS }));
router.post('/api/client/maturity/submit', requireClient, async (req, res) => {
  const { answers } = req.body; // { q1: 0-5, q2: 0-5, ... }
  const values = Object.values(answers || {}).map(Number);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const level = avg >= 4 ? 'Advanced' : avg >= 2.5 ? 'Intermediate' : avg >= 1 ? 'Emerging' : 'Beginner';
  const recommendations = {
    Beginner: ['Start with an AI awareness workshop', 'Identify 1-2 high-impact pilot use cases', 'Establish basic data governance'],
    Emerging: ['Formalize an AI strategy document', 'Invest in data infrastructure', 'Upskill a core team'],
    Intermediate: ['Scale successful pilots', 'Introduce AI governance framework', 'Build cross-functional AI council'],
    Advanced: ['Optimize AI ROI across business units', 'Explore advanced/generative AI use cases', 'Formalize AI ethics & compliance program'],
  }[level];
  const record = await MaturityAssessment.create({ clientId: cid(req), answers, scores: { avg }, level, recommendations });
  res.json({ success: true, result: record });
});
router.get('/api/client/maturity/history', requireClient, async (req, res) => res.json({ success: true, history: await MaturityAssessment.find({ clientId: cid(req) }).sort({ createdAt: -1 }) }));

/* ---------- AI ROI Calculator ---------- */
router.post('/api/client/roi/calculate', requireClient, async (req, res) => {
  const { currentCost, hoursSpentWeekly, hourlyRate, expectedEfficiencyGainPct, implementationCost } = req.body;
  const weeklySavingsHours = (Number(hoursSpentWeekly) || 0) * ((Number(expectedEfficiencyGainPct) || 0) / 100);
  const annualSavings = weeklySavingsHours * (Number(hourlyRate) || 0) * 52;
  const netFirstYear = annualSavings - (Number(implementationCost) || 0) - (Number(currentCost) || 0);
  const roiPct = implementationCost > 0 ? (netFirstYear / Number(implementationCost)) * 100 : null;
  const paybackMonths = annualSavings > 0 ? ((Number(implementationCost) || 0) / (annualSavings / 12)) : null;
  const output = { annualSavings, netFirstYear, roiPct, paybackMonths };
  const record = await ROICalculation.create({ clientId: cid(req), input: req.body, output });
  res.json({ success: true, result: record });
});
router.get('/api/client/roi/history', requireClient, async (req, res) => res.json({ success: true, history: await ROICalculation.find({ clientId: cid(req) }).sort({ createdAt: -1 }) }));

/* ---------- AI Use Case Library ---------- */
router.get('/api/usecases', requireClient, async (req, res) => {
  const { q, industry } = req.query;
  const filter = {};
  if (industry) filter.industry = industry;
  if (q) filter.$or = [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }];
  res.json({ success: true, useCases: await UseCase.find(filter) });
});

/* ---------- Data Consent ---------- */
router.post('/api/client/consent', requireClient, async (req, res) => {
  const c = await Consent.create({ ...req.body, clientId: cid(req) });
  res.json({ success: true, consent: c });
});

/* ---------- Project Progress (read-only for client) ---------- */
router.get('/api/client/progress', requireClient, async (req, res) => res.json({ success: true, progress: await Progress.find({ clientId: cid(req) }).sort({ createdAt: -1 }) }));

/* ---------- Documents ---------- */
router.get('/api/client/docs', requireClient, async (req, res) => res.json({ success: true, docs: await Doc.find({ ownerType: 'client', ownerId: cid(req) }) }));
router.post('/api/client/docs', requireClient, async (req, res) => {
  const { filename, fileBase64, mime } = req.body;
  const d = await Doc.create({ docId: generateUniqueId('DOC'), ownerType: 'client', ownerId: cid(req), filename, fileBase64, mime });
  res.json({ success: true, doc: d });
});

module.exports = router;
