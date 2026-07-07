require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const bcrypt = require('bcryptjs');

const { User, Settings } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Add it to your .env file or Render environment variables.');
  process.exit(1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json({ limit: '15mb' })); // higher limit to allow base64 file uploads
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'insecure_dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 8, secure: process.env.NODE_ENV === 'production' }, // 8 hours
}));

// Make logged-in user available to all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

app.use('/', require('./routes/public'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/admin'));
app.use('/', require('./routes/client'));
app.use('/', require('./routes/payment'));

app.use((req, res) => res.status(404).send('Page not found'));

async function seedDefaults() {
  const settingsCount = await Settings.countDocuments();
  if (settingsCount === 0) {
    await Settings.create({}); // creates with schema defaults
    console.log('Seeded default BusinessSettings.');
  }

  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe_Now!2026', 10);
    await User.create({
      userId: process.env.DEFAULT_ADMIN_ID || 'AITC001',
      role: 'admin',
      passwordHash,
      pin: process.env.DEFAULT_ADMIN_PIN || '202601',
      email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@aitukaram.consulting',
      fullName: 'Administrator',
      status: 'approved',
    });
    console.log('Seeded default admin user from environment variables. Change the password after first login!');
  }
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected.');
    await seedDefaults();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
