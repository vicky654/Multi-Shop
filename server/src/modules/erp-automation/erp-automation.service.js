/**
 * erp-automation.service.js
 *
 * ERP Automation Engine — stateless business-logic functions.
 * Each automation runs per-shop and writes an AutomationLog entry.
 *
 * Automations (in priority order):
 *  1. LOW_STOCK_ALERT    — flag products below reorder point
 *  2. AUTO_REORDER       — create reorder tasks when stock = 0
 *  3. DAILY_PROFIT       — compute & log today's profit summary
 *  4. EXPIRY_ALERT       — flag products expiring within 30 days
 *  5. CUSTOMER_REMINDER  — flag customers with credit balance overdue
 *  6. SMART_PRICING      — suggest price adjustments for low-margin items
 *  7. INACTIVE_PRODUCT   — flag products with zero sales in 30 days
 *  8. AUTO_DISCOUNT      — detect slow-movers eligible for discount
 *  9. FAST_MOVER         — log top-selling SKUs for restocking insight
 * 10. DEAD_STOCK         — flag products unsold for 90+ days
 */

const mongoose  = require('mongoose');
const Product   = require('../products/product.model');
const Sale      = require('../sales/sale.model');
const Customer  = require('../customers/customer.model');
const AutomationLog = require('./automationLog.model');

// ── Utility ──────────────────────────────────────────────────────────────────

const toOid = (id) => {
  try { return new mongoose.Types.ObjectId(id.toString()); } catch { return null; }
};

/**
 * Persist a run record.  Swallows errors to never break the scheduler.
 */
const log = async (shopId, type, status, message, data = {}, errorMsg = null) => {
  try {
    await AutomationLog.create({ shopId, type, status, message, data, error: errorMsg });
  } catch (e) {
    console.error(`[ERP-Auto] log write failed for ${type}:`, e.message);
  }
};

// ── 1. LOW_STOCK_ALERT ────────────────────────────────────────────────────────

/**
 * Finds all active products whose stock ≤ lowStockThreshold.
 * Logs count + product names.  Does NOT send notifications (handled by campaign automation).
 */
const runLowStockAlert = async (shopId) => {
  try {
    const products = await Product.find({
      shopId,
      isActive: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    })
      .select('name sku stock lowStockThreshold')
      .limit(50)
      .lean();

    const message = products.length === 0
      ? 'All products are sufficiently stocked'
      : `${products.length} product(s) at or below reorder threshold`;

    await log(shopId, 'LOW_STOCK_ALERT', 'success', message, {
      count: products.length,
      products: products.map((p) => ({ name: p.name, sku: p.sku, stock: p.stock, threshold: p.lowStockThreshold })),
    });

    return { count: products.length, products };
  } catch (e) {
    await log(shopId, 'LOW_STOCK_ALERT', 'failed', 'Error checking low stock', {}, e.message);
    throw e;
  }
};

// ── 2. AUTO_REORDER ───────────────────────────────────────────────────────────

/**
 * Finds products with stock = 0 that have a reorderPoint set (reorderPoint > 0).
 * Logs a reorder task list.  In Phase 3 this will auto-create Purchase Orders.
 */
const runAutoReorder = async (shopId) => {
  try {
    const products = await Product.find({
      shopId,
      isActive: true,
      stock: 0,
      reorderPoint: { $gt: 0 },
    })
      .select('name sku stock reorderPoint maxStock costPrice')
      .limit(50)
      .lean();

    const message = products.length === 0
      ? 'No out-of-stock products require reordering'
      : `${products.length} product(s) flagged for reorder (stock = 0)`;

    await log(shopId, 'AUTO_REORDER', 'success', message, {
      count: products.length,
      reorderList: products.map((p) => ({
        name:         p.name,
        sku:          p.sku,
        reorderPoint: p.reorderPoint,
        suggestedQty: p.maxStock > 0 ? p.maxStock : p.reorderPoint * 2,
        estCost:      p.costPrice * (p.maxStock > 0 ? p.maxStock : p.reorderPoint * 2),
      })),
    });

    return { count: products.length, products };
  } catch (e) {
    await log(shopId, 'AUTO_REORDER', 'failed', 'Error computing reorder list', {}, e.message);
    throw e;
  }
};

// ── 3. DAILY_PROFIT ───────────────────────────────────────────────────────────

/**
 * Aggregates today's completed sales: revenue, cost, profit, margin.
 * Runs once per day (scheduler should call it at midnight or morning).
 */
