const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['rent', 'electricity', 'salary', 'maintenance', 'supplies', 'other'],
      required: true,
    },
    amount:      { type: Number, required: true, min: 0 },
    date:        { type: Date, required: true, default: Date.now },
    description: { type: String },
    shopId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDemo:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

expenseSchema.index({ shopId: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
