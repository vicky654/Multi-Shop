const mongoose = require('mongoose');

// All granular permissions in the system
const ALL_PERMISSIONS = [
  // Products
  'view_products', 'create_product', 'edit_product', 'delete_product',
  // Sales
  'view_sales', 'create_sale', 'refund_sale',
  // Customers
  'view_customers', 'manage_customers',
  // Expenses
  'view_expenses', 'manage_expenses',
  // Reports
  'view_reports',
  // Users & Staff
  'manage_users',
  // Settings
  'manage_settings',
  // Dashboard
  'view_dashboard',
  // AI Insights
  'view_ai_insights',
];

const roleSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String },
    permissions: [{ type: String, enum: ALL_PERMISSIONS }],
    ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isSystem:    { type: Boolean, default: false }, // built-in roles cannot be deleted
    color:       { type: String, default: '#3b82f6' }, // UI badge color
  },
  { timestamps: true }
);

roleSchema.index({ ownerId: 1 });
roleSchema.index({ ownerId: 1, name: 1 }, { unique: true });

module.exports = {
  Role: mongoose.model('Role', roleSchema),
  ALL_PERMISSIONS,
};
