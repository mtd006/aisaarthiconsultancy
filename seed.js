require('dotenv').config();
const mongoose = require('mongoose');
const { Product, Discount, UseCase } = require('../models');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  if (await Product.countDocuments() === 0) {
    await Product.insertMany([
      { code: 'AI-STRAT-01', name: 'AI Strategy Roadmap', category: 'Strategy', description: 'A 90-day roadmap to identify and prioritize AI opportunities.', mrp: 150000, priceOneTime: 150000, priceSubscription: 25000, active: true },
      { code: 'AI-MAT-01', name: 'AI Maturity Assessment (Guided)', category: 'Assessment', description: 'Expert-guided maturity assessment with a detailed report.', mrp: 50000, priceOneTime: 50000, active: true },
      { code: 'AI-IMPL-01', name: 'AI Pilot Implementation', category: 'Implementation', description: 'End-to-end delivery of one AI pilot use case.', mrp: 400000, priceOneTime: 400000, priceSubscription: 60000, active: true },
    ]);
    console.log('Seeded sample products.');
  }

  if (await Discount.countDocuments() === 0) {
    await Discount.insertMany([
      { name: 'Standard Launch Discount', type: 'regular', percentage: 10, active: true },
      { name: 'Manual Payment Extra Discount', type: 'manual', percentage: 5, active: true },
    ]);
    console.log('Seeded sample discounts.');
  }

  if (await UseCase.countDocuments() === 0) {
    await UseCase.insertMany([
      { title: 'AI-Powered Demand Forecasting', industry: 'Retail', description: 'Use ML models to predict demand and optimize inventory.' },
      { title: 'Intelligent Document Processing', industry: 'Banking', description: 'Automate extraction and validation of data from documents.' },
      { title: 'Predictive Maintenance', industry: 'Manufacturing', description: 'Predict equipment failure before it happens using sensor data.' },
    ]);
    console.log('Seeded sample use cases.');
  }

  console.log('Seed complete.');
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
