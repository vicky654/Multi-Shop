const mongoose = require('mongoose');

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
    taxRate: { type: Number, default: 0 }, // GST %
    isActive: { type: Boolean, default: true },

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
