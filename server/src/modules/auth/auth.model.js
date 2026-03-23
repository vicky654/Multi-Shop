const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['super_admin', 'owner', 'manager', 'billing_staff', 'inventory_staff'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'billing_staff',
    },
    // Shops this user has access to
    shops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }],
    // For staff members — the owner they belong to
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    phone:   { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    // Dynamic role override (optional — overrides built-in role permissions)
    customRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    // User preferences
    onboardingComplete: { type: Boolean, default: false },
    // FCM device tokens for push notifications (max 5 per user)
    deviceTokens: [{ type: String }],
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
