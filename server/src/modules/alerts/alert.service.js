const Product = require('../products/product.model');
const Sale    = require('../sales/sale.model');
const Expense = require('../expenses/expense.model');
const Log     = require('../../models/Log');

const shopFilter = (user, shopId) => {
  if (shopId) return { shopId };
  if (user.role === 'super_admin') return {};
  return { shopId: { $in: user.shops } };
};

const generateAlerts = async (user, shopId = null) => {
  const sf         = shopFilter(user, shopId);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterday  = new Date(todayStart.getTime() - 86400000);
  const weekAgo    = new Date(Date.now() - 7 * 86400000);
  const dayAgo     = new Date(Date.now() - 86400000);

  try {
    const [outOfStock, lowStock, todayExp, todaySales, yesterdaySales, fastMoving, recentErrors] =
      await Promise.all([
        Product.countDocuments({ ...sf, isActive: true, stock: 0 }),
        Product.countDocuments({ ...sf, isActive: true, stock: { $gt: 0 }, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
        Expense.aggregate([
          { $match: { ...sf, date: { $gte: todayStart } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Sale.aggregate([
          { $match: { ...sf, status: 'completed', createdAt: { $gte: todayStart } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        ]),
        Sale.aggregate([
          { $match: { ...sf, status: 'completed', createdAt: { $gte: yesterday, $lt: todayStart } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        Sale.aggregate([
          { $match: { ...sf, status: 'completed', createdAt: { $gte: weekAgo } } },
          { $unwind: '$items' },
          { $group: { _id: '$items.product', name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' } } },
          { $sort: { qty: -1 } },
          { $limit: 1 },
        ]),
        // Only include log errors if user can see logs (owner or super_admin)
        (user.role === 'owner' || user.role === 'super_admin')
          ? Log.countDocuments({ ...sf, status: 'error', createdAt: { $gte: dayAgo } })
          : Promise.resolve(0),
      ]);

    const expTotal   = todayExp[0]?.total    || 0;
    const expCount   = todayExp[0]?.count    || 0;
    const salesTotal = todaySales[0]?.total  || 0;
    const salesCount = todaySales[0]?.count  || 0;
    const yTotal     = yesterdaySales[0]?.total || 0;
    const today      = todayStart.toISOString().slice(0, 10);

    const alerts = [];

    if (outOfStock > 0) {
      alerts.push({
        id: `out_of_stock_${today}`,
        type: 'out_of_stock',
        severity: 'error',
        message: outOfStock === 1 ? '1 product is out of stock' : `${outOfStock} products are out of stock`,
        action: 'View Inventory',
        route: '/inventory',
        data: { count: outOfStock },
      });
    }

    if (lowStock > 0) {
      alerts.push({
        id: `low_stock_${today}`,
        type: 'low_stock',
        severity: 'warning',
        message: lowStock === 1 ? '1 product is running low' : `${lowStock} products are running low on stock`,
        action: 'View Inventory',
        route: '/inventory',
        data: { count: lowStock },
      });
    }

    if (recentErrors > 2) {
      alerts.push({
        id: `system_errors_${today}`,
        type: 'system_notice',
        severity: 'error',
        message: `${recentErrors} system errors in the last 24 hours`,
        action: 'View Logs',
        route: '/logs',
        data: { count: recentErrors },
      });
    }

    if (salesCount > 0) {
      const growthPct = yTotal > 0 ? Math.round(((salesTotal - yTotal) / yTotal) * 100) : null;
      if (growthPct !== null && growthPct >= 20) {
        alerts.push({
          id: `high_sales_${today}`,
          type: 'high_sales',
          severity: 'success',
          message: `Sales up ${growthPct}% vs yesterday — ₹${salesTotal.toLocaleString('en-IN')} today!`,
          action: 'View Reports',
          route: '/reports',
          data: { growthPct, salesTotal, salesCount },
        });
      } else if (salesCount >= 5) {
        alerts.push({
          id: `high_sales_${today}`,
          type: 'high_sales',
          severity: 'success',
          message: `${salesCount} sales completed today`,
          action: 'View Reports',
          route: '/reports',
          data: { salesCount },
        });
      }
    }

    if (expCount > 0) {
      alerts.push({
        id: `expense_${today}`,
        type: 'new_expense',
        severity: 'info',
        message: `₹${expTotal.toLocaleString('en-IN')} in expenses recorded today`,
        action: 'View Expenses',
        route: '/expenses',
        data: { total: expTotal, count: expCount },
      });
    }

    if (fastMoving.length > 0) {
      const top = fastMoving[0];
      alerts.push({
        id: `ai_restock_${today}`,
        type: 'ai_suggestion',
        severity: 'success',
        message: `"${top.name}" sold ${top.qty} units this week — consider restocking`,
        action: 'AI Insights',
        route: '/ai-insights',
        data: { productName: top.name, qty: top.qty },
      });
    }

    // Sort by severity priority, cap at 5
    const priority = { error: 0, warning: 1, info: 2, success: 3 };
    return alerts.sort((a, b) => priority[a.severity] - priority[b.severity]).slice(0, 5);

  } catch (err) {
    console.error('Alert generation error:', err.message);
    return [];
  }
};

module.exports = { generateAlerts };

