const router = require('express').Router();
const mongoose = require('mongoose');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

/**
 * Test-only utility routes.
 *
 * Mounted by app.js ONLY when NODE_ENV === 'test' (or USE_TEST_DB=1), so these
 * endpoints do not exist in a production process at all. Every handler also
 * re-checks the connected database name as a second line of defence — a purge
 * must never be able to run against real data.
 */

const TEST_DB = () => /test/i.test(mongoose.connection.name || '');

const assertTestDb = (req, res, next) => {
  if (!TEST_DB()) {
    return res.status(403).json({
      success: false,
      message: `Refusing to operate on non-test database "${mongoose.connection.name}"`,
    });
  }
  next();
};

// ── Which database am I talking to? ───────────────────────────────────────────
// Cypress calls this before any spec runs and aborts if isTestDb is false.
router.get('/db-info', asyncHandler(async (req, res) => {
  success(res, {
    dbName:   mongoose.connection.name,
    isTestDb: TEST_DB(),
    env:      process.env.NODE_ENV || 'development',
  }, 'DB info');
}));

// ── Purge data created by E2E runs ────────────────────────────────────────────
// Removes only documents that carry a test marker, so a shared test database
// keeps its seeded owner/shop/roles and stays usable across runs.
router.post('/purge', assertTestDb, asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;

  // Every product/customer name the E2E specs seed. Anchored and explicit so a
  // purge can only ever remove fixtures, never a real shop's catalogue.
  // Sales are matched by the products they contain, not by name.
  const NAME_RX = new RegExp(
    '^(' + [
      'Test ', 'E2E ', 'Cypress',                      // generic prefixes
      'Split Pay Test', 'Variant Stock Test',
      'Oversell Test Product', 'Last Item Product', 'Zero Stock Product',
      'Mismatch Test Product', 'Credit Limit Test Item',
      'Expensive Unlimited Test Item',
      'Refund Test Notebook', 'Refund Test Pen',
      'Expired Milk', 'Fresh Butter', 'Near Expiry Cheese',
      'Cotton T-Shirt No Expiry',
      'Limited Credit Customer', 'Unlimited Credit Customer',
    ].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
    'i'
  );

  const products  = await db.collection('products').find({ name: NAME_RX }).project({ _id: 1 }).toArray();
  const productIds = products.map((p) => p._id);

  const [sales, prods, customers, ledger] = await Promise.all([
    db.collection('sales').deleteMany({
      $or: [
        { 'items.product': { $in: productIds } },
        { notes: /cypress/i },
        { 'items.name': NAME_RX },
      ],
    }),
    db.collection('products').deleteMany({ name: NAME_RX }),
    db.collection('customers').deleteMany({ name: NAME_RX }),
    db.collection('creditledgers').deleteMany({ notes: /cypress|Test /i }),
  ]);

  success(res, {
    dbName:            mongoose.connection.name,
    salesDeleted:      sales.deletedCount,
    productsDeleted:   prods.deletedCount,
    customersDeleted:  customers.deletedCount,
    ledgerDeleted:     ledger.deletedCount,
  }, 'Test data purged');
}));

module.exports = router;
