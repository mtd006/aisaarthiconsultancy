const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth1');
const {
  User, Settings, Product, Discount, Purchase, Invoice, ManualPayment, Subscription,
  Notification, Consultant, Assignment, Progress, Meeting, OnsiteVisit, Ticket,
  Compliance, Doc, VisitorLog, AuditLog,
} = require('../models');
const { generateUniqueId, logAudit, sendMail } = require('../utils/helpers');

router.get('/admin', requireAdmin, (req, res) => res.render('admin-dashboard', { user: req.session.user }));

/* ---------- Dashboard stats (mirrors getAdminDashboardStats) ---------- */
router.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const [clients, pending, sales, invoices, tickets, manualPending] = await Promise.all([
    User.countDocuments({ role: 'client' }),
    User.countDocuments({ role: 'client', status: 'pending' }),
    Purchase.countDocuments({ paymentStatus: 'Paid' }),
    Invoice.find(),
    Ticket.countDocuments({ status: 'Open' }),
    ManualPayment.countDocuments({ status: 'Pending' }),
  ]);
  const revenue = invoices.reduce((s, i) => s + (i.finalAmount || 0), 0);
  res.json({ success: true, stats: { clients, pending, sales, revenue, tickets, manualPending } });
});

/* ---------- Clients ---------- */
router.get('/api/admin/clients', requireAdmin, async (req, res) => {
  const clients = await User.find({ role: 'client' }).sort({ createdAt: -1 });
  res.json({ success: true, clients });
});
router.get('/api/admin/clients/pending', requireAdmin, async (req, res) => {
  const clients = await User.find({ role: 'client', status: 'pending' }).sort({ createdAt: -1 });
  res.json({ success: true, clients });
});
router.post('/api/admin/clients/:id/approve', requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
  if (user) {
    await Notification.create({ clientId: user.clientId, title: 'Account Approved', message: 'Your account has been approved. You can now log in.' });
    await sendMail(user.email, 'Account Approved', '<p>Your account has been approved. You can now log in.</p>');
    await logAudit(req.session.user.userId, 'CLIENT_APPROVE', { clientId: user.clientId });
  }
  res.json({ success: !!user });
});
router.post('/api/admin/clients/:id/reject', requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
  if (user) await logAudit(req.session.user.userId, 'CLIENT_REJECT', { clientId: user.clientId });
  res.json({ success: !!user });
});

/* ---------- Product Catalog ---------- */
router.get('/api/admin/products', requireAdmin, async (req, res) => {
  res.json({ success: true, products: await Product.find().sort({ createdAt: -1 }) });
});
router.post('/api/admin/products', requireAdmin, async (req, res) => {
  const p = await Product.create({ ...req.body, code: req.body.code || generateUniqueId('SVC') });
  await logAudit(req.session.user.userId, 'PRODUCT_ADD', { code: p.code });
  res.json({ success: true, product: p });
});
router.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: !!p, product: p });
});
router.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});
router.post('/api/admin/products/:id/toggle', requireAdmin, async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.json({ success: false });
  p.active = !p.active; await p.save();
  res.json({ success: true, product: p });
});