const runDailyProfit = async (shopId) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [result] = await Sale.aggregate([
      {
        $match: {
          shopId:  toOid(shopId),
          status:  'completed',
          createdAt: { $gte: todayStart },
        },
      },
      {
        $group: {
          _id:        null,
          revenue:    { $sum: '$totalAmount' },
          profit:     { $sum: '$totalProfit' },
          discount:   { $sum: '$totalDiscount' },
          saleCount:  { $sum: 1 },
          itemsSold:  { $sum: { $sum: '$items.quantity' } },
        },
      },
    ]);

    if (!result || result.saleCount === 0) {
      await log(shopId, 'DAILY_PROFIT', 'skipped', 'No sales recorded today', { date: todayStart });
      return { skipped: true };
    }

    const margin = result.revenue > 0
      ? Math.round((result.profit / result.revenue) * 100)
      : 0;

    const message = `Today: ₹${result.revenue.toFixed(2)} revenue, ₹${result.profit.toFixed(2)} profit (${margin}% margin) across ${result.saleCount} sales`;

    await log(shopId, 'DAILY_PROFIT', 'success', message, {
      date:      todayStart,
      revenue:   result.revenue,
      profit:    result.profit,
      discount:  result.discount,
      saleCount: result.saleCount,
      itemsSold: result.itemsSold,
      margin,
    });

    return { revenue: result.revenue, profit: result.profit, margin };
  } catch (e) {
    await log(shopId, 'DAILY_PROFIT', 'failed', 'Error computing daily profit', {}, e.message);
    throw e;
  }
};

// ── 4. EXPIRY_ALERT ───────────────────────────────────────────────────────────

/**
 * Finds products where expiryDate is within the next 30 days (or already past).
 */
const runExpiryAlert = async (shopId) => {
  try {
    const now     = new Date();
    const in30    = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const products = await Product.find({
      shopId,
      isActive:   true,
      expiryDate: { $lte: in30 },
    })
      .select('name sku stock expiryDate')
      .limit(100)
      .lean();

    const expired = products.filter((p) => new Date(p.expiryDate) < now);
    const expiring = products.filter((p) => new Date(p.expiryDate) >= now);

    const message = products.length === 0
      ? 'No products expiring within 30 days'
      : `${expired.length} expired, ${expiring.length} expiring within 30 days`;

    await log(shopId, 'EXPIRY_ALERT', 'success', message, {
      total:   products.length,
      expired: expired.map((p) => ({ name: p.name, sku: p.sku, stock: p.stock, expiryDate: p.expiryDate })),
      expiring: expiring.map((p) => ({ name: p.name, sku: p.sku, stock: p.stock, expiryDate: p.expiryDate })),
    });

    return { total: products.length, expired, expiring };
  } catch (e) {
    await log(shopId, 'EXPIRY_ALERT', 'failed', 'Error checking expiry dates', {}, e.message);
    throw e;
  }
};

// ── 5. CUSTOMER_REMINDER ─────────────────────────────────────────────────────

/**
 * Finds customers with outstanding credit balance (creditBalance > 0).
 * Orders by balance descending — top debtors first.
 */
const runCustomerReminder = async (shopId) => {
  try {
    const customers = await Customer.find({
      shopId,
      isActive:      true,
      creditBalance: { $gt: 0 },
    })
      .select('name phone creditBalance updatedAt')
      .sort({ creditBalance: -1 })
      .limit(50)
      .lean();

    const totalDue = customers.reduce((s, c) => s + c.creditBalance, 0);

    const message = customers.length === 0
      ? 'No customers with outstanding credit balance'
      : `${customers.length} customer(s) owe ₹${totalDue.toFixed(2)} in total`;

    await log(shopId, 'CUSTOMER_REMINDER', 'success', message, {
      count:    customers.length,
      totalDue,
      customers: customers.map((c) => ({
        name:          c.name,
        phone:         c.phone,
        creditBalance: c.creditBalance,
        lastActivity:  c.updatedAt,
      })),
    });

    return { count: customers.length, totalDue, customers };
  } catch (e) {
    await log(shopId, 'CUSTOMER_REMINDER', 'failed', 'Error checking customer credit', {}, e.message);
    throw e;
  }
};

// ── 6. SMART_PRICING ─────────────────────────────────────────────────────────

