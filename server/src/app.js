const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const { errorHandler, notFound } = require('./middlewares/error.middleware');

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

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '2.1', timestamp: new Date() }));

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

// ── Error handling ─────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
