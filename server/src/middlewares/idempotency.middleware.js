const Idempotency = require('../models/idempotency.model');

/**
 * idempotencyMiddleware — attach to any mutating route (POST only).
 *
 * Client sends:  X-Idempotency-Key: <uuid>
 *
 * First request:  processes normally, stores response body under the key.
 * Retry request:  returns stored response instantly, skips handler.
 * No header:      passes through without any idempotency check.
 *
 * Errors are NOT cached — only 2xx responses are stored.
 */
async function idempotencyMiddleware(req, res, next) {
  const key = req.headers['x-idempotency-key'];
  if (!key) return next();

  try {
    // ── Check for existing result ──────────────────────────────────────────────
    const existing = await Idempotency.findOne({ key }).lean();
    if (existing) {
      // Return cached result — do NOT call next()
      return res.json(existing.response);
    }

    // ── Intercept res.json to cache the first successful response ─────────────
    const originalJson = res.json.bind(res);

    res.json = async function (body) {
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await Idempotency.create({
            key,
            response: body,
            path:     `${req.method} ${req.path}`,
            userId:   req.user?._id,
          });
        } catch (err) {
          // Duplicate key on concurrent race — safe to ignore
          if (err.code !== 11000) console.error('[Idempotency] cache write failed:', err.message);
        }
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    // Idempotency failure is non-fatal — let the request proceed
    console.error('[Idempotency] middleware error:', err.message);
    next();
  }
}

module.exports = idempotencyMiddleware;
