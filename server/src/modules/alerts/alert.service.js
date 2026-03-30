const productService = require('../products/product.service');
const expenseService = require('../expenses/expense.service');
const Log = require('../../models/Log');
const { format } = require('date-fns');

const generateAlerts = async (user, shopId = null) => {
  const alerts = [];

  try {
    // 1. Low stock alert (priority 1)
    const lowStock = await productService.getLowStockProducts(user, shopId);
    if (lowStock.products && lowStock.products.length > 0) {
      alerts.push({
        id: `low_stock_${shopId || 'global'}_${Date.now()}`,
        type: 'low_stock',
        message: `${lowStock.products.length} products low on stock`,
        severity: 'warning',
        action: 'View Inventory',
        route: '/inventory',
        data: { count: lowStock.products.length, products: lowStock.products.slice(0, 3).map(p => p.name) }
      });
    }

    // 2. Recent expenses
    const todayExpenses = await expenseService.getTodayExpenses(user, shopId);
    if (todayExpenses.total > 0) {
      alerts.push({
        id: `expense_${shopId || 'global'}_${format(new Date(), 'yyyy-MM-dd')}`,
        type: 'new_expense',
        message: `₹${todayExpenses.total.toLocaleString()} expenses added today`,
        severity: 'info',
        action: 'View Expenses',
        route: '/expenses',
        data: { total: todayExpenses.total, count: todayExpenses.count }
      });
    }

    // 3. Recent errors (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentErrors = await Log.countDocuments({
      shopId,
      status: 'error',
      createdAt: { $gte: oneDayAgo }
    });
    if (recentErrors > 0) {
      alerts.push({
        id: `errors_${shopId || 'global'}_${format(oneDayAgo, 'yyyy-MM-dd')}`,
        type: 'system_notice',
        message: `${recentErrors} errors occurred recently`,
        severity: 'error',
        action: 'View Logs',
        route: '/logs',
        data: { count: recentErrors }
      });
    }

    // 4. High sales day (if today revenue > 150% average)
    // Simple version - check if any sales today
    const todaySales = await saleService.getSales(user, { shopId, dateRange: 'today' });
    if (todaySales.length > 0) {
      alerts.push({
        id: `high_sales_${shopId || 'global'}_${format(new Date(), 'yyyy-MM-dd')}`,
        type: 'high_sales',
        message: `Great day! ${todaySales.length} sales recorded`,
        severity: 'success',
        action: 'View Reports',
        route: '/reports',
        data: { count: todaySales.length }
      });
    }

    // Limit to 5 alerts, prioritize severity
    const prioritized = alerts.sort((a, b) => {
      const priority = { error: 0, warning: 1, info: 2, success: 3 };
      return priority[a.severity] - priority[b.severity];
    }).slice(0, 5);

    return prioritized;
  } catch (error) {
    console.error('Alert generation error:', error);
    return [];
  }
};

module.exports = { generateAlerts };