/**
 * Identifies products whose profit margin < 10%.
 * Suggests a price increase to reach at least 15% margin.
 */
const runSmartPricing = async (shopId) => {
  try {
    const products = await Product.find({
      shopId,
      isActive: true,
      costPrice: { $gt: 0 },
      $expr: {
        // margin = (price - costPrice) / price < 0.10
        $lt: [
          { $divide: [{ $subtract: ['$price', '$costPrice'] }, '$price'] },
          0.10,
        ],
      },
    })
      .select('name sku price costPrice discount')
      .limit(50)
      .lean();

    const suggestions = products.map((p) => {
      const currentMargin = p.price > 0 ? Math.round(((p.price - p.costPrice) / p.price) * 100) : 0;
      // Suggested price for 15% margin: cost / (1 - 0.15)
      const suggestedPrice = Math.ceil(p.costPrice / 0.85);
      return {
        name:           p.name,
        sku:            p.sku,
        currentPrice:   p.price,
        costPrice:      p.costPrice,
        currentMargin,
        suggestedPrice,
        suggestedMargin: 15,
      };
    });

    const message = suggestions.length === 0
      ? 'All products have healthy profit margins (≥10%)'
      : `${suggestions.length} product(s) have thin margins — price adjustments suggested`;

    await log(shopId, 'SMART_PRICING', 'success', message, { count: suggestions.length, suggestions });

    return { count: suggestions.length, suggestions };
  } catch (e) {
    await log(shopId, 'SMART_PRICING', 'failed', 'Error computing pricing suggestions', {}, e.message);
    throw e;
  }
};

// ── 7. INACTIVE_PRODUCT ───────────────────────────────────────────────────────

/**
 * Products that are active and in stock but have NOT appeared in any sale
 * in the past 30 days.
 */
const runInactiveProduct = async (shopId) => {
  try {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Product IDs that DID sell in last 30 days
    const soldDocs = await Sale.distinct('items.product', {
      shopId: toOid(shopId),
      status: 'completed',
      createdAt: { $gte: since30 },
    });

    const soldSet = new Set(soldDocs.map(String));

    const products = await Product.find({
      shopId,
      isActive: true,
      stock:    { $gt: 0 },
    })
      .select('name sku stock price createdAt')
      .lean();

    const inactive = products.filter((p) => !soldSet.has(String(p._id)));

    const message = inactive.length === 0
      ? 'All in-stock products have recent sales activity'
      : `${inactive.length} product(s) with stock but no sales in 30 days`;

    await log(shopId, 'INACTIVE_PRODUCT', 'success', message, {
      count: inactive.length,
      products: inactive.slice(0, 30).map((p) => ({
        name:      p.name,
        sku:       p.sku,
        stock:     p.stock,
        price:     p.price,
        createdAt: p.createdAt,
      })),
    });

    return { count: inactive.length };
  } catch (e) {
    await log(shopId, 'INACTIVE_PRODUCT', 'failed', 'Error checking inactive products', {}, e.message);
    throw e;
  }
};

// ── 8. AUTO_DISCOUNT ─────────────────────────────────────────────────────────

/**
 * Products in stock for > 60 days without a discount applied.
 * Suggests 5–15% discount to shift slow-moving inventory.
 */
const runAutoDiscount = async (shopId) => {
  try {
    const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const products = await Product.find({
      shopId,
      isActive:  true,
      stock:     { $gt: 0 },
      discount:  { $lte: 2 },          // currently no meaningful discount
      createdAt: { $lte: since60 },    // in inventory for 60+ days
    })
      .select('name sku price costPrice discount stock createdAt')
      .limit(50)
      .lean();

    const suggestions = products.map((p) => {
      // Suggest enough discount to still cover 10% margin
      const minPrice      = p.costPrice * 1.10;
      const maxDiscount   = p.price > 0 ? Math.floor(((p.price - minPrice) / p.price) * 100) : 0;
      const suggestedDisc = Math.min(15, Math.max(5, maxDiscount));
      const agedays       = Math.floor((Date.now() - new Date(p.createdAt)) / 86400000);
      return { name: p.name, sku: p.sku, price: p.price, stock: p.stock, agedays, suggestedDisc };
    });

    const message = suggestions.length === 0
      ? 'No slow-moving items identified for auto-discount'
      : `${suggestions.length} slow-moving product(s) eligible for a discount`;

    await log(shopId, 'AUTO_DISCOUNT', 'success', message, { count: suggestions.length, suggestions });

    return { count: suggestions.length, suggestions };
  } catch (e) {
    await log(shopId, 'AUTO_DISCOUNT', 'failed', 'Error computing discount suggestions', {}, e.message);
    throw e;
  }
};

