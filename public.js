const express = require('express');
const router = express.Router();
const { Product, Settings, Invoice, VisitorLog } = require('../models');

router.get('/', async (req, res) => {
  const [products, settings] = await Promise.all([
    Product.find({ active: true }),
    Settings.findOne(),
  ]);
  VisitorLog.create({ ip: req.ip, page: 'home' }).catch(() => {});
  res.render('sales', { products, business: settings || {}, user: req.session.user || null });
});

/* Public invoice view/print (mirrors InvoiceTemplate.html) */
router.get('/invoice/:invoiceNumber', async (req, res) => {
  const [invoice, business] = await Promise.all([
    Invoice.findOne({ invoiceNumber: req.params.invoiceNumber }),
    Settings.findOne(),
  ]);
  if (!invoice) return res.status(404).send('Invoice not found');
  res.render('invoice', { invoice, business: business || {} });
});

module.exports = router;