/* ---------- Discounts ---------- */
router.get('/api/admin/discounts', requireAdmin, async (req, res) => {
  res.json({ success: true, discounts: await Discount.find().sort({ createdAt: -1 }) });
});
router.post('/api/admin/discounts', requireAdmin, async (req, res) => {
  res.json({ success: true, discount: await Discount.create(req.body) });
});
router.delete('/api/admin/discounts/:id', requireAdmin, async (req, res) => {
  await Discount.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ---------- Manual Payments Verification ---------- */
router.get('/api/admin/manual-payments', requireAdmin, async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  res.json({ success: true, payments: await ManualPayment.find(filter).sort({ createdAt: -1 }) });
});
router.post('/api/admin/manual-payments/:id/verify', requireAdmin, async (req, res) => {
  const { status, remark } = req.body; // 'Verified' or 'Rejected'
  const payment = await ManualPayment.findByIdAndUpdate(req.params.id, { status, remark }, { new: true });
  if (!payment) return res.json({ success: false });

  if (status === 'Verified') {
    const invoiceNumber = generateUniqueId('INV');
    await Invoice.create({
      invoiceNumber, clientId: payment.clientId, serviceName: payment.serviceName,
      amount: payment.amount, finalAmount: payment.amount, paymentMethod: 'Manual', paymentStatus: 'Paid',
    });
    await Notification.create({ clientId: payment.clientId, title: 'Payment Verified', message: `Payment for ${payment.serviceName} verified. Invoice #${invoiceNumber}.` });
  } else {
    await Notification.create({ clientId: payment.clientId, title: 'Payment Rejected', message: `Payment proof for ${payment.serviceName} was rejected: ${remark || ''}` });
  }
  await logAudit(req.session.user.userId, 'MANUAL_PAYMENT_VERIFY', { id: req.params.id, status });
  res.json({ success: true, payment });
});

/* ---------- Invoices / Sales ---------- */
router.get('/api/admin/invoices', requireAdmin, async (req, res) => {
  res.json({ success: true, invoices: await Invoice.find().sort({ invoiceDate: -1 }) });
});
router.get('/api/admin/sales', requireAdmin, async (req, res) => {
  res.json({ success: true, sales: await Purchase.find().sort({ createdAt: -1 }) });
});

/* ---------- AI Consultants ---------- */
router.get('/api/admin/consultants', requireAdmin, async (req, res) => res.json({ success: true, consultants: await Consultant.find() }));
router.post('/api/admin/consultants', requireAdmin, async (req, res) => res.json({ success: true, consultant: await Consultant.create(req.body) }));
router.put('/api/admin/consultants/:id', requireAdmin, async (req, res) => res.json({ success: true, consultant: await Consultant.findByIdAndUpdate(req.params.id, req.body, { new: true }) }));
router.delete('/api/admin/consultants/:id', requireAdmin, async (req, res) => { await Consultant.findByIdAndDelete(req.params.id); res.json({ success: true }); });

/* ---------- Project Assignments ---------- */
router.get('/api/admin/assignments', requireAdmin, async (req, res) => res.json({ success: true, assignments: await Assignment.find().sort({ createdAt: -1 }) }));
router.post('/api/admin/assignments', requireAdmin, async (req, res) => {
  const a = await Assignment.create({ ...req.body, assignmentId: generateUniqueId('ASG') });
  res.json({ success: true, assignment: a });
});
router.put('/api/admin/assignments/:id', requireAdmin, async (req, res) => res.json({ success: true, assignment: await Assignment.findByIdAndUpdate(req.params.id, req.body, { new: true }) }));
router.delete('/api/admin/assignments/:id', requireAdmin, async (req, res) => { await Assignment.findByIdAndDelete(req.params.id); res.json({ success: true }); });

/* ---------- Project Progress ---------- */
router.get('/api/admin/progress', requireAdmin, async (req, res) => res.json({ success: true, progress: await Progress.find().sort({ createdAt: -1 }) }));
router.post('/api/admin/progress', requireAdmin, async (req, res) => {
  const p = await Progress.create({ ...req.body, progressId: generateUniqueId('PRG') });
  await Notification.create({ clientId: p.clientId, title: 'Project Update', message: `${p.projectName}: ${p.stage} (${p.percent}%)` });
  res.json({ success: true, progress: p });
});
router.put('/api/admin/progress/:id', requireAdmin, async (req, res) => res.json({ success: true, progress: await Progress.findByIdAndUpdate(req.params.id, req.body, { new: true }) }));
router.delete('/api/admin/progress/:id', requireAdmin, async (req, res) => { await Progress.findByIdAndDelete(req.params.id); res.json({ success: true }); });

/* ---------- Meetings ---------- */
router.get('/api/admin/meetings', requireAdmin, async (req, res) => res.json({ success: true, meetings: await Meeting.find().sort({ date: 1 }) }));
router.post('/api/admin/meetings', requireAdmin, async (req, res) => {
  const m = await Meeting.create({ ...req.body, meetingId: generateUniqueId('MTG') });
  await Notification.create({ clientId: m.clientId, title: 'Meeting Scheduled', message: `${m.title} on ${m.date}` });
  res.json({ success: true, meeting: m });
});
router.put('/api/admin/meetings/:id', requireAdmin, async (req, res) => res.json({ success: true, meeting: await Meeting.findByIdAndUpdate(req.params.id, req.body, { new: true }) }));
router.delete('/api/admin/meetings/:id', requireAdmin, async (req, res) => { await Meeting.findByIdAndDelete(req.params.id); res.json({ success: true }); });

/* ---------- Onsite Visits ---------- */
router.get('/api/admin/visits', requireAdmin, async (req, res) => res.json({ success: true, visits: await OnsiteVisit.find().sort({ date: 1 }) }));
router.put('/api/admin/visits/:id', requireAdmin, async (req, res) => res.json({ success: true, visit: await OnsiteVisit.findByIdAndUpdate(req.params.id, req.body, { new: true }) }));

/* ---------- Support Tickets ---------- */
router.get('/api/admin/tickets', requireAdmin, async (req, res) => res.json({ success: true, tickets: await Ticket.find().sort({ createdAt: -1 }) }));
router.post('/api/admin/tickets/:id/resolve', requireAdmin, async (req, res) => {
  const { resolution, assignedTo } = req.body;
  const t = await Ticket.findByIdAndUpdate(req.params.id, { resolution, assignedTo, status: 'Resolved' }, { new: true });
  if (t) await Notification.create({ clientId: t.clientId, title: 'Ticket Resolved', message: `Your ticket "${t.subject}" was resolved.` });
  res.json({ success: !!t, ticket: t });
});

/* ---------- Compliance Tracker ---------- */
router.get('/api/admin/compliance', requireAdmin, async (req, res) => res.json({ success: true, items: await Compliance.find() }));
router.post('/api/admin/compliance', requireAdmin, async (req, res) => {
  const c = await Compliance.create({ ...req.body, complianceId: generateUniqueId('CMP') });
  res.json({ success: true, item: c });
});
router.put('/api/admin/compliance/:id', requireAdmin, async (req, res) => res.json({ success: true, item: await Compliance.findByIdAndUpdate(req.params.id, req.body, { new: true }) }));

/* ---------- Business Settings / Branding ---------- */
router.get('/api/admin/settings', requireAdmin, async (req, res) => {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  res.json({ success: true, settings: s });
});
router.put('/api/admin/settings', requireAdmin, async (req, res) => {
  let s = await Settings.findOne();
  if (!s) s = new Settings({});
  Object.assign(s, req.body);
  await s.save();
  await logAudit(req.session.user.userId, 'SETTINGS_UPDATE', {});
  res.json({ success: true, settings: s });
});

/* ---------- Admin credentials update (mirrors updateAdminCredentials) ---------- */
router.put('/api/admin/credentials', requireAdmin, async (req, res) => {
  const { newPassword, newPin } = req.body;
  const admin = await User.findOne({ userId: req.session.user.userId, role: 'admin' });
  if (!admin) return res.json({ success: false });
  if (newPassword) admin.passwordHash = await bcrypt.hash(newPassword, 10);
  if (newPin) admin.pin = newPin;
  await admin.save();
  await logAudit(admin.userId, 'ADMIN_CREDENTIALS_CHANGE', {});
  res.json({ success: true });
});

/* ---------- Audit Log ---------- */
router.get('/api/admin/audit-log', requireAdmin, async (req, res) => {
  res.json({ success: true, logs: await AuditLog.find().sort({ createdAt: -1 }).limit(200) });
});

/* ---------- Visitor stats ---------- */
router.get('/api/admin/visitor-stats', requireAdmin, async (req, res) => {
  const total = await VisitorLog.countDocuments();
  res.json({ success: true, total });
});

module.exports = router;
