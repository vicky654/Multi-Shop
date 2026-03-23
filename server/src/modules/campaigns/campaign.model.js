const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    name:       { type: String },
    phone:      { type: String },
    status:     { type: String, enum: ['sent', 'failed', 'skipped'], default: 'sent' },
    reason:     { type: String },   // failure/skip reason
  },
  { _id: false }
);

const campaignSchema = new mongoose.Schema(
  {
    shopId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    ownerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    type: {
      type: String,
      enum: [
        'DISCOUNT_OFFER',
        'PAYMENT_REMINDER',
        'ORDER_RECEIPT',
        'CUSTOM_MESSAGE',
        'DAILY_SUMMARY',
        'AUTOMATION',
        'INACTIVITY_REMINDER',
        'LOW_STOCK_ALERT',
        'NEW_PRODUCT_ANNOUNCE',
      ],
      required: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'sms', 'push'],
      required: true,
    },

    // Message
    subject:  { type: String },                       // for push title
    message:  { type: String, required: true },

    // Targeting
    targetType: {
      type: String,
      enum: [
        'all',
        'selected',
        'pending_dues',
        'recent_buyers',
        'inactive',
        'high_spenders',
        'frequent_buyers',
        'new_customers',
      ],
      default: 'all',
    },
    targetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],  // for 'selected'

    // Results
    totalTargeted: { type: Number, default: 0 },
    totalSent:     { type: Number, default: 0 },
    totalFailed:   { type: Number, default: 0 },
    totalSkipped:  { type: Number, default: 0 },

    recipients: [recipientSchema],

    // WhatsApp: list of pre-built wa.me links
    whatsappLinks: [
      {
        name:  String,
        phone: String,
        url:   String,
      },
    ],

    // For DAILY_SUMMARY — snapshot of the day's numbers
    summaryData: {
      totalSales:       { type: Number },
      totalProfit:      { type: Number },
      transactionCount: { type: Number },
      date:             { type: String },
    },

    status: {
      type: String,
      enum: ['pending', 'sent', 'partial', 'failed', 'scheduled', 'cancelled'],
      default: 'pending',
    },
    isDemo: { type: Boolean, default: false },

    // Scheduling
    scheduledFor: { type: Date },
    sentAt:       { type: Date },

    // Automation link
    automationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Automation' },
  },
  { timestamps: true }
);

campaignSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model('Campaign', campaignSchema);
