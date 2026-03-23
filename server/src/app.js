const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const { errorHandler, notFound } = require('./middlewares/error.middleware');
const sanitize                   = require('./middlewares/sanitize.middleware');

// Route imports
const authRoutes          = require('./modules/auth/auth.routes');
const shopRoutes          = require('./modules/shops/shop.routes');
const productRoutes       = require('./modules/products/product.routes');
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

const app = express();

// ── CORS — allow localhost dev + any configured production URL ─────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:4000',
  'http://localhost:3000',
  'http://localhost:5001',
  'https://multishop-backend-9jbg.onrender.com',
  'https://multi-shop-tawny.vercel.app',
  // Production frontends — add your Vercel / Netlify URL in CLIENT_URL env var
  // e.g. CLIENT_URL=https://multi-shop-tawny.vercel.app
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((u) => u.trim()) : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitize);
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

scheduler.start();

// ── Error handling ─────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
