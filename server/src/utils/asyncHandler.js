const { logError, LOG_ACTIONS } = require('./logger');

// Enhanced async handler with auto error logging (non-blocking)
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    // Auto log error if context available (fire-and-forget)
    if (req.logContext) {
      logError(req, LOG_ACTIONS.ERROR, 'asyncHandler', err.message, {
        stack: err.stack ? err.stack.substring(0, 500) : '',
        path: req.path,
        method: req.method
      });
    }
    next(err);
  });
};

module.exports = asyncHandler;
