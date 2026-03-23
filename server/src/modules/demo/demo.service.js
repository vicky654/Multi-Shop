/**
 * demo.service.js — Faker.js powered demo data generator
 *
 * Generates realistic, chart-ready POS data for a given shop:
 *   - ~30 products across 6 categories (with variants)
 *   - 30 customers with Indian phone numbers
 *   - ~200 sales spread over the last 30 days
 *   - 15 operational expenses
 *
 * Uses Sale.collection.insertMany() (bypasses pre-save hooks) so that
 * we can back-date createdAt for realistic chart curves.
 */

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');

const Product  = require('../products/product.model');
const Customer = require('../customers/customer.model');
const Sale     = require('../sales/sale.model');
const Expense  = require('../expenses/expense.model');

// ── Indian mobile number ──────────────────────────────────────────────────────

const indianPhone = () =>
  faker.helpers.arrayElement(['9', '8', '7', '6']) + faker.string.numeric(9);

// ── Helpers ───────────────────────────────────────────────────────────────────

const round2 = (n) => Math.round(n * 100) / 100;

// ── Product catalogue ─────────────────────────────────────────────────────────

const CATALOGUE = [
  {
    cat: 'Clothing', subs: ['Mens', 'Womens', 'Kids'],
    items: [
      { base: 'Slim Fit T-Shirt',   priceRange: [349, 799],   costMul: 0.38 },
      { base: 'Straight Jeans',     priceRange: [999, 1799],  costMul: 0.45 },
      { base: 'Floral Kurta',       priceRange: [599, 1099],  costMul: 0.40 },
      { base: 'Hooded Sweatshirt',  priceRange: [799, 1499],  costMul: 0.42 },
      { base: 'Track Pants',        priceRange: [499, 899],   costMul: 0.35 },
    ],
  },
  {
    cat: 'Footwear', subs: ['Mens', 'Womens', 'Unisex'],
    items: [
      { base: 'Canvas Sneakers',   priceRange: [799, 1599],  costMul: 0.50 },
      { base: 'Leather Loafers',   priceRange: [1499, 2999], costMul: 0.52 },
      { base: 'Sports Shoes',      priceRange: [999, 1999],  costMul: 0.48 },
      { base: 'Slip-On Sandals',   priceRange: [399, 799],   costMul: 0.40 },
    ],
  },
  {
    cat: 'Electronics', subs: ['Audio', 'Mobile', 'Accessories'],
    items: [
      { base: 'Wireless Earbuds',  priceRange: [1299, 3999], costMul: 0.55 },
      { base: 'Phone Case',        priceRange: [199, 699],   costMul: 0.30 },
      { base: 'Portable Charger',  priceRange: [899, 1999],  costMul: 0.52 },
      { base: 'Bluetooth Speaker', priceRange: [1499, 3499], costMul: 0.55 },
    ],
  },
  {
    cat: 'Accessories', subs: ['Bags', 'Watches', 'Fashion'],
    items: [
      { base: 'Leather Wallet',    priceRange: [499, 999],   costMul: 0.45 },
      { base: 'Analog Watch',      priceRange: [999, 2499],  costMul: 0.50 },
      { base: 'Canvas Backpack',   priceRange: [799, 1799],  costMul: 0.48 },
      { base: 'Sunglasses',        priceRange: [399, 1299],  costMul: 0.40 },
    ],
  },
  {
    cat: 'Home', subs: ['Kitchen', 'Decor', 'Storage'],
    items: [
      { base: 'Insulated Bottle',  priceRange: [349, 799],   costMul: 0.40 },
      { base: 'Scented Candle Set',priceRange: [299, 699],   costMul: 0.35 },
      { base: 'Organiser Basket',  priceRange: [499, 999],   costMul: 0.42 },
    ],
  },
  {
    cat: 'Kids', subs: ['Toys', 'Clothing', 'Stationery'],
    items: [
      { base: 'Building Blocks Set', priceRange: [499, 1499], costMul: 0.45 },
      { base: 'Drawing Kit',         priceRange: [299, 799],  costMul: 0.38 },
      { base: 'Plush Toy',           priceRange: [399, 999],  costMul: 0.40 },
    ],
  },
];

