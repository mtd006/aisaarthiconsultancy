const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { User, Notification } = require('../models');
const { generateUniqueId, logAudit, sendMail } = require('../utils/helpers');

/* ---------- Pages ---------- */
router.get('/login', (req, res) => res.render('login', { error: null }));
router.get('/register', (req, res) => res.render('register', { error: null }));
router.get('/logout', (req, res) => {
  const uid = req.session.user ? req.session.user.userId : null;
  req.session.destroy(() => {
    if (uid) logAudit(uid, 'LOGOUT', {});
    res.redirect('/login');
  });
});

/* ---------- Login (mirrors loginUser) ---------- */
router.post('/api/login', async (req, res) => {
  try {
    const { userId, password, pin } = req.body;
    const user = await User.findOne({ userId });
    if (!user) return res.json({ success: false, message: 'Invalid User ID' });

    const passOk = await bcrypt.compare(password || '', user.passwordHash || '');
    if (!passOk) return res.json({ success: false, message: 'Invalid password' });

    if (user.role === 'admin' && pin && user.pin && pin !== user.pin) {
      return res.json({ success: false, message: 'Invalid PIN' });
    }
    if (user.role === 'client' && user.status !== 'approved') {
      return res.json({ success: false, message: `Account is ${user.status}. Please wait for admin approval.` });
    }

    req.session.user = {
      userId: user.userId,
      clientId: user.clientId,
      role: user.role,
      fullName: user.fullName || user.companyName || user.userId,
    };
    await logAudit(user.userId, 'LOGIN', {});
    res.json({ success: true, role: user.role, redirect: user.role === 'admin' ? '/admin' : '/client' });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Server error during login' });
  }
});

/* ---------- Register (mirrors registerClient) ---------- */
router.post('/api/register', async (req, res) => {
  try {
    const d = req.body;
    if (!d.email || !d.password || !d.companyName) {
      return res.json({ success: false, message: 'Missing required fields' });
    }
    const exists = await User.findOne({ email: d.email });
    if (exists) return res.json({ success: false, message: 'An account with this email already exists' });

    const clientId = generateUniqueId('CL');
    const userId = clientId;
    const passwordHash = await bcrypt.hash(d.password, 10);

    const user = await User.create({
      userId, clientId, role: 'client', passwordHash,
      email: d.email, companyName: d.companyName, industry: d.industry,
      companySize: d.companySize, website: d.website, annualRevenue: d.annualRevenue,
      fullName: d.fullName, designation: d.designation, phone: d.phone,
      country: d.country, city: d.city, address: d.address,
      aiInterests: d.aiInterests, challenges: d.challenges,
      newsletter: !!d.newsletter, status: 'pending',
    });

    await Notification.create({
      clientId,
      title: 'Welcome!',
      message: 'Your corporate account has been created and is pending admin approval.',
    });

    await sendMail(d.email, 'Welcome to AI Tukaram Consultancy',
      `<p>Hi ${d.fullName || ''},</p><p>Your account (ID: ${userId}) was created and is pending approval.</p>`);

    await logAudit(userId, 'REGISTER', { email: d.email });
    res.json({ success: true, userId });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Registration failed' });
  }
});

/* ---------- Forgot password ---------- */
router.post('/api/forgot-password', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findOne({ userId });
    if (!user) return res.json({ success: false, message: 'User ID not found' });
    // In production: generate a reset token + emailed link instead of this placeholder.
    await sendMail(user.email, 'Password Reset Requested',
      `<p>A password reset was requested for account ${userId}. Please contact support to complete this securely.</p>`);
    res.json({ success: true, message: 'If the account exists, reset instructions were sent by email.' });
  } catch (e) {
    res.json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
