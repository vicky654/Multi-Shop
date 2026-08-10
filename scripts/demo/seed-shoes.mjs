/**
 * Seeds the "Vicky Shoes" demo store into the ISOLATED demo database.
 *
 * Runs with NODE_ENV=demo so src/config/db.js resolves DEMO_DATABASE_URI and
 * refuses to start unless the database name contains "demo" — production and
 * development data can't be reached from here.
 *
 * All data is fabricated. Credentials come from .env.demo, never hardcoded.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadDemoEnv, ROOT, step, ok, info } from './lib/env.mjs';

const env = loadDemoEnv();
const SERVER = path.join(ROOT, 'server');
const require = createRequire(path.join(SERVER, 'package.json'));

const SIZES = ['6', '7', '8', '9', '10', '11'];
const C = {
  black: { name: 'Black', hex: '#111827' }, white: { name: 'White', hex: '#f9fafb' },
  navy:  { name: 'Navy',  hex: '#1e3a5f' }, tan:   { name: 'Tan',   hex: '#b45309' },
  grey:  { name: 'Grey',  hex: '#6b7280' }, red:   { name: 'Red',   hex: '#dc2626' },
};

/** name, category, price, cost, discount, colors, flags */
const SHOES = [
  ['Aero Runner Pro',        'Running',  4499, 2400, 20, [C.black, C.white, C.red],  { isTrending: true,  isNewArrival: true }],
  ['Aero Runner Lite',       'Running',  3299, 1750, 10, [C.grey, C.navy],           { isTrending: true }],
  ['TrailGrip All-Terrain',  'Running',  5799, 3100, 15, [C.black, C.grey],          { isFeatured: true }],
  ['Court Classic Low',      'Sneakers', 2999, 1500,  0, [C.white, C.navy],          { isFeatured: true }],
  ['Court Classic High',     'Sneakers', 3499, 1800, 12, [C.white, C.black],         { isNewArrival: true }],
  ['Street Canvas Slip-On',  'Sneakers', 1799,  900, 25, [C.black, C.white, C.navy], { isTrending: true }],
  ['Oxford Formal Leather',  'Formal',   6499, 3400, 10, [C.black, C.tan],           { isFeatured: true }],
  ['Derby Office Brogue',    'Formal',   5499, 2900,  0, [C.black, C.tan]],
  ['Loafer Suede Comfort',   'Formal',   4999, 2600, 15, [C.tan, C.navy],            { isNewArrival: true }],
  ['Trek Hiking Boot',       'Boots',    7299, 3900, 18, [C.tan, C.black],           { isFeatured: true }],
  ['Chelsea Ankle Boot',     'Boots',    5999, 3200,  0, [C.black, C.tan]],
  ['Flex Gym Trainer',       'Sports',   3899, 2000, 20, [C.grey, C.red],            { isTrending: true }],
  ['Court Badminton Shoe',   'Sports',   3199, 1650,  5, [C.white, C.navy]],
  ['Cloud Walk Daily',       'Casual',   2499, 1250, 30, [C.grey, C.white],          { isNewArrival: true }],
  ['Beach Slide Comfort',    'Casual',    999,  450,  0, [C.black, C.navy]],
];

const CUSTOMERS = [
  ['Rohit Malhotra', '9812300011'], ['Sneha Kulkarni', '9812300022'],
  ['Imran Qureshi',  '9812300033'], ['Divya Nair',     '9812300044'],
  ['Karan Bhatia',   '9812300055'], ['Ayesha Siddiqui','9812300066'],
  ['Manish Tiwari',  '9812300077'], ['Pooja Deshmukh', '9812300088'],
];

const EXPENSES = [
  ['rent',        45000, 'Shop rent — Camp branch'],
  ['electricity',  6200, 'Monthly electricity bill'],
  ['salary',      72000, 'Staff salaries'],
  ['supplies',    15400, 'Shoe rack fittings'],
  ['other',        9800, 'Local ad campaign'],
  ['supplies',     4300, 'Courier & packaging'],
];

const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