const COLOUR_POOL = [
  { name: 'Black',  hex: '#111827' },
  { name: 'White',  hex: '#f9fafb' },
  { name: 'Navy',   hex: '#1e3a5f' },
  { name: 'Red',    hex: '#ef4444' },
  { name: 'Blue',   hex: '#3b82f6' },
  { name: 'Green',  hex: '#22c55e' },
  { name: 'Pink',   hex: '#ec4899' },
];

const LABELS = ['Premium', 'Classic', 'Pro', 'Lite', 'Original', 'Essential'];

// ── Builders ──────────────────────────────────────────────────────────────────

function buildProducts(shopId, ownerId) {
  const docs = [];
  for (const { cat, subs, items } of CATALOGUE) {
    for (const { base, priceRange: [lo, hi], costMul } of items) {
      const price     = faker.number.int({ min: lo, max: hi });
      const costPrice = round2(price * costMul * faker.number.float({ min: 0.85, max: 1.05 }));
      const discount  = faker.helpers.arrayElement([0, 0, 0, 5, 10, 15]);

      docs.push({
        name:        `${base} — ${faker.helpers.arrayElement(LABELS)}`,
        category:    cat,
        subCategory: faker.helpers.arrayElement(subs),
        price,
        costPrice,
        discount,
        stock:        faker.number.int({ min: 8, max: 150 }),
        unit:         cat === 'Footwear' ? 'pair' : 'pcs',
        sizes:        cat === 'Clothing'
          ? faker.helpers.arrayElements(['XS', 'S', 'M', 'L', 'XL', 'XXL'], { min: 3, max: 5 })
          : cat === 'Footwear'
          ? faker.helpers.arrayElements(['6', '7', '8', '9', '10', '11'], { min: 3, max: 5 })
          : [],
        colors:       faker.helpers.arrayElements(COLOUR_POOL, { min: 1, max: 3 }),
        isFeatured:   Math.random() < 0.15,
        isNewArrival: Math.random() < 0.20,
        isTrending:   Math.random() < 0.18,
        shopId,
        ownerId,
        isDemo: true,
      });
    }
  }
  return docs;
}

function buildCustomers(shopId, ownerId, count = 30) {
  return Array.from({ length: count }, () => ({
    name:    faker.person.fullName(),
    phone:   indianPhone(),
    email:   faker.internet.email().toLowerCase(),
    address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
    shopId,
    ownerId,
    isDemo: true,
  }));
}

function buildExpenses(shopId, ownerId, thirtyDaysAgo, count = 15) {
  const TYPES  = ['rent', 'electricity', 'salary', 'maintenance', 'supplies', 'other'];
  const RANGES = {
    rent:        [15000, 35000],
    electricity: [2000,  6000],
    salary:      [12000, 25000],
    maintenance: [1000,  5000],
    supplies:    [2000,  8000],
    other:       [500,   3000],
  };

  return Array.from({ length: count }, () => {
    const type     = faker.helpers.arrayElement(TYPES);
    const [lo, hi] = RANGES[type];
    return {
      type,
      amount:      faker.number.int({ min: lo, max: hi }),
      date:        faker.date.between({ from: thirtyDaysAgo, to: new Date() }),
      description: faker.lorem.sentence({ min: 3, max: 7 }),
      shopId,
      ownerId,
      addedBy:     ownerId,
      isDemo:      true,
    };
  });
}

/**
 * Build ~200 sales spread across 30 days.
 * Weekends get more transactions → realistic peaks in charts.
 */
