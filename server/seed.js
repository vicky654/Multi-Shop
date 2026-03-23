/**
 * ══════════════════════════════════════════════════════════════════
 *  MultiShop — Complete Database Seed Script  v3.0
 *  Usage:  node seed.js             (from /server directory)
 *  Flags:  --no-clear               (skip clearing existing data)
 * ══════════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const mongoose = require('mongoose');
// ── Models ────────────────────────────────────────────────────────
const User         = require('./src/modules/auth/auth.model');
const Shop         = require('./src/modules/shops/shop.model');
const Product      = require('./src/modules/products/product.model');
const Sale         = require('./src/modules/sales/sale.model');
const Customer     = require('./src/modules/customers/customer.model');
const Expense      = require('./src/modules/expenses/expense.model');
const { Role }     = require('./src/modules/roles/role.model');
const Notification = require('./src/modules/notifications/notification.model');

// ── Config ────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/multi-shop';
const CLEAR     = !process.argv.includes('--no-clear');

// ── Helpers ───────────────────────────────────────────────────────
const pick    = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const img     = (seed) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/400`;

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000);
}
function randomDateBetween(startDaysAgo, endDaysAgo = 0) {
  const s = daysAgo(startDaysAgo).getTime();
  const e = daysAgo(endDaysAgo).getTime();
  return new Date(s + Math.random() * (e - s));
}

// Global invoice counter per shop prefix (ensures uniqueness)
const _invCounters = {};
function nextInv(prefix) {
  _invCounters[prefix] = (_invCounters[prefix] || 0) + 1;
  return `INV-${prefix}-${String(_invCounters[prefix]).padStart(5, '0')}`;
}

// ── Colour palettes ───────────────────────────────────────────────
const CLOTH_COLORS = [
  { name: 'White',  hex: '#ffffff' }, { name: 'Black',  hex: '#000000' },
  { name: 'Navy',   hex: '#1e3a5f' }, { name: 'Red',    hex: '#ef4444' },
  { name: 'Green',  hex: '#22c55e' }, { name: 'Blue',   hex: '#3b82f6' },
  { name: 'Grey',   hex: '#6b7280' }, { name: 'Yellow', hex: '#fbbf24' },
];
const SHOE_COLORS = [
  { name: 'Black', hex: '#000000' }, { name: 'Brown', hex: '#92400e' },
  { name: 'White', hex: '#ffffff' }, { name: 'Grey',  hex: '#6b7280' },
  { name: 'Tan',   hex: '#d97706' }, { name: 'Blue',  hex: '#3b82f6' },
];
const TOY_COLORS = [
  { name: 'Red',    hex: '#ef4444' }, { name: 'Blue',   hex: '#3b82f6' },
  { name: 'Green',  hex: '#22c55e' }, { name: 'Yellow', hex: '#fbbf24' },
  { name: 'Black',  hex: '#000000' }, { name: 'Pink',   hex: '#ec4899' },
];

// ── Size arrays ───────────────────────────────────────────────────
const ADULT_SIZES  = ['S', 'M', 'L', 'XL', 'XXL'];
const SHOE_SIZES   = ['6', '7', '8', '9', '10', '11'];
const WOMENS_SHOES = ['3', '4', '5', '6', '7', '8'];
const KIDS_SIZES   = ['2Y', '4Y', '6Y', '8Y', '10Y'];
const KIDS_SHOES   = ['1', '2', '3', '4', '5'];

// ── Payment methods (weighted towards cash/upi for realistic data) ─
const PAY_METHODS = ['cash', 'cash', 'cash', 'upi', 'upi', 'card', 'credit'];

// ══════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   MultiShop Database Seed  v3.0          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  await mongoose.connect(MONGO_URI);
  console.log('🔌 Connected to MongoDB\n');

  // ── 1. Clear existing data ──────────────────────────────────────
  if (CLEAR) {
    process.stdout.write('🗑️  Clearing existing data … ');
    await Promise.all([
      User.deleteMany({}),
      Shop.deleteMany({}),
      Product.deleteMany({}),
      Sale.deleteMany({}),
      Customer.deleteMany({}),
      Expense.deleteMany({}),
      Role.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    console.log('done\n');
  }

  // ── 2. Create Users ─────────────────────────────────────────────
  console.log('👥  Creating users …');
  // Pass plain-text passwords — the User model's pre('save') hook hashes them.
  // Never pre-hash here: doing so causes double-hashing (bcrypt of a bcrypt hash),
  // which makes bcrypt.compare() always return false at login.

  // Super Admin — platform-level access
  const superAdmin = await User.create({
    name: 'Super Admin',
    email: 'admin@multishop.com',
    password: 'admin123',
    role: 'super_admin',
    phone: '9999900000',
    isActive: true,
    onboardingComplete: true,
  });

  // Owner — owns all 3 shops
  const owner = await User.create({
    name: 'Ravi Sharma',
    email: 'owner@multishop.com',
    password: 'owner123',
    role: 'owner',
    phone: '9876543200',
    isActive: true,
    onboardingComplete: true,
  });

  // Manager — access to all shops
  const manager = await User.create({
    name: 'Neha Kapoor',
    email: 'manager@multishop.com',
    password: 'manager123',
    role: 'manager',
    phone: '9876543201',
    ownerId: owner._id,
    isActive: true,
    onboardingComplete: true,
  });

  // Billing staff — clothes shop only
  const billingStaff = await User.create({
    name: 'Arjun Mehta',
    email: 'billing@multishop.com',
    password: 'staff123',
    role: 'billing_staff',
    phone: '9876543202',
    ownerId: owner._id,
    isActive: true,
    onboardingComplete: true,
  });

  // Inventory staff — clothes + shoes
  const inventoryStaff = await User.create({
    name: 'Pooja Iyer',
    email: 'inventory@multishop.com',
    password: 'staff123',
    role: 'inventory_staff',
    phone: '9876543203',
    ownerId: owner._id,
    isActive: true,
    onboardingComplete: true,
  });

  console.log('   ✅  5 users created');

  // ── 3. Create Shops ─────────────────────────────────────────────
  console.log('🏪  Creating shops …');

  const clothesShop = await Shop.create({
    name:        'StyleHub Clothing Store',
    type:        'clothes',
    owner:       owner._id,
    address:     '12, Fashion Street, Bandra West, Mumbai 400050',
    phone:       '022-12345678',
    email:       'stylehub@multishop.com',
    description: 'Premium clothing for men, women and kids — all occasions covered.',
    currency:    '₹',
    taxRate:     5,
    isActive:    true,
  });

  const toyShop = await Shop.create({
    name:        'ToyWorld Fun Store',
    type:        'toys',
    owner:       owner._id,
    address:     '45, Play Avenue, Koregaon Park, Pune 411001',
    phone:       '020-87654321',
    email:       'toyworld@multishop.com',
    description: 'Best toys and games for kids of all ages. Learning through play!',
    currency:    '₹',
    taxRate:     12,
    isActive:    true,
  });

  const shoesShop = await Shop.create({
    name:        'StepUp Footwear',
    type:        'shoes',
    owner:       owner._id,
    address:     '78, Sole Street, Indiranagar, Bangalore 560038',
    phone:       '080-11223344',
    email:       'stepup@multishop.com',
    description: 'Quality footwear for every step of life — casual to formal.',
    currency:    '₹',
    taxRate:     5,
    isActive:    true,
  });

  const allShopIds = [clothesShop._id, toyShop._id, shoesShop._id];

  // Assign shops to users
  await User.findByIdAndUpdate(owner._id,         { shops: allShopIds });
  await User.findByIdAndUpdate(manager._id,        { shops: allShopIds });
  await User.findByIdAndUpdate(billingStaff._id,   { shops: [clothesShop._id] });
  await User.findByIdAndUpdate(inventoryStaff._id, { shops: [clothesShop._id, shoesShop._id] });

  console.log('   ✅  3 shops created (StyleHub Clothes · ToyWorld · StepUp Footwear)');

  // ── 4. Custom Roles (owned by owner) ────────────────────────────
  console.log('🔐  Creating custom roles …');
  await Role.insertMany([
    {
      name:        'Senior Manager',
      description: 'Full operational access excluding user management',
      permissions: [
        'view_products','create_product','edit_product',
        'view_sales','create_sale','refund_sale',
        'view_customers','manage_customers',
        'view_expenses','manage_expenses',
        'view_reports','manage_settings','view_dashboard','view_ai_insights',
      ],
      ownerId: owner._id, isSystem: false, color: '#8b5cf6',
    },
    {
      name:        'Cashier',
      description: 'Billing and customer operations only',
      permissions: ['create_sale','view_sales','view_customers','view_dashboard'],
      ownerId: owner._id, isSystem: false, color: '#10b981',
    },
    {
      name:        'Stock Manager',
      description: 'Inventory and product management',
      permissions: ['view_products','create_product','edit_product','delete_product','view_dashboard'],
      ownerId: owner._id, isSystem: false, color: '#f59e0b',
    },
  ]);
  console.log('   ✅  3 custom roles created');

  // ── 5. Products ─────────────────────────────────────────────────
  console.log('📦  Creating products …');

  // ─ StyleHub Clothes (12 items) ───────────────────────────────────
  const clothesProducts = await Product.insertMany([
    {
      name: "Men's Classic White T-Shirt",
      category: 'Clothes', subCategory: 'Mens',
      price: 599, costPrice: 250, discount: 10, stock: 80,
      sizes: ADULT_SIZES, colors: CLOTH_COLORS.slice(0, 5),
      image: img('mens-tshirt-white'), images: [img('mens-tshirt-white'), img('mens-tshirt-alt')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: false, isTrending: true,
      barcode: 'SH-C-001', sku: 'CLT-MEN-001', lowStockThreshold: 10,
    },
    {
      name: "Women's Floral Summer Dress",
      category: 'Clothes', subCategory: 'Womens',
      price: 1499, costPrice: 600, discount: 15, stock: 45,
      sizes: ['XS', ...ADULT_SIZES],
      colors: [{ name:'Pink',hex:'#ec4899' },{ name:'Yellow',hex:'#fbbf24' },{ name:'White',hex:'#ffffff' }],
      image: img('womens-dress-floral'), images: [img('womens-dress-floral')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: true, isTrending: false,
      barcode: 'SH-C-002', sku: 'CLT-WOM-001', lowStockThreshold: 8,
    },
    {
      name: "Kids Cotton Blue Jeans",
      category: 'Clothes', subCategory: 'Kids',
      price: 799, costPrice: 350, discount: 0, stock: 55,
      sizes: KIDS_SIZES,
      colors: [{ name:'Blue',hex:'#3b82f6' },{ name:'Black',hex:'#000000' }],
      image: img('kids-jeans-blue'), images: [img('kids-jeans-blue')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'SH-C-003', sku: 'CLT-KID-001', lowStockThreshold: 10,
    },
    {
      name: "Men's Denim Jacket",
      category: 'Clothes', subCategory: 'Mens',
      price: 2499, costPrice: 1000, discount: 20, stock: 28,
      sizes: ADULT_SIZES,
      colors: [{ name:'Blue',hex:'#3b82f6' },{ name:'Black',hex:'#000000' },{ name:'Grey',hex:'#6b7280' }],
      image: img('denim-jacket-men'), images: [img('denim-jacket-men')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: false, isTrending: true,
      barcode: 'SH-C-004', sku: 'CLT-MEN-002', lowStockThreshold: 5,
    },
    {
      name: "Women's Embroidered Kurta",
      category: 'Clothes', subCategory: 'Womens',
      price: 1299, costPrice: 500, discount: 0, stock: 38,
      sizes: ['S','M','L','XL'],
      colors: [{ name:'Blue',hex:'#3b82f6' },{ name:'Green',hex:'#22c55e' },{ name:'Orange',hex:'#f97316' },{ name:'Red',hex:'#ef4444' }],
      image: img('womens-kurta-embroidered'), images: [img('womens-kurta-embroidered')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: true, isTrending: false,
      barcode: 'SH-C-005', sku: 'CLT-WOM-002', lowStockThreshold: 8,
    },
    {
      name: "Kids Printed T-Shirt",
      category: 'Clothes', subCategory: 'Kids',
      price: 449, costPrice: 180, discount: 5, stock: 70,
      sizes: KIDS_SIZES, colors: CLOTH_COLORS.slice(0, 5),
      image: img('kids-tshirt-printed'), images: [img('kids-tshirt-printed')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'SH-C-006', sku: 'CLT-KID-002', lowStockThreshold: 10,
    },
    {
      name: "Men's Formal Shirt",
      category: 'Clothes', subCategory: 'Mens',
      price: 1199, costPrice: 450, discount: 10, stock: 33,
      sizes: ADULT_SIZES,
      colors: [{ name:'White',hex:'#ffffff' },{ name:'Blue',hex:'#3b82f6' },{ name:'Grey',hex:'#6b7280' }],
      image: img('mens-formal-shirt'), images: [img('mens-formal-shirt')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: false, isTrending: false,
      barcode: 'SH-C-007', sku: 'CLT-MEN-003', lowStockThreshold: 8,
    },
    {
      name: "Women's Banarasi Silk Saree",
      category: 'Clothes', subCategory: 'Womens',
      price: 3499, costPrice: 1500, discount: 0, stock: 18,
      sizes: [],
      colors: [{ name:'Red',hex:'#ef4444' },{ name:'Gold',hex:'#f59e0b' },{ name:'Green',hex:'#22c55e' },{ name:'Purple',hex:'#8b5cf6' }],
      image: img('banarasi-saree'), images: [img('banarasi-saree')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: true, isTrending: true,
      barcode: 'SH-C-008', sku: 'CLT-WOM-003', lowStockThreshold: 4,
    },
    {
      name: "Men's Track Pants",
      category: 'Clothes', subCategory: 'Mens',
      price: 899, costPrice: 350, discount: 0, stock: 52,
      sizes: ADULT_SIZES,
      colors: [{ name:'Black',hex:'#000000' },{ name:'Navy',hex:'#1e3a5f' },{ name:'Grey',hex:'#6b7280' }],
      image: img('track-pants-mens'), images: [img('track-pants-mens')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'SH-C-009', sku: 'CLT-MEN-004', lowStockThreshold: 10,
    },
    {
      name: "Women's Cardigan Sweater",
      category: 'Clothes', subCategory: 'Womens',
      price: 1799, costPrice: 700, discount: 10, stock: 22,
      sizes: ['S','M','L','XL'],
      colors: [{ name:'Beige',hex:'#d4c5a9' },{ name:'Grey',hex:'#6b7280' },{ name:'Pink',hex:'#ec4899' }],
      image: img('womens-cardigan'), images: [img('womens-cardigan')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: true, isTrending: false,
      barcode: 'SH-C-010', sku: 'CLT-WOM-004', lowStockThreshold: 5,
    },
    {
      name: "Kids Hooded Sweatshirt",
      category: 'Clothes', subCategory: 'Kids',
      price: 699, costPrice: 280, discount: 0, stock: 42,
      sizes: KIDS_SIZES,
      colors: [{ name:'Blue',hex:'#3b82f6' },{ name:'Red',hex:'#ef4444' },{ name:'Green',hex:'#22c55e' }],
      image: img('kids-hoodie'), images: [img('kids-hoodie')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'SH-C-011', sku: 'CLT-KID-003', lowStockThreshold: 8,
    },
    {
      name: "Men's Polo T-Shirt",
      category: 'Clothes', subCategory: 'Mens',
      price: 799, costPrice: 300, discount: 5, stock: 48,
      sizes: ADULT_SIZES, colors: CLOTH_COLORS.slice(0, 4),
      image: img('mens-polo-shirt'), images: [img('mens-polo-shirt')],
      shopId: clothesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: true,
      barcode: 'SH-C-012', sku: 'CLT-MEN-005', lowStockThreshold: 10,
    },
  ]);

  // ─ ToyWorld (12 items) ────────────────────────────────────────────
  const toyProducts = await Product.insertMany([
    {
      name: 'Remote Control Racing Car',
      category: 'Toys', subCategory: 'Electronic Toys',
      price: 1299, costPrice: 500, discount: 10, stock: 30,
      sizes: [], colors: TOY_COLORS.slice(0, 3),
      image: img('rc-racing-car'), images: [img('rc-racing-car')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: false, isTrending: true,
      barcode: 'TW-T-001', sku: 'TOY-ELC-001', lowStockThreshold: 5,
    },
    {
      name: 'LEGO Classic Brick Box 500 Pcs',
      category: 'Toys', subCategory: 'Building Toys',
      price: 1999, costPrice: 800, discount: 0, stock: 22,
      sizes: [], colors: [],
      image: img('lego-classic-box'), images: [img('lego-classic-box')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: true, isTrending: true,
      barcode: 'TW-T-002', sku: 'TOY-BLD-001', lowStockThreshold: 5,
    },
    {
      name: 'Giant Plush Teddy Bear 3ft',
      category: 'Toys', subCategory: 'Soft Toys',
      price: 1499, costPrice: 550, discount: 0, stock: 20,
      sizes: [],
      colors: [{ name:'Brown',hex:'#92400e' },{ name:'White',hex:'#ffffff' },{ name:'Pink',hex:'#ec4899' }],
      image: img('teddy-bear-giant'), images: [img('teddy-bear-giant')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: false, isTrending: false,
      barcode: 'TW-T-003', sku: 'TOY-SFT-001', lowStockThreshold: 4,
    },
    {
      name: 'Snakes & Ladders Board Game',
      category: 'Toys', subCategory: 'Board Games',
      price: 399, costPrice: 150, discount: 0, stock: 60,
      sizes: [], colors: [],
      image: img('snakes-ladders-game'), images: [img('snakes-ladders-game')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'TW-T-004', sku: 'TOY-BRD-001', lowStockThreshold: 8,
    },
    {
      name: 'Play-Doh Modelling Clay 24 Colors',
      category: 'Toys', subCategory: 'Art & Craft',
      price: 649, costPrice: 250, discount: 5, stock: 40,
      sizes: [], colors: [],
      image: img('play-doh-set'), images: [img('play-doh-set')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: true, isTrending: false,
      barcode: 'TW-T-005', sku: 'TOY-ART-001', lowStockThreshold: 8,
    },
    {
      name: 'RC Gyroscope Helicopter',
      category: 'Toys', subCategory: 'Electronic Toys',
      price: 2499, costPrice: 1000, discount: 15, stock: 14,
      sizes: [],
      colors: [{ name:'Red',hex:'#ef4444' },{ name:'Black',hex:'#000000' }],
      image: img('rc-helicopter'), images: [img('rc-helicopter')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: false, isTrending: true,
      barcode: 'TW-T-006', sku: 'TOY-ELC-002', lowStockThreshold: 5,
    },
    {
      name: 'Barbie Fashion Doll with Accessories',
      category: 'Toys', subCategory: 'Dolls',
      price: 999, costPrice: 380, discount: 0, stock: 32,
      sizes: [], colors: [],
      image: img('barbie-doll-set'), images: [img('barbie-doll-set')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: true, isTrending: false,
      barcode: 'TW-T-007', sku: 'TOY-DLL-001', lowStockThreshold: 6,
    },
    {
      name: 'Mega Building Blocks 100 Pieces',
      category: 'Toys', subCategory: 'Building Toys',
      price: 549, costPrice: 200, discount: 0, stock: 50,
      sizes: [], colors: TOY_COLORS.slice(0, 4),
      image: img('building-blocks-mega'), images: [img('building-blocks-mega')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'TW-T-008', sku: 'TOY-BLD-002', lowStockThreshold: 8,
    },
    {
      name: '3D Jigsaw Puzzle 500 Pieces',
      category: 'Toys', subCategory: 'Puzzles',
      price: 499, costPrice: 180, discount: 0, stock: 35,
      sizes: [], colors: [],
      image: img('jigsaw-puzzle-3d'), images: [img('jigsaw-puzzle-3d')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'TW-T-009', sku: 'TOY-PZL-001', lowStockThreshold: 6,
    },
    {
      name: 'Super Soaker Water Gun',
      category: 'Toys', subCategory: 'Outdoor Toys',
      price: 349, costPrice: 120, discount: 0, stock: 65,
      sizes: [],
      colors: [{ name:'Blue',hex:'#3b82f6' },{ name:'Green',hex:'#22c55e' },{ name:'Red',hex:'#ef4444' }],
      image: img('super-soaker-gun'), images: [img('super-soaker-gun')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: true,
      barcode: 'TW-T-010', sku: 'TOY-OUT-001', lowStockThreshold: 10,
    },
    {
      name: 'Junior Cricket Bat Set',
      category: 'Toys', subCategory: 'Sports Toys',
      price: 699, costPrice: 260, discount: 10, stock: 25,
      sizes: [], colors: [],
      image: img('cricket-bat-junior'), images: [img('cricket-bat-junior')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'TW-T-011', sku: 'TOY-SPT-001', lowStockThreshold: 5,
    },
    {
      name: 'Crayola Colouring Book + 48 Crayons',
      category: 'Toys', subCategory: 'Art & Craft',
      price: 349, costPrice: 120, discount: 0, stock: 70,
      sizes: [], colors: [],
      image: img('crayola-set'), images: [img('crayola-set')],
      shopId: toyShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: true, isTrending: false,
      barcode: 'TW-T-012', sku: 'TOY-ART-002', lowStockThreshold: 10,
    },
  ]);

  // ─ StepUp Shoes (12 items) ────────────────────────────────────────
  const shoeProducts = await Product.insertMany([
    {
      name: "Men's Air Sports Sneakers",
      category: 'Shoes', subCategory: 'Mens',
      price: 2499, costPrice: 1000, discount: 10, stock: 35,
      sizes: SHOE_SIZES,
      colors: [{ name:'White',hex:'#ffffff' },{ name:'Black',hex:'#000000' },{ name:'Blue',hex:'#3b82f6' },{ name:'Red',hex:'#ef4444' }],
      image: img('mens-air-sneakers'), images: [img('mens-air-sneakers')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: false, isTrending: true,
      barcode: 'SU-S-001', sku: 'SHO-MEN-001', lowStockThreshold: 6,
    },
    {
      name: "Women's Block Heel Pumps",
      category: 'Shoes', subCategory: 'Womens',
      price: 1999, costPrice: 800, discount: 15, stock: 28,
      sizes: WOMENS_SHOES,
      colors: [{ name:'Black',hex:'#000000' },{ name:'Nude',hex:'#e5c9b5' },{ name:'Red',hex:'#ef4444' }],
      image: img('womens-block-heels'), images: [img('womens-block-heels')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: true, isTrending: false,
      barcode: 'SU-S-002', sku: 'SHO-WOM-001', lowStockThreshold: 5,
    },
    {
      name: "Kids Colourful Running Shoes",
      category: 'Shoes', subCategory: 'Kids',
      price: 999, costPrice: 400, discount: 0, stock: 40,
      sizes: KIDS_SHOES,
      colors: [{ name:'Blue',hex:'#3b82f6' },{ name:'Pink',hex:'#ec4899' },{ name:'Green',hex:'#22c55e' }],
      image: img('kids-running-shoes'), images: [img('kids-running-shoes')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'SU-S-003', sku: 'SHO-KID-001', lowStockThreshold: 8,
    },
    {
      name: "Men's Oxford Formal Leather Shoes",
      category: 'Shoes', subCategory: 'Mens',
      price: 3499, costPrice: 1400, discount: 0, stock: 22,
      sizes: SHOE_SIZES,
      colors: [{ name:'Black',hex:'#000000' },{ name:'Brown',hex:'#92400e' },{ name:'Tan',hex:'#d97706' }],
      image: img('oxford-formal-shoes'), images: [img('oxford-formal-shoes')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: false, isTrending: false,
      barcode: 'SU-S-004', sku: 'SHO-MEN-002', lowStockThreshold: 4,
    },
    {
      name: "Women's Casual Ballet Flats",
      category: 'Shoes', subCategory: 'Womens',
      price: 1299, costPrice: 500, discount: 5, stock: 45,
      sizes: WOMENS_SHOES,
      colors: [{ name:'Black',hex:'#000000' },{ name:'Beige',hex:'#d4c5a9' },{ name:'Blue',hex:'#3b82f6' }],
      image: img('ballet-flats-womens'), images: [img('ballet-flats-womens')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: true,
      barcode: 'SU-S-005', sku: 'SHO-WOM-002', lowStockThreshold: 8,
    },
    {
      name: "Men's Classic Brown Loafers",
      category: 'Shoes', subCategory: 'Mens',
      price: 1999, costPrice: 800, discount: 10, stock: 25,
      sizes: SHOE_SIZES,
      colors: [{ name:'Brown',hex:'#92400e' },{ name:'Black',hex:'#000000' }],
      image: img('mens-loafers-brown'), images: [img('mens-loafers-brown')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'SU-S-006', sku: 'SHO-MEN-003', lowStockThreshold: 5,
    },
    {
      name: "Women's Strappy Heeled Sandals",
      category: 'Shoes', subCategory: 'Womens',
      price: 1499, costPrice: 600, discount: 0, stock: 30,
      sizes: WOMENS_SHOES,
      colors: [{ name:'Gold',hex:'#f59e0b' },{ name:'Silver',hex:'#9ca3af' },{ name:'Black',hex:'#000000' }],
      image: img('strappy-heeled-sandals'), images: [img('strappy-heeled-sandals')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: true, isTrending: true,
      barcode: 'SU-S-007', sku: 'SHO-WOM-003', lowStockThreshold: 5,
    },
    {
      name: "Kids Black School Shoes",
      category: 'Shoes', subCategory: 'Kids',
      price: 799, costPrice: 300, discount: 0, stock: 50,
      sizes: KIDS_SHOES,
      colors: [{ name:'Black',hex:'#000000' }],
      image: img('kids-school-shoes'), images: [img('kids-school-shoes')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'SU-S-008', sku: 'SHO-KID-002', lowStockThreshold: 10,
    },
    {
      name: "Men's EVA Flip Flops",
      category: 'Shoes', subCategory: 'Mens',
      price: 449, costPrice: 150, discount: 0, stock: 75,
      sizes: ['7','8','9','10','11'],
      colors: [{ name:'Black',hex:'#000000' },{ name:'Blue',hex:'#3b82f6' },{ name:'Brown',hex:'#92400e' }],
      image: img('eva-flip-flops'), images: [img('eva-flip-flops')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'SU-S-009', sku: 'SHO-MEN-004', lowStockThreshold: 10,
    },
    {
      name: "Unisex Pro Running Shoes",
      category: 'Shoes',
      price: 1799, costPrice: 700, discount: 5, stock: 38,
      sizes: [...SHOE_SIZES, '12'],
      colors: [{ name:'White',hex:'#ffffff' },{ name:'Black',hex:'#000000' },{ name:'Blue',hex:'#3b82f6' },{ name:'Green',hex:'#22c55e' }],
      image: img('pro-running-shoes'), images: [img('pro-running-shoes')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: true, isNewArrival: true, isTrending: true,
      barcode: 'SU-S-010', sku: 'SHO-UNI-001', lowStockThreshold: 8,
    },
    {
      name: "Women's Wedge Platform Sandals",
      category: 'Shoes', subCategory: 'Womens',
      price: 1599, costPrice: 620, discount: 0, stock: 27,
      sizes: WOMENS_SHOES,
      colors: [{ name:'Tan',hex:'#d97706' },{ name:'White',hex:'#ffffff' },{ name:'Black',hex:'#000000' }],
      image: img('wedge-platform-sandals'), images: [img('wedge-platform-sandals')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: false, isTrending: false,
      barcode: 'SU-S-011', sku: 'SHO-WOM-004', lowStockThreshold: 5,
    },
    {
      name: "Kids Canvas Casual Shoes",
      category: 'Shoes', subCategory: 'Kids',
      price: 699, costPrice: 260, discount: 10, stock: 44,
      sizes: KIDS_SHOES,
      colors: [{ name:'White',hex:'#ffffff' },{ name:'Blue',hex:'#3b82f6' },{ name:'Pink',hex:'#ec4899' }],
      image: img('kids-canvas-shoes'), images: [img('kids-canvas-shoes')],
      shopId: shoesShop._id, ownerId: owner._id,
      isFeatured: false, isNewArrival: true, isTrending: false,
      barcode: 'SU-S-012', sku: 'SHO-KID-003', lowStockThreshold: 8,
    },
  ]);

  console.log('   ✅  36 products created (12 per shop)');

  // ── 6. Customers ────────────────────────────────────────────────
  console.log('👤  Creating customers …');

  const mkCustomers = (list, shopId) =>
    list.map((c) => ({ ...c, shopId, ownerId: owner._id, isActive: true }));

  const [clothesCustomers, toyCustomers, shoeCustomers] = await Promise.all([
    Customer.insertMany(mkCustomers([
      { name:'Rahul Sharma',  phone:'9876543210', email:'rahul.sharma@gmail.com',   address:'Bandra West, Mumbai'   },
      { name:'Priya Patel',   phone:'9765432109', email:'priya.patel@gmail.com',    address:'Andheri East, Mumbai'  },
      { name:'Amit Kumar',    phone:'9654321098', email:'amit.kumar@yahoo.com',     address:'Powai, Mumbai'         },
      { name:'Sunita Devi',   phone:'9543210987', email:'sunita.devi@gmail.com',    address:'Borivali, Mumbai'      },
      { name:'Vikram Singh',  phone:'9432109876', email:'vikram.singh@outlook.com', address:'Juhu, Mumbai'          },
      { name:'Meera Joshi',   phone:'9321098765', email:'meera.joshi@gmail.com',    address:'Versova, Mumbai'       },
      { name:'Rajesh Gupta',  phone:'9210987654', email:'rajesh.gupta@hotmail.com', address:'Malad, Mumbai'         },
      { name:'Anita Verma',   phone:'9109876543', email:'anita.verma@gmail.com',    address:'Goregaon, Mumbai'      },
      { name:'Suresh Nair',   phone:'9098765432', email:'suresh.nair@gmail.com',    address:'Chembur, Mumbai'       },
      { name:'Kavya Menon',   phone:'8987654321', email:'kavya.menon@gmail.com',    address:'Thane, Mumbai'         },
    ], clothesShop._id)),
    Customer.insertMany(mkCustomers([
      { name:'Ramesh Kumar',  phone:'8876543210', email:'ramesh.kumar@gmail.com',   address:'Koregaon Park, Pune'   },
      { name:'Geeta Singh',   phone:'8765432109', email:'geeta.singh@gmail.com',    address:'Kothrud, Pune'         },
      { name:'Dinesh Patel',  phone:'8654321098', email:'dinesh.patel@yahoo.com',   address:'Hadapsar, Pune'        },
      { name:'Rekha Gupta',   phone:'8543210987', email:'rekha.gupta@gmail.com',    address:'Wakad, Pune'           },
      { name:'Mahesh Joshi',  phone:'8432109876', email:'mahesh.joshi@gmail.com',   address:'Aundh, Pune'           },
      { name:'Sushma Verma',  phone:'8321098765', email:'sushma.verma@outlook.com', address:'Baner, Pune'           },
      { name:'Anil Deshmukh', phone:'8210987654', email:'anil.deshmukh@gmail.com',  address:'Deccan, Pune'          },
      { name:'Lata Kulkarni', phone:'8109876543', email:'lata.kulkarni@gmail.com',  address:'Shivajinagar, Pune'    },
      { name:'Prakash Rao',   phone:'8098765432', email:'prakash.rao@gmail.com',    address:'Camp, Pune'            },
      { name:'Usha Patil',    phone:'7987654321', email:'usha.patil@gmail.com',     address:'Pimple Saudagar, Pune' },
    ], toyShop._id)),
    Customer.insertMany(mkCustomers([
      { name:'Arjun Nair',    phone:'7876543210', email:'arjun.nair@gmail.com',     address:'Indiranagar, Bangalore'   },
      { name:'Deepa Menon',   phone:'7765432109', email:'deepa.menon@gmail.com',    address:'Koramangala, Bangalore'   },
      { name:'Kiran Rao',     phone:'7654321098', email:'kiran.rao@yahoo.com',      address:'Whitefield, Bangalore'    },
      { name:'Lalitha Iyer',  phone:'7543210987', email:'lalitha.iyer@gmail.com',   address:'HSR Layout, Bangalore'    },
      { name:'Mohan Das',     phone:'7432109876', email:'mohan.das@gmail.com',      address:'JP Nagar, Bangalore'      },
      { name:'Nisha Pillai',  phone:'7321098765', email:'nisha.pillai@outlook.com', address:'Marathahalli, Bangalore'  },
      { name:'Prakash Reddy', phone:'7210987654', email:'prakash.reddy@gmail.com',  address:'BTM Layout, Bangalore'    },
      { name:'Usha Krishnan', phone:'7109876543', email:'usha.krishnan@gmail.com',  address:'Electronic City, Bangalore'},
      { name:'Venkat Suresh', phone:'7098765432', email:'venkat.suresh@gmail.com',  address:'Jayanagar, Bangalore'     },
      { name:'Smitha Bhat',   phone:'6987654321', email:'smitha.bhat@gmail.com',    address:'Banashankari, Bangalore'  },
    ], shoesShop._id)),
  ]);

  console.log('   ✅  30 customers created (10 per shop)');

  // ── 7. Sales ────────────────────────────────────────────────────
  console.log('🧾  Generating sales …');

  /**
   * Build an array of sale documents for insertMany.
   * `todayOnly` forces all dates to today (for dashboard "Today" stats).
   */
  function buildSales(shopId, products, customers, staffId, count, prefix, todayOnly = false) {
    const sales = [];
    for (let i = 0; i < count; i++) {
      // Pick 1–3 unique products per sale
      const numItems = randInt(1, 3);
      const chosen   = [];
      const usedIdx  = new Set();
      while (chosen.length < numItems && chosen.length < products.length) {
        const idx = randInt(0, products.length - 1);
        if (!usedIdx.has(idx)) { usedIdx.add(idx); chosen.push(products[idx]); }
      }

      let totalAmount = 0, totalDiscount = 0, totalProfit = 0;
      const items = chosen.map((p) => {
        const qty        = randInt(1, 3);
        const disc       = p.discount || 0;
        const finalPrice = +(p.price * (1 - disc / 100));
        const subtotal   = +(finalPrice * qty);
        const discAmt    = +(p.price * (disc / 100) * qty);
        const profit     = +((finalPrice - p.costPrice) * qty);
        totalAmount   += subtotal;
        totalDiscount += discAmt;
        totalProfit   += profit;
        return {
          product:       p._id,
          name:          p.name,
          price:         p.price,
          costPrice:     p.costPrice,
          quantity:      qty,
          discount:      disc,
          subtotal:      +subtotal.toFixed(2),
          profit:        +profit.toFixed(2),
          selectedSize:  (p.sizes  || []).length ? pick(p.sizes)         : '',
          selectedColor: (p.colors || []).length ? pick(p.colors).name   : '',
        };
      });

      const date = todayOnly ? new Date() : randomDateBetween(60, 1);
      sales.push({
        invoiceNumber: nextInv(prefix),
        items,
        totalAmount:   +totalAmount.toFixed(2),
        totalDiscount: +totalDiscount.toFixed(2),
        totalProfit:   +totalProfit.toFixed(2),
        paymentMethod: pick(PAY_METHODS),
        customerId:    pick(customers)._id,
        shopId,
        ownerId:       owner._id,
        staffId,
        notes:         '',
        taxRate:       0,
        taxAmount:     0,
        status:        'completed',
        createdAt:     date,
        updatedAt:     date,
      });
    }
    return sales;
  }

  const allSalesDocs = [
    // Historical sales (last 60 days)
    ...buildSales(clothesShop._id, clothesProducts, clothesCustomers, billingStaff._id, 50, 'STY'),
    ...buildSales(toyShop._id,     toyProducts,     toyCustomers,     manager._id,      45, 'TOY'),
    ...buildSales(shoesShop._id,   shoeProducts,    shoeCustomers,    manager._id,      48, 'STP'),
    // Today's sales (so Dashboard "Today" counter is non-zero)
    ...buildSales(clothesShop._id, clothesProducts, clothesCustomers, billingStaff._id, 4, 'STY', true),
    ...buildSales(toyShop._id,     toyProducts,     toyCustomers,     manager._id,      3, 'TOY', true),
    ...buildSales(shoesShop._id,   shoeProducts,    shoeCustomers,    manager._id,      3, 'STP', true),
  ];

  await Sale.insertMany(allSalesDocs, { ordered: false });
  console.log(`   ✅  ${allSalesDocs.length} sales created (historical + today's)`);

  // Update customer spending totals (best-effort)
  try {
    const saleAgg = await Sale.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$customerId', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    await Promise.all(
      saleAgg.map(({ _id, total, count }) =>
        Customer.findByIdAndUpdate(_id, { totalSpent: +total.toFixed(2), totalPurchases: count })
      )
    );
  } catch { /* non-critical */ }

  // ── 8. Expenses ─────────────────────────────────────────────────
  console.log('💸  Creating expenses …');

  const makeExpenses = (shopId) => {
    const rows = [];
    // 3 months of recurring expenses
    for (let m = 0; m < 3; m++) {
      const offset = m * 30;
      rows.push(
        { type:'rent',        amount:45000, date:daysAgo(offset+1),  description:'Monthly shop rent',            shopId, ownerId:owner._id, addedBy:owner._id   },
        { type:'electricity', amount:8500,  date:daysAgo(offset+3),  description:'Electricity bill',             shopId, ownerId:owner._id, addedBy:manager._id },
        { type:'salary',      amount:35000, date:daysAgo(offset+5),  description:'Staff salaries',               shopId, ownerId:owner._id, addedBy:owner._id   },
        { type:'supplies',    amount:4500,  date:daysAgo(offset+7),  description:'Packaging & stationery',       shopId, ownerId:owner._id, addedBy:manager._id },
      );
    }
    // One-off maintenance
    rows.push({ type:'maintenance', amount:12000, date:daysAgo(45), description:'AC servicing & shop repairs', shopId, ownerId:owner._id, addedBy:owner._id });
    return rows;
  };

  await Expense.insertMany([
    ...makeExpenses(clothesShop._id),
    ...makeExpenses(toyShop._id),
    ...makeExpenses(shoesShop._id),
  ]);
  console.log('   ✅  39 expense records created (13 per shop × 3 months)');

  // ── 9. Notifications ────────────────────────────────────────────
  console.log('🔔  Creating notifications …');
  await Notification.insertMany([
    {
      userId:owner._id, shopId:clothesShop._id, ownerId:owner._id,
      type:'low_stock', title:'Low Stock Alert',
      message:"Women's Banarasi Silk Saree is running low — only 18 units left.",
      link:'/inventory', read:false,
      createdAt:daysAgo(1), updatedAt:daysAgo(1),
    },
    {
      userId:owner._id, shopId:toyShop._id, ownerId:owner._id,
      type:'low_stock', title:'Low Stock Alert',
      message:'RC Gyroscope Helicopter — only 14 units remain. Consider restocking.',
      link:'/inventory', read:false,
      createdAt:daysAgo(2), updatedAt:daysAgo(2),
    },
    {
      userId:owner._id, shopId:clothesShop._id, ownerId:owner._id,
      type:'sale', title:'Daily Sales Summary',
      message:'StyleHub generated ₹12,450 in revenue today across 4 transactions.',
      link:'/dashboard', read:false,
      createdAt:daysAgo(0), updatedAt:daysAgo(0),
    },
    {
      userId:manager._id, shopId:toyShop._id, ownerId:owner._id,
      type:'new_order', title:'New Online Order',
      message:'A new online order has been placed at ToyWorld. Review and process.',
      link:'/billing', read:false,
      createdAt:daysAgo(0), updatedAt:daysAgo(0),
    },
    {
      userId:owner._id, shopId:clothesShop._id, ownerId:owner._id,
      type:'ai_insight', title:'AI Recommendation',
      message:"Men's Classic White T-Shirt is your fastest-moving product this week. Maintain stock levels.",
      link:'/ai-insights', read:false,
      createdAt:daysAgo(1), updatedAt:daysAgo(1),
    },
    {
      userId:owner._id, shopId:shoesShop._id, ownerId:owner._id,
      type:'ai_insight', title:'Discount Suggestion',
      message:"Women's Wedge Platform Sandals haven't sold in 15 days. A 20% discount could boost sales.",
      link:'/ai-insights', read:true,
      createdAt:daysAgo(3), updatedAt:daysAgo(3),
    },
    {
      userId:owner._id, shopId:clothesShop._id, ownerId:owner._id,
      type:'info', title:'Welcome to MultiShop v3!',
      message:'Your system has been upgraded with AI Insights, real-time Notifications, and a Customer Shop UI.',
      link:'/dashboard', read:true,
      createdAt:daysAgo(7), updatedAt:daysAgo(7),
    },
    {
      userId:manager._id, shopId:clothesShop._id, ownerId:owner._id,
      type:'restock', title:'Restock Reminder',
      message:"Men's Denim Jacket stock at 28 — AI suggests ordering 20 more units soon.",
      link:'/inventory', read:false,
      createdAt:daysAgo(2), updatedAt:daysAgo(2),
    },
  ]);
  console.log('   ✅  8 notifications created');

  // ── 10. Final Summary ────────────────────────────────────────────
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                  🔐  DEMO LOGIN CREDENTIALS                             ║');
  console.log('╠══════════════════════╦══════════════════════════════╦═══════════════╣');
  console.log('║  Role                ║  Email                       ║  Password     ║');
  console.log('╠══════════════════════╬══════════════════════════════╬═══════════════╣');
  console.log('║  super_admin         ║  admin@multishop.com         ║  admin123     ║');
  console.log('║  owner               ║  owner@multishop.com         ║  owner123     ║');
  console.log('║  manager             ║  manager@multishop.com       ║  manager123   ║');
  console.log('║  billing_staff       ║  billing@multishop.com       ║  staff123     ║');
  console.log('║  inventory_staff     ║  inventory@multishop.com     ║  staff123     ║');
  console.log('╚══════════════════════╩══════════════════════════════╩═══════════════╝');
  console.log('\n📊  DATA SUMMARY');
  console.log('   Shops     : 3   (StyleHub Clothes · ToyWorld · StepUp Footwear)');
  console.log('   Products  : 36  (12 per shop — sizes, colours, images included)');
  console.log('   Customers : 30  (10 per shop with phone + email)');
  console.log(`   Sales     : ${allSalesDocs.length}  (last 60 days + today's transactions)`);
  console.log('   Expenses  : 39  (rent, electricity, salary, supplies × 3 months)');
  console.log('   Roles     : 3   (Senior Manager · Cashier · Stock Manager)');
  console.log('   Notifs    : 8   (low-stock · sales · AI insights · info)');
  console.log('\n🚀  Seed complete!  Run: npm run dev\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
