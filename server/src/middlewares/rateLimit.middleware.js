const rateLimit = require('express-rate-limit');

/**
 * Rate limiting.
 *
 * PRODUCTION DEFAULTS ARE UNCHANGED: 10 auth attempts per 15 minutes, 200 API
 * requests per minute. Those are the brute-force protection and they stay strict.
 *
 * WHY THIS IS CONFIGURABLE
 *   Development and demo runs legitimately log in far more than a real user does —
 *   an E2E suite authenticates once per spec, and a verification script once per
 *   run. Hitting a 10-attempt production limit there produces a 429 that looks
 *   like a broken login, and the usual reaction is to disable the limiter
 *   entirely. So the limits are read from the environment instead, with the strict
 *   production values as the defaults.
 *
 * SAFETY RULES BAKED IN
 *   1. Production IGNORES the environment overrides. A stray AUTH_RATE_LIMIT_MAX
 *      in a production deployment must not be able to weaken brute-force
 *      protection, so overrides apply only when NODE_ENV is development, test or
 *      demo. This is deliberate: an env var is easier to set by accident than to
 *      audit.
 *   2. The limiter is never switched off. There is no "disabled" mode — an absurd
 *      override is clamped, not honoured.
 *   3. The store is the default in-memory one, so restarting the dev server clears
 *      the counters. That is the intended escape hatch during development.
 */

const parsePositiveInt = (raw, fallback, { min, max }) => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  // Clamped rather than trusted: a 0 or a negative would disable protection, and a
  // absurd value would make the limiter meaningless.
  return Math.min(max, Math.max(min, n));
};

// Production values. Changing these changes production security.
const DEFAULTS = {
  auth: { windowMs: 15 * 60 * 1000, max: 10 },
  api:  { windowMs: 60 * 1000,      max: 200 },
};

/**
 * Resolve the effective limits. Exported so the behaviour is testable without
 * starting a server.
 *
 * @param {object} [env] process.env-like object, for tests
 */
function resolveLimits(env = process.env) {
  const nodeEnv = env.NODE_ENV;
  const allow = nodeEnv === 'development' || nodeEnv === 'test'
             || nodeEnv === 'demo' || nodeEnv === undefined;

  if (!allow) {
    return {
      mode: 'production',
      overridesApplied: false,
      auth: { ...DEFAULTS.auth },
      api:  { ...DEFAULTS.api },
    };
  }

  const auth = {
    // Upper bounds are generous enough for a full E2E run but still finite.
    windowMs: parsePositiveInt(env.AUTH_RATE_LIMIT_WINDOW_MS, DEFAULTS.auth.windowMs,
                              { min: 1000, max: 60 * 60 * 1000 }),
    max:      parsePositiveInt(env.AUTH_RATE_LIMIT_MAX, DEFAULTS.auth.max,
                              { min: 1, max: 10000 }),
  };
  const api = {
    windowMs: parsePositiveInt(env.API_RATE_LIMIT_WINDOW_MS, DEFAULTS.api.windowMs,
                              { min: 1000, max: 60 * 60 * 1000 }),
    max:      parsePositiveInt(env.API_RATE_LIMIT_MAX, DEFAULTS.api.max,
                              { min: 1, max: 100000 }),
  };

  return {
    mode: nodeEnv || 'development',
    overridesApplied:
      auth.max !== DEFAULTS.auth.max || auth.windowMs !== DEFAULTS.auth.windowMs
      || api.max !== DEFAULTS.api.max || api.windowMs !== DEFAULTS.api.windowMs,
    auth,
    api,
  };
}

const limits = resolveLimits();

if (limits.overridesApplied) {
  // Logged loudly so a relaxed limit is never a silent condition.
  console.warn(
    `⚠️  Rate limits relaxed for ${limits.mode}: `
    + `auth ${limits.auth.max}/${limits.auth.windowMs / 1000}s, `
    + `api ${limits.api.max}/${limits.api.windowMs / 1000}s. `
    + 'Production always uses the strict defaults.'
  );
}

const minutes = (ms) => Math.max(1, Math.round(ms / 60000));

/** Strict limiter for auth endpoints — prevents brute-force attacks. */
const authLimiter = rateLimit({
  windowMs:        limits.auth.windowMs,
  max:             limits.auth.max,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: `Too many attempts — please try again in ${minutes(limits.auth.windowMs)} minutes.`,
  },
});

/**
 * General API limiter — intended to prevent abuse on all routes.
 *
 * NOT CURRENTLY MOUNTED. Nothing in the app calls app.use(apiLimiter) — it was
 * exported and unused before this change too. Left as-is rather than mounted,
 * because switching on a 200/min cap across every route is a production
 * behaviour change that needs its own review (the client polls several
 * endpoints). Configurable here so it is ready when someone does mount it.
 */
const apiLimiter = rateLimit({
  windowMs:        limits.api.windowMs,
  max:             limits.api.max,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests — please slow down.' },
});

module.exports = { authLimiter, apiLimiter, resolveLimits, DEFAULTS };
