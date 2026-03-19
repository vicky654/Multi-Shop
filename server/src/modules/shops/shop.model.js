const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
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
    currency: { type: String, default: '₹' },
    taxRate: { type: Number, default: 0 }, // GST %
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Shop', shopSchema);
