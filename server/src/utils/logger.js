const Log = require('../models/Log');
const { LOG_ACTIONS } = require('../constants/logActions');

const isDev = process.env.NODE_ENV === 'development';

const safeMetadata = (meta = {}) => {
  const safe = {};
  Object.entries(meta).forEach(([key, value]) => {
    if (value && (typeof value === 'string' ? value.length <= 500 : 
          typeof value === 'number' || typeof value === 'boolean' || 
          (Array.isArray(value) && value.length <= 20))) {
      safe[key] = value;
    }
  });
  return safe;
};

// Fire-and-forget: no await, non-blocking
const createLog = (context, action, module, message, status = 'success', metadata = {}) => {
  const logData = {
    ...context,
    action,
    module,
    message,
    status,
    metadata: safeMetadata(metadata)
  };

  // Non-blocking save
  Log.create(logData).catch(err => {
    // Silent fail - don't crash app
    if (isDev) console.error('Logger failed:', err.message);
  });

  // Dev console
  if (isDev) {
    const prefix = `[${status.toUpperCase()}]`;
    console.log(prefix, `${module}.${action}`, message, context.userId ? `user:${context.userId}` : '', Object.keys(metadata).length ? `meta:${JSON.stringify(metadata).slice(0,100)}...` : '');
  }
};

const logAction = (req, action, module, message = '', metadata = {}) => {
  if (!req.logContext) return;
  createLog(req.logContext, action, module, message, 'success', metadata);
};

const logError = (req, action, module, message = '', metadata = {}) => {
  if (!req.logContext) return;
  createLog(req.logContext, action || LOG_ACTIONS.ERROR, module, message, 'error', metadata);
};

const logInfo = (req, module, message, metadata = {}) => {
  logAction(req, 'INFO', module, message, metadata);
};

module.exports = { logAction, logError, logInfo, LOG_ACTIONS };

