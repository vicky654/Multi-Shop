const mongoose = require('mongoose');
const { isValidVpa } = require('../../utils/upi');
const { isValidGstin, stateCodeOf } = require('../../utils/gst');

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    type: {
      type: String,
      enum: ['clothes', 'toys', 'shoes', 'gifts', 'electronics', 'grocery', 'other'],
      default: 'other',
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    description: { type: String },
    logo: { type: String },
    banner: { type: String },
    currency: { type: String, default: '₹' },
    taxRate: { type: Number, default: 0 }, // default GST % for this shop

    // ── GST configuration ────────────────────────────────────────────────────
    // gstNumber was already selected by sale.service and rendered on invoices
    // ("GSTIN: {shop.gstNumber}") but did not exist on the schema, so every
    // invoice printed an undefined GSTIN. Added here with real validation.
    gstNumber: {
      type: String, trim: true, uppercase: true, default: '',
      validate: {
        validator: (v) => !v || isValidGstin(v),
        message:   'Invalid GSTIN — must be 15 characters with a valid check digit',
      },
    },
    // 2-digit GSTN state code. Drives CGST+SGST vs IGST. Derived from the GSTIN
    // when present so the two can never disagree.
    stateCode: { type: String, trim: true, default: '' },
    // Whether catalogue prices already include GST.
    gstMode: { type: String, enum: ['exclusive', 'inclusive'], default: 'exclusive' },
    invoicePrefix: { type: String, trim: true, default: 'INV' },
    invoiceRoundOff: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },

    // ── Sale Banner settings ─────────────────────────────────────────────────
    saleBanner: {
      enabled:  { type: Boolean, default: false },
      title:    { type: String,  default: '' },
      subtitle: { type: String,  default: '' },
      discount: { type: String,  default: '' },   // e.g. "20%" or "Flat ₹100 OFF"
      theme:    { type: String,  default: 'blue' }, // blue | orange | green | purple | red
      endDate:  { type: Date },
    },

    // ── UPI QR payment settings ──────────────────────────────────────────────
    // Configured per shop from Settings → Payments. Never hardcoded.
    upiSettings: {
      enabled:      { type: Boolean, default: false },
      vpa:          {                                   // UPI ID / VPA
        type: String,
        trim: true,
        default: '',
        validate: {
          // Allow empty (not yet configured); reject anything malformed.
          validator: (v) => !v || isValidVpa(v),
          message:   'Invalid UPI ID — expected a format like shopname@bank',
        },
      },
      merchantName: { type: String, trim: true, default: '' }, // payee name in the UPI app
      displayName:  { type: String, trim: true, default: '' }, // optional label shown under the QR
    },

    // ── Notification settings ────────────────────────────────────────────────
    notifSettings: {
      ownerWhatsapp:       { type: String },          // WhatsApp number for daily summary
      smsApiKey:           { type: String },          // Fast2SMS API key
      smsSenderId:         { type: String },          // 6-char sender ID (optional)
      dailySummaryEnabled: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Keep stateCode consistent with the GSTIN's embedded state code — a mismatch
// would silently produce the wrong CGST/SGST vs IGST split.
shopSchema.pre('save', function (next) {
  if (this.gstNumber) {
    const code = stateCodeOf(this.gstNumber);
    if (code) this.stateCode = code;
  }
  next();
});

// UPI QR cannot be switched on without a payee to send the money to.
shopSchema.pre('validate', function (next) {
  const upi = this.upiSettings;
  if (upi?.enabled) {
    if (!isValidVpa(upi.vpa)) {
      return next(new Error('A valid UPI ID is required before enabling UPI QR payments'));
    }
    if (!upi.merchantName?.trim()) {
      return next(new Error('Merchant / store name is required before enabling UPI QR payments'));
    }
  }
  next();
});

// Auto-generate unique slug from name on first save
shopSchema.pre('save', async function (next) {
  if (!this.isNew || this.slug) return next();
  const base = this.name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  let slug = base || 'shop';
  let n = 0;
  // eslint-disable-next-line no-await-in-loop
  while (await this.constructor.exists({ slug })) {
    n++;
    slug = `${base}-${n}`;
  }
  this.slug = slug;
  next();
});

module.exports = mongoose.model('Shop', shopSchema);
