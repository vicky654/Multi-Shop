require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User     = require('./src/modules/auth/auth.model');
const Shop     = require('./src/modules/shops/shop.model');
const Product  = require('./src/modules/products/product.model');
const Customer = require('./src/modules/customers/customer.model');
const Expense  = require('./src/modules/expenses/expense.model');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/multi-shop';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Shop.deleteMany({}),
    Product.deleteMany({}),
    Customer.deleteMany({}),
    Expense.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // ── Super Admin ────────────────────────────────────────────────────────────
  const superAdmin = await User.create({
    name: 'Super Admin',
    email: 'admin@multishop.com',
    password: 'admin123',
    role: 'super_admin',
    isActive: true,
  });

  // ── Owner ──────────────────────────────────────────────────────────────────
  const owner = await User.create({
    name: 'Raj Kumar',
    email: 'owner@multishop.com',
    password: 'owner123',
    role: 'owner',
    isActive: true,
  });

  // ── Shops ──────────────────────────────────────────────────────────────────
  const clothesShop = await Shop.create({
    name: 'Fashion Hub',
    type: 'clothes',
    owner: owner._id,
    address: '12 MG Road, Mumbai',
    phone: '9876543210',
    email: 'fashion@hub.com',
    currency: '₹',
    taxRate: 18,
  });

  const toysShop = await Shop.create({
    name: 'Kids World',
    type: 'toys',
    owner: owner._id,
    address: '45 Linking Road, Mumbai',
    phone: '9876543211',
    email: 'kids@world.com',
    currency: '₹',
    taxRate: 12,
  });

  // Update owner's shops
  owner.shops = [clothesShop._id, toysShop._id];
  await owner.save();

  // ── Staff ──────────────────────────────────────────────────────────────────
  const billingStaff = await User.create({
    name: 'Priya Sharma',
    email: 'billing@multishop.com',
    password: 'staff123',
    role: 'billing_staff',
    ownerId: owner._id,
    shops: [clothesShop._id],
    isActive: true,
  });

  const inventoryStaff = await User.create({
    name: 'Amit Patel',
    email: 'inventory@multishop.com',
    password: 'staff123',
    role: 'inventory_staff',
    ownerId: owner._id,
    shops: [clothesShop._id, toysShop._id],
    isActive: true,
  });

  // ── Products — Fashion Hub ─────────────────────────────────────────────────
  const clothesProducts = await Product.insertMany([
    { name: 'Men\'s Cotton T-Shirt', category: 'T-Shirts', price: 599, costPrice: 280, stock: 100, barcode: 'CLT001', shopId: clothesShop._id, ownerId: owner._id, lowStockThreshold: 15 },
    { name: 'Women\'s Kurti', category: 'Ethnic Wear', price: 1299, costPrice: 650, stock: 50, barcode: 'CLT002', shopId: clothesShop._id, ownerId: owner._id, lowStockThreshold: 10 },
    { name: 'Kids Jeans', category: 'Jeans', price: 799, costPrice: 380, stock: 8, barcode: 'CLT003', shopId: clothesShop._id, ownerId: owner._id, lowStockThreshold: 10 },
    { name: 'Formal Shirt', category: 'Shirts', price: 1499, costPrice: 700, stock: 60, barcode: 'CLT004', shopId: clothesShop._id, ownerId: owner._id, lowStockThreshold: 10 },
    { name: 'Sports Tracksuit', category: 'Sportswear', price: 2199, costPrice: 1100, stock: 25, barcode: 'CLT005', shopId: clothesShop._id, ownerId: owner._id, lowStockThreshold: 5 },
  ]);

  // ── Products — Kids World ──────────────────────────────────────────────────
  const toysProducts = await Product.insertMany([
    { name: 'LEGO Classic Set', category: 'Building Blocks', price: 1999, costPrice: 1100, stock: 30, barcode: 'TOY001', shopId: toysShop._id, ownerId: owner._id, lowStockThreshold: 5 },
    { name: 'Remote Control Car', category: 'RC Toys', price: 1499, costPrice: 700, stock: 4, barcode: 'TOY002', shopId: toysShop._id, ownerId: owner._id, lowStockThreshold: 5 },
    { name: 'Barbie Doll Set', category: 'Dolls', price: 899, costPrice: 420, stock: 45, barcode: 'TOY003', shopId: toysShop._id, ownerId: owner._id, lowStockThreshold: 10 },
    { name: 'Board Game (Monopoly)', category: 'Board Games', price: 1199, costPrice: 550, stock: 20, barcode: 'TOY004', shopId: toysShop._id, ownerId: owner._id, lowStockThreshold: 5 },
    { name: 'Art & Craft Kit', category: 'Art Supplies', price: 699, costPrice: 300, stock: 60, barcode: 'TOY005', shopId: toysShop._id, ownerId: owner._id, lowStockThreshold: 10 },
  ]);

  // ── Customers ──────────────────────────────────────────────────────────────
  await Customer.insertMany([
    { name: 'Anjali Mehta', phone: '9123456789', email: 'anjali@example.com', shopId: clothesShop._id, ownerId: owner._id },
    { name: 'Vikram Singh', phone: '9234567890', email: 'vikram@example.com', shopId: clothesShop._id, ownerId: owner._id },
    { name: 'Meena Joshi',  phone: '9345678901', email: 'meena@example.com',  shopId: toysShop._id,    ownerId: owner._id },
    { name: 'Rohan Gupta',  phone: '9456789012', shopId: toysShop._id,        ownerId: owner._id },
  ]);

  // ── Expenses ───────────────────────────────────────────────────────────────
  await Expense.insertMany([
    { type: 'rent',        amount: 25000, date: new Date(), description: 'Monthly rent',        shopId: clothesShop._id, ownerId: owner._id, addedBy: owner._id },
    { type: 'electricity', amount: 3500,  date: new Date(), description: 'Electricity bill',    shopId: clothesShop._id, ownerId: owner._id, addedBy: owner._id },
    { type: 'salary',      amount: 15000, date: new Date(), description: 'Staff salary - Priya', shopId: clothesShop._id, ownerId: owner._id, addedBy: owner._id },
    { type: 'rent',        amount: 18000, date: new Date(), description: 'Monthly rent',        shopId: toysShop._id,    ownerId: owner._id, addedBy: owner._id },
    { type: 'salary',      amount: 12000, date: new Date(), description: 'Staff salary - Amit', shopId: toysShop._id,    ownerId: owner._id, addedBy: owner._id },
  ]);

  console.log('\n✅ Seed complete!\n');
  console.log('═══════════════════════════════════════════');
  console.log('  Accounts:');
  console.log('  Super Admin → admin@multishop.com / admin123');
  console.log('  Owner       → owner@multishop.com / owner123');
  console.log('  Billing     → billing@multishop.com / staff123');
  console.log('  Inventory   → inventory@multishop.com / staff123');
  console.log('═══════════════════════════════════════════\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
