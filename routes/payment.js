const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const router = express.Router();
const { requireClient } = require('../middleware/auth1');
const { Product, Purchase, Invoice, ManualPayment, Discount, Notification, Subscription } = require('../models');
const { generateUniqueId, calculateCompleteDiscount, logAudit, sendMail } = require('../utils/helpers');

const razorpay = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'rzp_test_xxxxxxxxxxxx')
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

/* Price preview (mirrors getProductPricePreview) */
router.post('/api/price-preview', requireClient, async (req, res) => {
  try {
    const { productCode, isManualPayment } = req.body;
    const product = await Product.findOne({ code: productCode, active: true });
    if (!product) return res.json({ success: false, message: 'Product not found' });
    const calc = await calculateCompleteDiscount(product.mrp, !!isManualPayment, Discount);
    res.json({ success: true, product, calc });
  } catch (e) {
    res.json({ success: false, message: 'Server error' });
  }
});

/* Create Razorpay order (mirrors processPurchase for the Razorpay path) */
router.post('/api/create-order', requireClient, async (req, res) => {
  try {
    if (!razorpay) return res.json({ success: false, message: 'Razorpay is not configured on the server yet. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.' });
    const { productCode, purchaseType } = req.body;
    const product = await Product.findOne({ code: productCode, active: true });
    if (!product) return res.json({ success: false, message: 'Product not found' });

    const mrp = purchaseType === 'Subscription' ? (product.priceSubscription || product.mrp) : (product.priceOneTime || product.mrp);
    const calc = await calculateCompleteDiscount(mrp, false, Discount);

    const saleId = generateUniqueId('SALE');
    const purchase = await Purchase.create({
      saleId, clientId: req.session.user.clientId, productCode, serviceName: product.name,
      purchaseType, mrp, discountAmount: calc.discountAmount, amount: mrp,
      finalAmount: calc.finalAmount, paymentMethod: 'Razorpay', paymentStatus: 'Pending',
    });

    const order = await razorpay.orders.create({
      amount: Math.round(calc.finalAmount * 100), // paise
      currency: 'INR',
      receipt: saleId,
    });

    purchase.razorpayOrderId = order.id;
    await purchase.save();

    res.json({ success: true, order, saleId, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Could not create order' });
  }
});

/* Verify Razorpay payment signature + finalize (invoice, notification, email) */
router.post('/api/verify-payment', requireClient, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, saleId } = req.body;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body).digest('hex');

    if (expected !== razorpay_signature) {
      return res.json({ success: false, message: 'Payment verification failed' });
    }

    const purchase = await Purchase.findOne({ saleId });
    if (!purchase) return res.json({ success: false, message: 'Purchase not found' });

    purchase.paymentStatus = 'Paid';
    purchase.razorpayPaymentId = razorpay_payment_id;
    await purchase.save();

    const invoiceNumber = generateUniqueId('INV');
    await Invoice.create({
      invoiceNumber, clientId: purchase.clientId, saleId: purchase.saleId,
      serviceName: purchase.serviceName, purchaseType: purchase.purchaseType,
      amount: purchase.amount, discountAmount: purchase.discountAmount,
      finalAmount: purchase.finalAmount, paymentMethod: 'Razorpay', paymentStatus: 'Paid',
    });

    if (purchase.purchaseType === 'Subscription') {
      const start = new Date();
      const end = new Date(); end.setFullYear(end.getFullYear() + 1);
      await Subscription.create({
        clientId: purchase.clientId, productCode: purchase.productCode,
        serviceName: purchase.serviceName, startDate: start, endDate: end,
        status: 'Active', amount: purchase.finalAmount,
      });
    }

    await Notification.create({
      clientId: purchase.clientId, title: 'Payment Successful',
      message: `Your payment for ${purchase.serviceName} was confirmed. Invoice #${invoiceNumber}.`,
    });

    await logAudit(purchase.clientId, 'PAYMENT_SUCCESS', { saleId, invoiceNumber });
    res.json({ success: true, invoiceNumber });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Server error verifying payment' });
  }
});

/* Manual payment (bank transfer / UPI) with proof upload as base64 (mirrors uploadPaymentProof) */
router.post('/api/manual-payment', requireClient, async (req, res) => {
  try {
    const { productCode, purchaseType, proofBase64, proofMime, filename } = req.body;
    const product = await Product.findOne({ code: productCode, active: true });
    if (!product) return res.json({ success: false, message: 'Product not found' });

    const mrp = purchaseType === 'Subscription' ? (product.priceSubscription || product.mrp) : (product.priceOneTime || product.mrp);
    const calc = await calculateCompleteDiscount(mrp, true, Discount);

    const payment = await ManualPayment.create({
      clientId: req.session.user.clientId, productCode, serviceName: product.name,
      amount: calc.finalAmount, proofBase64, proofMime, status: 'Pending',
    });

    await logAudit(req.session.user.clientId, 'MANUAL_PAYMENT_SUBMITTED', { productCode, filename });
    res.json({ success: true, paymentId: payment._id, calc });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Could not submit manual payment' });
  }
});

module.exports = router;
