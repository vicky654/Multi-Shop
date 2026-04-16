const mongoose = require('mongoose');

/**
 * AutomationLog — immutable record of every ERP automation run.
 *
 * One document per automation execution, stored for 30 days then
 * auto-deleted by the TTL index.
 */
const automationLogSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Shop',
      required: true,
    },
    // Which automation fired (matches ERP_AUTOMATIONS keys)
    type: {
      type: String,
      required: true,
      enum: [
        'LOW_STOCK_ALERT',
        'AUTO_REORDER',
        'DAILY_PROFIT',
        'EXPIRY_ALERT',
        'CUSTOMER_REMINDER',
        'SMART_PRICING',
        'INACTIVE_PRODUCT',
        'AUTO_DISCOUNT',
        'FAST_MOVER',
        'DEAD_STOCK',
      ],
    },
    status:  { type: String, enum: ['success', 'failed', 'skipped'], default: 'success' },
    message: { type: String, required: true },
    // Structured result data (counts, product lists, etc.)
    data:    { type: mongoose.Schema.Types.Mixed, default: {} },
    error:   { type: String },   // error message if status = 'failed'
    // TTL — auto-delete after 30 days
    expiresAt: {
      type:    Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      index:   { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

automationLogSchema.index({ shopId: 1, type: 1, createdAt: -1 });
automationLogSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model('AutomationLog', automationLogSchema);