async function main() {
  step(1, 4, `Seeding "Vicky Shoes" into demo database "${env._dbName}"`);

  process.env.NODE_ENV = 'demo';
  process.env.DEMO_DATABASE_URI = env.DEMO_DATABASE_URI;

  const mongoose = require('mongoose');
  const { resolveUri } = require(path.join(SERVER, 'src/config/db.js'));
  const User     = require(path.join(SERVER, 'src/modules/auth/auth.model.js'));
  const Shop     = require(path.join(SERVER, 'src/modules/shops/shop.model.js'));
  const Product  = require(path.join(SERVER, 'src/modules/products/product.model.js'));
  const Customer = require(path.join(SERVER, 'src/modules/customers/customer.model.js'));
  const Expense  = require(path.join(SERVER, 'src/modules/expenses/expense.model.js'));
  const Sale     = require(path.join(SERVER, 'src/modules/sales/sale.model.js'));
  const { Role } = require(path.join(SERVER, 'src/modules/roles/role.model.js'));

  const { uri, mode } = resolveUri();
  if (mode !== 'demo') throw new Error(`Expected demo mode, resolved "${mode}"`);

  // mongodb+srv needs a DNS SRV lookup that fails transiently on flaky networks
  for (let i = 1; i <= 5; i += 1) {
    try { await mongoose.connect(uri); break; }
    catch (e) {
      if (i === 5 || !/querySrv|EREFUSED|ESERVFAIL|ENOTFOUND|timed out/i.test(e.message)) throw e;
      info(`connect attempt ${i} failed — retrying…`);
      await new Promise((r) => setTimeout(r, i * 2500));
    }
  }
  info(`connected to ${mongoose.connection.name}`);

  // ── Wipe (demo database only) ───────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}), Shop.deleteMany({}), Product.deleteMany({}),
    Customer.deleteMany({}), Expense.deleteMany({}), Sale.deleteMany({}), Role.deleteMany({}),
  ]);
  ok('demo database cleared');

  // ── Users (plain-text passwords — the model's pre-save hook hashes them) ─────
  step(2, 4, 'Creating owner, staff and roles');
  const owner = await User.create({
    name: 'Vicky', email: env.DEMO_EMAIL, password: env.DEMO_PASSWORD,
    role: 'owner', phone: '9800000001', isActive: true, onboardingComplete: true,
  });

  const shop = await Shop.create({
    name: 'Vicky Shoes',
    type: 'shoes',
    owner: owner._id,
    address: '24, MG Road, Camp, Pune 411001',
    phone: '020-45678900',
    email: 'hello@vickyshoes.test',
    description: 'Running, formal, sneakers and boots — fitted by people who care.',
    currency: '₹',
    taxRate: 12,
    isActive: true,
    saleBanner: {
      enabled: true, title: 'Monsoon Shoe Sale', subtitle: 'Up to 30% off on running & casual',
      discount: 'Up to 30% OFF', theme: 'blue', endDate: new Date(Date.now() + 6 * 3600000),
    },
    upiSettings: {
      enabled: true, vpa: 'vickyshoes@okaxis',
      merchantName: 'Vicky Shoes', displayName: 'Vicky Shoes — Camp, Pune',
    },
  });
  await User.findByIdAndUpdate(owner._id, { shops: [shop._id] });

  const staff = await User.create([
    { name: 'Ramesh Pawar', email: 'billing.demo@vickyshoes.test', password: env.DEMO_PASSWORD,
      role: 'billing_staff', phone: '9800000002', ownerId: owner._id, shops: [shop._id], isActive: true, onboardingComplete: true },
    { name: 'Anita Joshi',  email: 'manager.demo@vickyshoes.test', password: env.DEMO_PASSWORD,
      role: 'manager', phone: '9800000003', ownerId: owner._id, shops: [shop._id], isActive: true, onboardingComplete: true },
    { name: 'Sunil Kadam',  email: 'stock.demo@vickyshoes.test',   password: env.DEMO_PASSWORD,
      role: 'inventory_staff', phone: '9800000004', ownerId: owner._id, shops: [shop._id], isActive: true, onboardingComplete: true },
  ]);

  await Role.create([
    { name: 'Store Cashier', description: 'Billing + customers', ownerId: owner._id, color: '#3b82f6',
      permissions: ['view_products', 'view_sales', 'create_sale', 'view_customers', 'manage_customers', 'view_dashboard'] },
    { name: 'Floor Manager', description: 'Billing, edits and reports', ownerId: owner._id, color: '#8b5cf6',
      permissions: ['view_products', 'create_product', 'edit_product', 'view_sales', 'create_sale', 'edit_sale',
                    'view_customers', 'manage_customers', 'view_reports', 'view_dashboard'] },
    { name: 'Stock Keeper',  description: 'Inventory only', ownerId: owner._id, color: '#10b981',
      permissions: ['view_products', 'create_product', 'edit_product', 'view_dashboard'] },
  ]);
  ok(`owner + ${staff.length} staff + 3 custom roles`);

  // ── Products with real size/colour variant stock ─────────────────────────────
  step(3, 4, 'Creating shoe catalogue with size/colour variants');
  const products = [];
  for (const [name, category, price, costPrice, discount, colors, flags = {}] of SHOES) {
    const variantStock = [];
    for (const size of SIZES) {
      for (const col of colors) variantStock.push({ size, color: col.name, stock: rand(0, 9) });
    }
    const total = variantStock.reduce((a, v) => a + v.stock, 0);

    products.push(await Product.create({
      name, category, subCategory: 'Footwear',
      price, costPrice, discount,
      stock: total,
      sizes: SIZES, colors,
      trackVariantStock: true, variantStock,
      unit: 'pair', lowStockThreshold: 6,
      hsnCode: '6403', taxType: 'taxable',
      description: `${name} — ${category.toLowerCase()} footwear. Cushioned insole, durable outsole, true to size.`,
      shopId: shop._id, ownerId: owner._id, isActive: true,
      ...flags,
    }));
  }
  ok(`${products.length} shoe products (${SIZES.length} sizes × colours each)`);

  const customers = await Customer.create(CUSTOMERS.map(([name, phone], i) => ({
    name, phone, email: `${name.split(' ')[0].toLowerCase()}.demo@example.test`,
    address: `${rand(1, 90)}, Demo Lane, Pune`,
    shopId: shop._id, ownerId: owner._id,
    creditLimit: i % 3 === 0 ? 5000 : 0,
    isActive: true,
  })));

  await Expense.create(EXPENSES.map(([type, amount, description], i) => ({
    type, amount, description,
    date: daysAgo(i * 5 + 2), shopId: shop._id, ownerId: owner._id, addedBy: owner._id,
  })));
  ok(`${customers.length} customers + ${EXPENSES.length} expenses`);

  // ── Sales history so Dashboard/Reports have something real to show ───────────
  step(4, 4, 'Creating sales history');
  let made = 0;
  for (let d = 45; d >= 0; d -= 1) {
    for (let n = 0; n < rand(1, 4); n += 1) {
      const items = [];
      let total = 0, profit = 0, disc = 0;

      for (let k = 0; k < rand(1, 3); k += 1) {
        const p = pick(products);
        const v = pick(p.variantStock.filter((x) => x.stock > 0)) || p.variantStock[0];
        const qty = rand(1, 2);
        const unit = p.price * (1 - p.discount / 100);
        const sub = +(unit * qty).toFixed(2);
        items.push({
          product: p._id, name: p.name, price: p.price, costPrice: p.costPrice,
          quantity: qty, discount: p.discount, subtotal: sub,
          profit: +((unit - p.costPrice) * qty).toFixed(2),
          selectedSize: v.size, selectedColor: v.color,
          sku: p.sku || '', hsnCode: '6403', unit: 'pair',
        });
        total += sub;
        profit += (unit - p.costPrice) * qty;
        disc += (p.price - unit) * qty;
      }

      const tax = +(total * 0.12).toFixed(2);
      const method = pick(['cash', 'cash', 'upi', 'card', 'credit']);
      const cust = Math.random() > 0.35 ? pick(customers) : null;
      const at = daysAgo(d);

      await Sale.create({
        invoiceNumber: `INV-${String(++made).padStart(5, '0')}-${String(rand(1000, 9999))}`,
        items,
        totalAmount: +(total + tax).toFixed(2),
        totalDiscount: +disc.toFixed(2),
        totalProfit: +profit.toFixed(2),
        taxAmount: tax, taxRate: 12,
        paymentMethod: method,
        paymentStatus: 'paid',
        customerId: cust?._id || null,
        shopId: shop._id, ownerId: owner._id, staffId: pick(staff)._id,
        status: 'completed',
        dueAmount: method === 'credit' ? +(total * 0.4).toFixed(2) : 0,
        createdAt: at, updatedAt: at,
      });
    }
  }
  ok(`${made} historical sales across 45 days`);

  const rev = await Sale.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, t: { $sum: '$totalAmount' } } },
  ]);

  const line = '─'.repeat(72);
  console.log(`\n${line}`);
  console.log('  VICKY SHOES — DEMO STORE READY');
  console.log(line);
  console.log(`  Database   : ${mongoose.connection.name}  (isolated demo)`);
  console.log(`  Shop       : ${shop.name} · shoes · GST ${shop.taxRate}% · slug "${shop.slug}"`);
  console.log(`  UPI QR     : enabled (${shop.upiSettings.vpa})`);
  console.log(`  Products   : ${products.length}  ·  variants: ${products.reduce((a, p) => a + p.variantStock.length, 0)}`);
  console.log(`  Customers  : ${customers.length}   Expenses: ${EXPENSES.length}   Roles: 3   Staff: ${staff.length}`);
  console.log(`  Sales      : ${made}   Revenue: ₹${Math.round(rev[0]?.t || 0).toLocaleString('en-IN')}`);
  console.log(line);
  console.log(`  Login      : ${env.DEMO_EMAIL}`);
  console.log(`  Password   : ${env.DEMO_PASSWORD}`);
  console.log(`  Storefront : /shop/${shop.slug}`);
  console.log(`${line}\n`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(`\n✖ Shoes seed failed: ${e.message}`); process.exit(1); });
