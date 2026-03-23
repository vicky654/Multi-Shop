const mongoose = require('mongoose');

const automationSchema = new mongoose.Schema(
  {
    shopId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Shop',  required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },

    name: { type: String, required: true },

    trigger: {
      type: String,
      enum: [
        'NEW_PRODUCT',
        'LOW_STOCK',
        'DUE_PAYMENT',
        'DAILY_SUMMARY',
        'NEW_CUSTOMER',
        'INACTIVE_CUSTOMER',
      ],
      required: true,
    },

    condition: {
      operator: {
        type:    String,
        enum:    ['gt', 'lt', 'gte', 'lte', 'eq'],
        default: 'gt',
      },
      value: { type: Number, default: 0 },
    },

    messageTemplate: { type: String, required: true },

    subject: { type: String },  // for push title

    channel: {
      type:    String,
      enum:    ['whatsapp', 'sms', 'push'],
      default: 'whatsapp',
    },

    enabled: { type: Boolean, default: true },

    // Hour of day to run (0-23) for scheduled triggers
    runHour: {
      type:    Number,
      default: 21,
      min:     0,
      max:     23,
    },

    lastRunAt: { type: Date },
    runCount:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

automationSchema.index({ shopId: 1 });
automationSchema.index({ enabled: 1, trigger: 1 });

module.exports = mongoose.model('Automation', automationSchema);
