const { logAction } = require('../utils/logger');

// Capture request context for logging - runs early, attaches to req
const logContext = (req, res, next) => {
  req.logContext = {
    userId: req.user?._id || null,
    shopId: req.query.shopId || req.user?.shops?.[0]?._id || null,
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    method: req.method,
    path: req.path
  };
  
  // Optional: log request entry (very lightweight)
  if (process.env.NODE_ENV === 'development') {
    console.log(`📥 ${req.method} ${req.path} ${req.logContext.userId ? `[user:${req.logContext.userId}]` : ''}`);
  }
  
  next();
};

module.exports = logContext;