function buildSales(shopId, ownerId, products, customers, runPrefix) {
  const sales = [];
  const now   = new Date();
  let counter = 1;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const day  = new Date(now);
    day.setDate(day.getDate() - dayOffset);

    const dayStart = new Date(day); dayStart.setHours(0,  0,  0,   0);
    const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999);

    const isWeekend  = [0, 6].includes(dayStart.getDay());
    const txCount    = faker.number.int({ min: isWeekend ? 7 : 4, max: isWeekend ? 13 : 9 });

    for (let s = 0; s < txCount; s++) {
      const picked   = faker.helpers.arrayElements(products, { min: 1, max: 4 });
      const customer = Math.random() > 0.40 ? faker.helpers.arrayElement(customers) : null;

      let totalAmount   = 0;
      let totalDiscount = 0;
      let totalProfit   = 0;

      const items = picked.map((p) => {
        const qty       = faker.number.int({ min: 1, max: 3 });
        const discPct   = p.discount || 0;
        const unitPrice = round2(p.price * (1 - discPct / 100));
        const subtotal  = round2(unitPrice * qty);
        const discAmt   = round2(p.price * qty * (discPct / 100));
        const profit    = round2((unitPrice - p.costPrice) * qty);

        totalAmount   += subtotal;
        totalDiscount += discAmt;
        totalProfit   += profit;

        return {
          product:   p._id,
          name:      p.name,
          price:     unitPrice,
          costPrice: p.costPrice,
          quantity:  qty,
          discount:  discPct,
          subtotal,
          profit,
        };
      });

      const pad      = String(counter++).padStart(5, '0');
      const saleDate = faker.date.between({ from: dayStart, to: dayEnd });

      sales.push({
        _id:           new mongoose.Types.ObjectId(),
        invoiceNumber: `DEMO-${runPrefix}-${pad}`,
        items,
        totalAmount:   round2(totalAmount),
        totalDiscount: round2(totalDiscount),
        totalProfit:   round2(totalProfit),
        taxAmount:     0,
        taxRate:       0,
        paymentMethod: faker.helpers.weightedArrayElement([
          { value: 'cash',   weight: 4 },
          { value: 'upi',    weight: 3 },
          { value: 'card',   weight: 2 },
          { value: 'credit', weight: 1 },
        ]),
        customerId: customer ? customer._id : null,
        shopId,
        ownerId,
        status:    'completed',
        isDemo:    true,
        createdAt: saleDate,
        updatedAt: saleDate,
      });
    }
  }

  return sales;
}

// ── Public functions ──────────────────────────────────────────────────────────

const seedDemo = async (shopId, ownerId) => {
  await clearDemo(shopId);

  // 1. Products
  const productDocs = buildProducts(shopId, ownerId);
  const products    = await Product.insertMany(productDocs, { ordered: false });

  // 2. Customers
  const customerDocs = buildCustomers(shopId, ownerId, 30);
  const customers    = await Customer.insertMany(customerDocs, { ordered: false });

  // 3. Sales — use collection.insertMany to allow custom createdAt for chart data
  const runPrefix = Date.now().toString().slice(-6);
  const saleDocs  = buildSales(shopId, ownerId, products, customers, runPrefix);
  await Sale.collection.insertMany(saleDocs);

  // 4. Expenses
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const expenseDocs   = buildExpenses(shopId, ownerId, thirtyDaysAgo, 15);
  await Expense.insertMany(expenseDocs, { ordered: false });

  return {
    products:  products.length,
    customers: customers.length,
    sales:     saleDocs.length,
    expenses:  expenseDocs.length,
  };
};

const clearDemo = async (shopId) => {
  const [p, c, s, e] = await Promise.all([
    Product.deleteMany({ shopId, isDemo: true }),
    Customer.deleteMany({ shopId, isDemo: true }),
    Sale.deleteMany({ shopId, isDemo: true }),
    Expense.deleteMany({ shopId, isDemo: true }),
  ]);
  return {
    productsRemoved:  p.deletedCount,
    customersRemoved: c.deletedCount,
    salesRemoved:     s.deletedCount,
    expensesRemoved:  e.deletedCount,
  };
};

module.exports = { seedDemo, clearDemo };
