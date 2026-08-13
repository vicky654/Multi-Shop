/**
 * Website Order Flow & Acceptance Unit/Integration Test
 * Usage: node src/modules/sales/websiteOrders.test.js
 */
process.env.NODE_ENV = 'demo';
require('dotenv').config();

if (!process.env.DEMO_DATABASE_URI) {
  const fsx   = require('node:fs');
  const pathx = require('node:path');
  const file  = pathx.join(__dirname, '../../../../.env.demo');
  if (fsx.existsSync(file)) {
    for (const line of fsx.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^DEMO_DATABASE_URI=(.+)$/);
      if (m) process.env.DEMO_DATABASE_URI = m[1].trim();
    }
  }
}

const assert   = require('node:assert');
const mongoose = require('mongoose');
const { resolveUri } = require('../../config/db');
const User        = require('../auth/auth.model');
const Shop        = require('../shops/shop.model');
const Product     = require('../products/product.model');
const Sale        = require('./sale.model');
const saleService = require('./sale.service');

(async () => {
  const { uri, mode } = resolveUri();
  assert.equal(mode, 'demo', 'must run against demo database');

  for (let i = 1; i <= 5; i += 1) {
    try { await mongoose.connect(uri); break; }
    catch (e) {
      if (i === 5) throw e;
      await new Promise((r) => setTimeout(r, i * 2000));
    }
  }

  console.log(`\nTesting Website Orders against DB: ${mongoose.connection.name}`);

  let pass = 0, fail = 0;
  const t = async (name, fn) => {
    try {
      await fn();
      pass += 1;
      console.log(`  ✓ ${name}`);
    } catch (e) {
      fail += 1;
      console.error(`  ✗ ${name}\n      ${e.message}`);
    }
  };

  // Create isolated test fixture
  const owner = await User.create({
    name: 'Website Test Owner', email: `test.owner.${Date.now()}@example.test`,
    password: 'owner123', role: 'owner', phone: '9900001111', isActive: true,
  });

  const shop = await Shop.create({
    name: 'Test Online Store', type: 'clothes', owner: owner._id,
    phone: '022-99887766', currency: '₹', isActive: true,
  });

  const userContext = { _id: owner._id, role: 'owner', shops: [shop._id] };

  // 1. Simple Product
  const simpleProduct = await Product.create({
    name: 'Online Simple Tee', category: 'Clothes', price: 500, costPrice: 200,
    stock: 10, shopId: shop._id, ownerId: owner._id, isActive: true,
  });

  // 2. Variant Product
  const variantProduct = await Product.create({
    name: 'Online Air Sneakers', category: 'Shoes', price: 2000, costPrice: 1000,
    stock: 10, shopId: shop._id, ownerId: owner._id, trackVariantStock: true,
    sizes: ['8', '9'], colors: [{ name: 'Black', hex: '#000' }],
    variantStock: [
      { size: '8', color: 'Black', stock: 4 },
      { size: '9', color: 'Black', stock: 6 },
    ],
    isActive: true,
  });

  // ── TEST 1: Website order creation leaves inventory untouched ─────────────
  let order1;
  await t('Website order creation leaves physical stock unchanged (pending state)', async () => {
    order1 = await saleService.createPublicSale({
      shopId: shop._id.toString(),
      customerName: 'Alice Customer',
      customerPhone: '9876543210',
      items: [
        { productId: simpleProduct._id.toString(), quantity: 2 },
        { productId: variantProduct._id.toString(), quantity: 1, selectedSize: '9', selectedColor: 'Black' },
      ],
    });

    assert.equal(order1.status, 'pending');
    assert.equal(order1.isOnlineOrder, true);

    const freshSimple = await Product.findById(simpleProduct._id);
    const freshVariant = await Product.findById(variantProduct._id);

    assert.equal(freshSimple.stock, 10, 'Simple stock must stay 10');
    assert.equal(freshVariant.stock, 10, 'Variant total stock must stay 10');
    assert.equal(freshVariant.variantStock.find(v => v.size === '9').stock, 6, 'Variant size 9 stock must stay 6');
  });

  // ── TEST 2: Owner accepts order → exact stock deducted ─────────────────────
  await t('Owner accepts order → exact variant and simple stock are decremented', async () => {
    const accepted = await saleService.acceptOrder(order1._id, userContext);
    assert.equal(accepted.status, 'completed');

    const freshSimple = await Product.findById(simpleProduct._id);
    const freshVariant = await Product.findById(variantProduct._id);

    assert.equal(freshSimple.stock, 8, 'Simple stock should decrease from 10 to 8');
    assert.equal(freshVariant.stock, 9, 'Variant total stock should decrease from 10 to 9');
    assert.equal(freshVariant.variantStock.find(v => v.size === '9').stock, 5, 'Size 9 variant stock should decrease from 6 to 5');
    assert.equal(freshVariant.variantStock.find(v => v.size === '8').stock, 4, 'Size 8 variant stock should remain 4');
  });

  // ── TEST 3: Double acceptance throws error ────────────────────────────────
  await t('Double acceptance attempt is rejected with error', async () => {
    try {
      await saleService.acceptOrder(order1._id, userContext);
      assert.fail('Should have thrown an error on second acceptance');
    } catch (err) {
      assert.ok(err.status === 400 || err.status === 409);
    }
  });

  // ── TEST 4: Website order rejection leaves stock untouched ──────────────────
  let order2;
  await t('Owner rejects a pending order → stock remains untouched', async () => {
    order2 = await saleService.createPublicSale({
      shopId: shop._id.toString(),
      customerName: 'Bob Customer',
      customerPhone: '9876543211',
      items: [
        { productId: simpleProduct._id.toString(), quantity: 3 },
      ],
    });

    const rejected = await saleService.rejectOrder(order2._id, userContext, { reason: 'Out of area' });
    assert.equal(rejected.status, 'rejected');

    const freshSimple = await Product.findById(simpleProduct._id);
    assert.equal(freshSimple.stock, 8, 'Simple stock should remain 8 after rejection');
  });

  // ── TEST 5: Insufficient stock blocks acceptance ───────────────────────────
  let order3;
  await t('Insufficient stock blocks order acceptance safely', async () => {
    order3 = await saleService.createPublicSale({
      shopId: shop._id.toString(),
      customerName: 'Charlie Customer',
      customerPhone: '9876543212',
      items: [
        { productId: simpleProduct._id.toString(), quantity: 99 }, // Have only 8
      ],
    });

    try {
      await saleService.acceptOrder(order3._id, userContext);
      assert.fail('Acceptance should fail due to insufficient stock');
    } catch (err) {
      assert.equal(err.status, 409);
      assert.ok(err.message.includes('stock') || err.message.includes('Insufficient'));
    }

    const freshSimple = await Product.findById(simpleProduct._id);
    assert.equal(freshSimple.stock, 8, 'Simple stock must remain unchanged after blocked acceptance');
  });

  // ── TEST 6: Accepted order cancellation restores stock ─────────────────────
  await t('Cancelling/rejecting an accepted order restores exact stock', async () => {
    const cancelled = await saleService.rejectOrder(order1._id, userContext, { reason: 'Customer requested cancellation' });
    assert.equal(cancelled.status, 'rejected');

    const freshSimple = await Product.findById(simpleProduct._id);
    const freshVariant = await Product.findById(variantProduct._id);

    assert.equal(freshSimple.stock, 10, 'Simple stock restored to 10');
    assert.equal(freshVariant.stock, 10, 'Variant total restored to 10');
    assert.equal(freshVariant.variantStock.find(v => v.size === '9').stock, 6, 'Variant size 9 restored to 6');
  });

  // Cleanup
  await Promise.all([
    User.deleteOne({ _id: owner._id }),
    Shop.deleteOne({ _id: shop._id }),
    Product.deleteMany({ shopId: shop._id }),
    Sale.deleteMany({ shopId: shop._id }),
  ]);

  console.log(`\nWebsite Orders Test Summary: ${pass} passing, ${fail} failing\n`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (err) => {
  console.error('\n✖ Website Orders Test Error:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
