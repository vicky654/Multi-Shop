/**
 * Recursively trims strings and removes keys that start with `$` (NoSQL injection).
 * Applied globally in app.js before routes.
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue; // strip MongoDB operators from user input
    clean[key] = typeof value === 'string'
      ? value.trim()
      : sanitizeObject(value);
  }
  return clean;
}

const sanitize = (req, _res, next) => {
  if (req.body)   req.body   = sanitizeObject(req.body);
  if (req.query)  req.query  = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
};

module.exports = sanitize;