// ── 9. FAST_MOVER ─────────────────────────────────────────────────────────────

/**
 * Top 10 best-selling products by quantity in the last 7 days.
 * Useful for restocking and featured-product decisions.
 */
const runFastMover = async (shopId) => {
  try {
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const topProducts = await Sale.aggregate([
      {
        $match: {
          shopId:    toOid(shopId),
          status:    'completed',
          createdAt: { $gte: since7 },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id:      '$items.product',
          name:     { $first: '$items.name' },
          qtySold:  { $sum: '$items.quantity' },
          revenue:  { $sum: '$items.subtotal' },
          profit:   { $sum: '$items.profit' },
        },
      },
      { $sort: { qtySold: -1 } },
      { $limit: 10 },
    ]);

    const message = topProducts.length === 0
      ? 'No sales data for the past 7 days'
      : `Top fast-mover: "${topProducts[0].name}" (${topProducts[0].qtySold} units in 7 days)`;

    await log(shopId, 'FAST_MOVER', 'success', message, {
      period: '7d',
      count:  topProducts.length,
      topProducts,
    });

    return { count: topProducts.length, topProducts };
  } catch (e) {
    await log(shopId, 'FAST_MOVER', 'failed', 'Error computing fast movers', {}, e.message);
    throw e;
  }
};

// ── 10. DEAD_STOCK ───────────────────────────────────────────────────────────

/**
 * Products with stock > 0 and no sales in 90+ days.
 * These tie up capital and warehouse space — flag for review/writeoff.
 */
const runDeadStock = async (shopId) => {
  try {
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const soldDocs = await Sale.distinct('items.product', {
      shopId:    toOid(shopId),
      status:    'completed',
      createdAt: { $gte: since90 },
    });

    const soldSet = new Set(soldDocs.map(String));

    const products = await Product.find({
      shopId,
      isActive: true,
      stock:    { $gt: 0 },
      createdAt: { $lte: since90 },
    })
      .select('name sku stock costPrice createdAt')
      .lean();

    const dead = products.filter((p) => !soldSet.has(String(p._id)));
    const capitalTied = dead.reduce((s, p) => s + p.stock * (p.costPrice || 0), 0);

    const message = dead.length === 0
      ? 'No dead stock detected (90-day window)'
      : `${dead.length} product(s) unsold for 90+ days — ₹${capitalTied.toFixed(2)} capital tied up`;

    await log(shopId, 'DEAD_STOCK', 'success', message, {
      count: dead.length,
      capitalTied,
      products: dead.slice(0, 30).map((p) => ({
        name:       p.name,
        sku:        p.sku,
        stock:      p.stock,
        costPrice:  p.costPrice,
        capitalTied: p.stock * (p.costPrice || 0),
        createdAt:  p.createdAt,
      })),
    });

    return { count: dead.length, capitalTied };
  } catch (e) {
    await log(shopId, 'DEAD_STOCK', 'failed', 'Error detecting dead stock', {}, e.message);
    throw e;
  }
};

// ── Config registry ───────────────────────────────────────────────────────────

/**
 * Master registry of all ERP automations.
 * `intervalMs` is how often the scheduler fires this automation (per shop).
 * `defaultEnabled` sets the initial state when a shop hasn't configured it.
 */
