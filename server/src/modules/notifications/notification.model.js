const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shopId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['low_stock', 'new_order', 'sale', 'restock', 'ai_insight', 'info', 'warning', 'new_product'],
      default: 'info',
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    link:    { type: String },           // optional deep link
    read:    { type: Boolean, default: false },
    icon:    { type: String },           // emoji / icon name
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
