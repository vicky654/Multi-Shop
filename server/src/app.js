const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const { errorHandler, notFound } = require('./middlewares/error.middleware');
const sanitize                   = require('./middlewares/sanitize.middleware');
const { corsOptions }            = require('./config/cors');

// Route imports
const authRoutes          = require('./modules/auth/auth.routes');
const shopRoutes          = require('./modules/shops/shop.routes');
const productRoutes       = require('./modules/products/product.routes');
const inventoryRoutes     = require('./modules/inventory/inventory.routes');
const saleRoutes          = require('./modules/sales/sale.routes');
const customerRoutes      = require('./modules/customers/customer.routes');
const expenseRoutes       = require('./modules/expenses/expense.routes');
const reportRoutes        = require('./modules/reports/report.routes');
const roleRoutes          = require('./modules/roles/role.routes');
const notificationRoutes  = require('./modules/notifications/notification.routes');
const aiRoutes            = require('./modules/ai/ai.routes');
const adminRoutes         = require('./modules/admin/admin.routes');
const demoRoutes          = require('./modules/demo/demo.routes');
const pushRoutes          = require('./modules/push/push.routes');
const campaignRoutes      = require('./modules/campaigns/campaign.routes');
const automationRoutes    = require('./modules/campaigns/automation.routes');
const scheduler           = require('./modules/campaigns/scheduler');
const notifyRoutes        = require('./modules/notify/notify.routes');
const logsRoutes          = require('./modules/logs/logs.routes');
const alertRoutes         = require('./modules/alerts/alert.routes');
const parserRoutes        = require('./modules/parser/parser.routes');
const insightsRoutes      = require('./modules/insights/insights.routes');
const taxRoutes           = require('./modules/tax/tax.routes');
const creditLedgerRoutes  = require('./modules/customers/creditLedger.routes');
const erpAutomationRoutes = require('./modules/erp-automation/erp-automation.routes');

const app = express();

// ── CORS ───────────────────────────────────────────────────────────────────────
// Policy and its tests live in config/cors.js. It allows localhost dev, the
// stable production alias, anything in CLIENT_URL, and — crucially — this Vercel
// scope's per-deployment hostnames, which is what /register and /login were
// failing on with a bare "Network Error".
app.use(cors(corsOptions));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitize);
const logContext = require('./middlewares/log.middleware');
app.use(logContext);  // Capture user/shop context for all requests
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Root + Health ──────────────────────────────────────────────────────────────
app.get('/',          (_req, res) => res.json({ message: 'MultiShop API is running', version: '3.0' }));
app.get('/api',       (_req, res) => res.json({ message: 'MultiShop API is running', version: '3.0' }));
app.get('/api/health',(_req, res) => res.json({ status: 'ok', version: '3.0', timestamp: new Date() }));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/shops',         shopRoutes);
app.use('/api/products',      productRoutes);
app.use('/api/sales',         saleRoutes);
app.use('/api/customers',     customerRoutes);
app.use('/api/expenses',      expenseRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/roles',         roleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/demo',          demoRoutes);
app.use('/api/push',          pushRoutes);
app.use('/api/campaigns',     campaignRoutes);
app.use('/api/automations',   automationRoutes);
app.use('/api/notify',        notifyRoutes);
app.use('/api/logs',          logsRoutes);
app.use('/api/alerts',        alertRoutes);
app.use('/api/parser',        parserRoutes);
app.use('/api/tax',           taxRoutes);
app.use('/api/insights',      insightsRoutes);
app.use('/api/inventory',     inventoryRoutes);
app.use('/api/credit-ledger',    creditLedgerRoutes);
app.use('/api/erp-automations', erpAutomationRoutes);

// ── Test-only routes ──────────────────────────────────────────────────────────
// Never mounted in a production process. Provides /db-info (so the E2E runner
// can refuse to run against real data) and /purge (auto-cleanup after a run).
if (process.env.NODE_ENV === 'test' || process.env.USE_TEST_DB === '1') {
  app.use('/api/test-utils', require('./modules/testUtils/testUtils.routes'));
  console.log('⚠️  Test utility routes mounted at /api/test-utils');
}

scheduler.start();

// ── Error handling ─────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