const ERP_AUTOMATIONS = {
  LOW_STOCK_ALERT:   { label: 'Low Stock Alert',        intervalMs: 30 * 60 * 1000,        defaultEnabled: true,  run: runLowStockAlert   },
  AUTO_REORDER:      { label: 'Auto Reorder Flag',       intervalMs: 60 * 60 * 1000,        defaultEnabled: true,  run: runAutoReorder      },
  DAILY_PROFIT:      { label: 'Daily Profit Summary',    intervalMs: 24 * 60 * 60 * 1000,   defaultEnabled: true,  run: runDailyProfit      },
  EXPIRY_ALERT:      { label: 'Expiry Alert',            intervalMs: 6  * 60 * 60 * 1000,   defaultEnabled: true,  run: runExpiryAlert      },
  CUSTOMER_REMINDER: { label: 'Customer Credit Reminder',intervalMs: 24 * 60 * 60 * 1000,   defaultEnabled: true,  run: runCustomerReminder },
  SMART_PRICING:     { label: 'Smart Pricing Suggestion',intervalMs: 24 * 60 * 60 * 1000,   defaultEnabled: false, run: runSmartPricing     },
  INACTIVE_PRODUCT:  { label: 'Inactive Product Scan',   intervalMs: 24 * 60 * 60 * 1000,   defaultEnabled: false, run: runInactiveProduct  },
  AUTO_DISCOUNT:     { label: 'Auto Discount Suggestion',intervalMs: 24 * 60 * 60 * 1000,   defaultEnabled: false, run: runAutoDiscount     },
  FAST_MOVER:        { label: 'Fast Mover Analysis',     intervalMs: 6  * 60 * 60 * 1000,   defaultEnabled: true,  run: runFastMover        },
  DEAD_STOCK:        { label: 'Dead Stock Detection',    intervalMs: 24 * 60 * 60 * 1000,   defaultEnabled: false, run: runDeadStock        },
};

// ── Per-shop state tracker (in-memory, resets on restart) ─────────────────────
// Shape: { [shopId]: { [type]: { lastRunAt: Date, enabled: boolean } } }
const shopState = {};

const getState = (shopId, type) => {
  if (!shopState[shopId]) shopState[shopId] = {};
  if (!shopState[shopId][type]) {
    shopState[shopId][type] = {
      enabled:   ERP_AUTOMATIONS[type].defaultEnabled,
      lastRunAt: null,
    };
  }
  return shopState[shopId][type];
};

const setState = (shopId, type, patch) => {
  const s = getState(shopId, type);
  Object.assign(s, patch);
};

// ── Scheduler entry point ─────────────────────────────────────────────────────

/**
 * runErpAutomations — called by the scheduler every N minutes.
 * Loads all unique shopIds from recent products, then checks which
 * automations are due to run based on their interval + last run time.
 */
const runErpAutomations = async () => {
  try {
    // Get distinct shop IDs from active products (avoids loading the Shop model)
    const shopIds = await Product.distinct('shopId', { isActive: true });

    for (const shopId of shopIds) {
      const sid = shopId.toString();
      for (const [type, cfg] of Object.entries(ERP_AUTOMATIONS)) {
        const state = getState(sid, type);
        if (!state.enabled) continue;

        const now       = Date.now();
        const lastRun   = state.lastRunAt ? new Date(state.lastRunAt).getTime() : 0;
        const isDue     = (now - lastRun) >= cfg.intervalMs;

        if (!isDue) continue;

        setState(sid, type, { lastRunAt: new Date() });

        cfg.run(shopId).catch((e) =>
          console.error(`[ERP-Auto] ${type} failed for shop ${sid}:`, e.message)
        );
      }
    }
  } catch (e) {
    console.error('[ERP-Auto] scheduler tick error:', e.message);
  }
};

// ── Manual trigger (API) ──────────────────────────────────────────────────────

/**
 * Runs a single automation immediately for a given shop, regardless of interval.
 * Used by the frontend "Run Now" button.
 */
const triggerNow = async (shopId, type) => {
  const cfg = ERP_AUTOMATIONS[type];
  if (!cfg) throw new Error(`Unknown automation type: ${type}`);

  setState(shopId.toString(), type, { lastRunAt: new Date() });
  return cfg.run(shopId);
};

// ── Config helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the current config + last-run state for all automations for a shop.
 * Used by GET /api/erp-automations?shopId=
 */
const getAutomationConfig = (shopId) => {
  const sid = shopId.toString();
  return Object.entries(ERP_AUTOMATIONS).map(([type, cfg]) => {
    const state = getState(sid, type);
    return {
      type,
      label:      cfg.label,
      enabled:    state.enabled,
      lastRunAt:  state.lastRunAt,
      intervalMs: cfg.intervalMs,
    };
  });
};

/**
 * Toggles an automation on/off for a shop.
 */
const toggleAutomation = (shopId, type, enabled) => {
  const cfg = ERP_AUTOMATIONS[type];
  if (!cfg) throw new Error(`Unknown automation type: ${type}`);
  setState(shopId.toString(), type, { enabled });
  return getState(shopId.toString(), type);
};

module.exports = {
  runErpAutomations,
  triggerNow,
  getAutomationConfig,
  toggleAutomation,
  ERP_AUTOMATIONS,
};
