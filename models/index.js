const mongoose = require('mongoose');
const { Schema } = mongoose;

/* ---------------- USERS (Admin + Clients) ---------------- */
const UserSchema = new Schema({
  userId: { type: String, unique: true, index: true },       // login id, e.g. CL-xxxx or admin id
  clientId: { type: String, unique: true, sparse: true, index: true },
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  passwordHash: String,
  pin: String,
  email: { type: String, index: true },
  companyName: String,
  industry: String,
  companySize: String,
  website: String,
  annualRevenue: String,
  fullName: String,
  designation: String,
  phone: String,
  country: String,
  city: String,
  address: String,
  aiInterests: String,
  challenges: String,
  newsletter: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

/* ---------------- BUSINESS SETTINGS (single document) ---------------- */
const SettingsSchema = new Schema({
  businessName: { type: String, default: 'AI Tukaram Consultancy' },
  tagline: { type: String, default: 'Empowering Corporates with World-Class AI Solutions' },
  address: String,
  contactPerson: String,
  contactNumber: String,
  email: String,
  website: String,
  logoBase64: String,   // data URI, replaces Google Drive logo
  qrBase64: String,     // data URI, replaces Google Drive QR
  regNumber: String,
  gstNumber: String,
  licenseNumber: String,
  primaryColor: { type: String, default: '#6366f1' },
  secondaryColor: { type: String, default: '#8b5cf6' },
  accentColor: { type: String, default: '#06b6d4' },
  currencyCode: { type: String, default: 'INR' },
  currencySymbol: { type: String, default: 'â‚¹' },
  country: { type: String, default: 'India' },
}, { timestamps: true });

/* ---------------- PRODUCT CATALOG ---------------- */
const ProductSchema = new Schema({
  code: { type: String, unique: true, index: true },
  name: String,
  category: String,
  description: String,
  mrp: Number,
  priceOneTime: Number,
  priceSubscription: Number,
  active: { type: Boolean, default: true },
}, { timestamps: true });

/* ---------------- DISCOUNTS ---------------- */
const DiscountSchema = new Schema({
  name: String,
  type: { type: String, enum: ['regular', 'manual'], default: 'regular' },
  percentage: Number,
  active: { type: Boolean, default: true },
}, { timestamps: true });

/* ---------------- PURCHASES / SALES ---------------- */
const PurchaseSchema = new Schema({
  saleId: { type: String, unique: true, index: true },
  clientId: { type: String, index: true },
  productCode: String,
  serviceName: String,
  purchaseType: { type: String, enum: ['One-time', 'Subscription'], default: 'One-time' },
  mrp: Number,
  discountAmount: { type: Number, default: 0 },
  amount: Number,
  finalAmount: Number,
  paymentMethod: { type: String, enum: ['Razorpay', 'Manual', 'PayPal'], default: 'Razorpay' },
  paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Failed'], default: 'Pending' },
  razorpayOrderId: String,
  razorpayPaymentId: String,
}, { timestamps: true });

/* ---------------- INVOICES ---------------- */
const InvoiceSchema = new Schema({
  invoiceNumber: { type: String, unique: true, index: true },
  clientId: String,
  saleId: String,
  clientName: String,
  email: String,
  phone: String,
  serviceName: String,
  purchaseType: String,
  amount: Number,
  discountAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  finalAmount: Number,
  paymentMethod: String,
  paymentStatus: { type: String, default: 'Pending' },
  invoiceDate: { type: Date, default: Date.now },
});

/* ---------------- MANUAL PAYMENTS ---------------- */
const ManualPaymentSchema = new Schema({
  clientId: String,
  productCode: String,
  serviceName: String,
  amount: Number,
  proofBase64: String,
  proofMime: String,
  status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
  remark: String,
}, { timestamps: true });

/* ---------------- SUBSCRIPTIONS ---------------- */
const SubscriptionSchema = new Schema({
  clientId: String,
  productCode: String,
  serviceName: String,
  startDate: Date,
  endDate: Date,
  status: { type: String, enum: ['Active', 'Expired', 'Cancelled'], default: 'Active' },
  amount: Number,
});

/* ---------------- NOTIFICATIONS ---------------- */
const NotificationSchema = new Schema({
  clientId: String,
  title: String,
  message: String,
  read: { type: Boolean, default: false },
}, { timestamps: true });

/* ---------------- AI CONSULTANTS / MARKETPLACE ---------------- */
const ConsultantSchema = new Schema({
  name: String,
  email: String,
  phone: String,
  expertise: String,
  active: { type: Boolean, default: true },
});

/* ---------------- PROJECT ASSIGNMENTS ---------------- */
const AssignmentSchema = new Schema({
  assignmentId: { type: String, unique: true },
  clientId: String,
  consultantId: String,
  projectName: String,
  status: { type: String, default: 'Assigned' },
  startDate: Date,
}, { timestamps: true });

/* ---------------- AI MATURITY ASSESSMENT ---------------- */
const MaturityAssessmentSchema = new Schema({
  clientId: String,
  answers: Schema.Types.Mixed,
  scores: Schema.Types.Mixed,
  level: String,
  recommendations: [String],
}, { timestamps: true });

/* ---------------- AI ROI CALCULATIONS ---------------- */
const ROICalculationSchema = new Schema({
  clientId: String,
  input: Schema.Types.Mixed,
  output: Schema.Types.Mixed,
}, { timestamps: true });

/* ---------------- AI USE CASE LIBRARY (mostly static/seed) ---------------- */
const UseCaseSchema = new Schema({
  title: String,
  industry: String,
  description: String,
});

/* ---------------- DATA CONSENTS ---------------- */
const ConsentSchema = new Schema({
  clientId: String,
  consentType: String,
  granted: Boolean,
}, { timestamps: true });

/* ---------------- SERVICE AGREEMENTS ---------------- */
const AgreementSchema = new Schema({
  agreementId: { type: String, unique: true },
  clientId: String,
  title: String,
  fileBase64: String,
  status: { type: String, default: 'Draft' },
}, { timestamps: true });

/* ---------------- PROJECT PROGRESS ---------------- */
const ProgressSchema = new Schema({
  progressId: { type: String, unique: true },
  clientId: String,
  projectName: String,
  stage: String,
  percent: Number,
  notes: String,
}, { timestamps: true });

/* ---------------- MEETINGS ---------------- */
const MeetingSchema = new Schema({
  meetingId: { type: String, unique: true },
  clientId: String,
  title: String,
  date: Date,
  link: String,
  status: { type: String, default: 'Scheduled' },
});

/* ---------------- ONSITE / CORPORATE VISITS ---------------- */
const OnsiteVisitSchema = new Schema({
  visitId: { type: String, unique: true },
  clientId: String,
  date: Date,
  address: String,
  status: { type: String, default: 'Requested' },
  token: String,
});

/* ---------------- SUPPORT TICKETS ---------------- */
const TicketSchema = new Schema({
  ticketId: { type: String, unique: true },
  clientId: String,
  subject: String,
  description: String,
  status: { type: String, default: 'Open' },
  resolution: String,
  assignedTo: String,
  rating: Number,
  feedback: String,
}, { timestamps: true });

/* ---------------- VISITOR LOG ---------------- */
const VisitorLogSchema = new Schema({
  ip: String,
  page: String,
}, { timestamps: true });

/* ---------------- DOCUMENTS (client/service/important) ---------------- */
const DocSchema = new Schema({
  docId: { type: String, unique: true },
  ownerType: { type: String, enum: ['client', 'service', 'important'] },
  ownerId: String,
  filename: String,
  fileBase64: String,
  mime: String,
}, { timestamps: true });

/* ---------------- COMPLIANCE TRACKER ---------------- */
const ComplianceSchema = new Schema({
  complianceId: { type: String, unique: true },
  clientId: String,
  framework: { type: String, enum: ['GDPR', 'EU AI Act', 'ISO 42001'] },
  item: String,
  status: { type: String, default: 'Pending' },
  dueDate: Date,
});

/* ---------------- AUDIT LOG ---------------- */
const AuditLogSchema = new Schema({
  userId: String,
  action: String,
  details: Schema.Types.Mixed,
  ip: String,
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', UserSchema),
  Settings: mongoose.model('Settings', SettingsSchema),
  Product: mongoose.model('Product', ProductSchema),
  Discount: mongoose.model('Discount', DiscountSchema),
  Purchase: mongoose.model('Purchase', PurchaseSchema),
  Invoice: mongoose.model('Invoice', InvoiceSchema),
  ManualPayment: mongoose.model('ManualPayment', ManualPaymentSchema),
  Subscription: mongoose.model('Subscription', SubscriptionSchema),
  Notification: mongoose.model('Notification', NotificationSchema),
  Consultant: mongoose.model('Consultant', ConsultantSchema),
  Assignment: mongoose.model('Assignment', AssignmentSchema),
  MaturityAssessment: mongoose.model('MaturityAssessment', MaturityAssessmentSchema),
  ROICalculation: mongoose.model('ROICalculation', ROICalculationSchema),
  UseCase: mongoose.model('UseCase', UseCaseSchema),
  Consent: mongoose.model('Consent', ConsentSchema),
  Agreement: mongoose.model('Agreement', AgreementSchema),
  Progress: mongoose.model('Progress', ProgressSchema),
  Meeting: mongoose.model('Meeting', MeetingSchema),
  OnsiteVisit: mongoose.model('OnsiteVisit', OnsiteVisitSchema),
  Ticket: mongoose.model('Ticket', TicketSchema),
  VisitorLog: mongoose.model('VisitorLog', VisitorLogSchema),
  Doc: mongoose.model('Doc', DocSchema),
  Compliance: mongoose.model('Compliance', ComplianceSchema),
  AuditLog: mongoose.model('AuditLog', AuditLogSchema),
};
