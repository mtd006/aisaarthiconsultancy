const nodemailer = require('nodemailer');
const { AuditLog } = require('../models');

function generateUniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/* Mirrors calculateCompleteDiscount() from the original Apps Script:
   regular discount always applies; an extra "manual payment" discount
   applies only when paying via bank transfer / manual proof upload. */
async function calculateCompleteDiscount(mrp, isManualPayment, Discount) {
  const regular = await Discount.findOne({ type: 'regular', active: true }).sort({ createdAt: -1 });
  const manual = await Discount.findOne({ type: 'manual', active: true }).sort({ createdAt: -1 });

  const regularPct = regular ? regular.percentage : 0;
  const afterRegular = mrp - (mrp * regularPct) / 100;

  let manualPct = 0;
  let afterManual = afterRegular;
  if (isManualPayment && manual) {
    manualPct = manual.percentage;
    afterManual = afterRegular - (afterRegular * manualPct) / 100;
  }

  const discountAmount = mrp - afterManual;
  return {
    mrp,
    regularPct,
    manualPct,
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalAmount: Math.round(afterManual * 100) / 100,
  };
}

async function logAudit(userId, action, details, ip) {
  try {
    await AuditLog.create({ userId: userId || 'SYSTEM', action, details: details || {}, ip: ip || '' });
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

function getMailer() {
  if (!process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendMail(to, subject, html) {
  const transporter = getMailer();
  if (!transporter) {
    console.log(`[email skipped - SMTP not configured] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
  } catch (e) {
    console.error('Email send error:', e.message);
  }
}

module.exports = { generateUniqueId, calculateCompleteDiscount, logAudit, sendMail };
