/**
 * ONE-TIME SCRIPT: reset admin login credentials + update business name.
 *
 * Usage:
 *   1. Make sure your .env (or exported env vars) points MONGODB_URI at your
 *      PRODUCTION database (the same one Render uses).
 *   2. Run:  node utils/adminSetup.js
 *   3. Delete this script's sensitive values from your shell history afterwards
 *      if you typed the URI directly on the command line.
 *
 * Safe to run more than once â€” it upserts (updates if exists, creates if not).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Settings } = require('../models');

const NEW_ADMIN_ID = 'ADMIN001';
const NEW_ADMIN_PASSWORD = 'Abc@1234';
const NEW_ADMIN_PIN = '123456';
const NEW_ADMIN_EMAIL = 'admin@aisaarthiconsultancy.com'; // update if you'd like a different one
const NEW_BUSINESS_NAME = 'AI Saarthi Consultancy';

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Set it before running this script.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to database.');

  // ---- Reset / create the admin user ----
  const passwordHash = await bcrypt.hash(NEW_ADMIN_PASSWORD, 10);
  let admin = await User.findOne({ role: 'admin' });

  if (admin) {
    admin.userId = NEW_ADMIN_ID;
    admin.passwordHash = passwordHash;
    admin.pin = NEW_ADMIN_PIN;
    admin.email = NEW_ADMIN_EMAIL;
    admin.status = 'approved';
    await admin.save();
    console.log(`Updated existing admin -> User ID: ${NEW_ADMIN_ID}`);
  } else {
    await User.create({
      userId: NEW_ADMIN_ID,
      role: 'admin',
      passwordHash,
      pin: NEW_ADMIN_PIN,
      email: NEW_ADMIN_EMAIL,
      fullName: 'Administrator',
      status: 'approved',
    });
    console.log(`Created new admin -> User ID: ${NEW_ADMIN_ID}`);
  }

  // ---- Update business name ----
  let settings = await Settings.findOne();
  if (!settings) settings = new Settings({});
  settings.businessName = NEW_BUSINESS_NAME;
  await settings.save();
  console.log(`Business name updated -> "${NEW_BUSINESS_NAME}"`);

  console.log('Done. You can now log in with:');
  console.log(`  User ID:  ${NEW_ADMIN_ID}`);
  console.log(`  Password: ${NEW_ADMIN_PASSWORD}`);
  console.log(`  PIN:      ${NEW_ADMIN_PIN}`);
  console.log('IMPORTANT: change this password again after your first login, from a real admin settings UI, and never commit this script with real values to a public repo.');

  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
