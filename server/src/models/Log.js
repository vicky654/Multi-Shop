const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    index: true,
    sparse: true  // Allow null for global actions
  },
  action: {
    type: String,
    required: true,
    index: true,
    maxlength: 50
  },
  module: {
    type: String,
    required: true,
    maxlength: 30  // auth, products, sales, etc.
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['success', 'error'],
    default: 'success'
  },
  // Impersonation audit — who really performed the action
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
    sparse: true,
  },
  // Which staff was being impersonated (null when acting as self)
  actingAs: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    sparse: true,
  },
  ipAddress: {
    type: String,
    maxlength: 45  // IPv6 support
  },
  userAgent: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true,
  // Limit metadata size in DB
  toJSON: { transform: (doc, ret) => {
    if (ret.metadata) {
      // Keep only safe fields, limit size
      ret.metadata = Object.keys(ret.metadata).reduce((acc, key) => {
        if (typeof ret.metadata[key] === 'string' && ret.metadata[key].length < 1000) {
          acc[key] = ret.metadata[key].substring(0, 500);
        } else if (typeof ret.metadata[key] === 'number' || typeof ret.metadata[key] === 'boolean') {
          acc[key] = ret.metadata[key];
        }
        return acc;
      }, {});
    }
    return ret;
  }}
});

// Compound index for common queries
logSchema.index({ userId: 1, createdAt: -1 });
logSchema.index({ shopId: 1, createdAt: -1 });
logSchema.index({ action: 1, createdAt: -1 });
// TTL — MongoDB automatically deletes log documents older than 90 days
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Log', logSchema);

