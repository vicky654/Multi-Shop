/**
 * CORS origin policy.
 *
 * WHY THIS IS ITS OWN MODULE
 *   The matcher is security-relevant and no longer a simple array lookup, so it
 *   needs to be testable without booting the app (requiring app.js starts the
 *   scheduler and a DB connection). cors.test.js exercises it directly.
 *
 * THE PROBLEM IT SOLVES
 *   Vercel mints a NEW hostname for EVERY deployment, shaped
 *       https://<project>-<hash>-<scope>.vercel.app
 *   An exact allowlist therefore only ever matches the stable production alias.
 *   Opening any other deployment URL — which is what the Vercel dashboard links
 *   to — was rejected, and the browser surfaced that to the user as a bare
 *   "Network Error" on register/login with no actionable detail.
 *
 * WHY THE PATTERNS ARE SCOPE-BOUND
 *   Only this Vercel account can create hostnames ending in
 *   "-<scope>.vercel.app". A blanket /\.vercel\.app$/ would let ANY Vercel user
 *   deploy a page that calls this API from a victim's browser — and `credentials`
 *   is enabled — so the scope suffix is what keeps this from being a hole.
 *   The regexes are anchored at both ends so neither an http:// downgrade nor a
 *   trailing-domain spoof ("...vercel.app.evil.com") can match.
 */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STATIC_ORIGINS = [
  'http://localhost:4000',
  'http://localhost:3000',
  'http://localhost:5001',
  'http://127.0.0.1:4000',
  'https://multishop-backend-9jbg.onrender.com',
  'https://multi-shop-tawny.vercel.app',
];

/** Build the policy from the environment. Exported for tests. */
function buildOriginPolicy(env = process.env) {
  const allowed = [
    ...STATIC_ORIGINS,
    // Extra exact origins (comma-separated), e.g.
    //   CLIENT_URL=https://multi-shop-tawny.vercel.app,https://shop.example.com
    ...(env.CLIENT_URL ? env.CLIENT_URL.split(',').map((u) => u.trim()).filter(Boolean) : []),
  ];

  // Extra Vercel scopes (comma-separated) via VERCEL_SCOPES.
  // `??` not `||`: setting VERCEL_SCOPES= (empty) is a deliberate way to switch
  // pattern matching off entirely, and `||` would silently restore the default.
  const patterns = (env.VERCEL_SCOPES ?? 'vicky654s-projects')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((scope) => new RegExp(`^https://[a-z0-9-]+-${escapeRegex(scope)}\\.vercel\\.app$`));

  const isAllowed = (origin) =>
    allowed.includes(origin) || patterns.some((rx) => rx.test(origin));

  return { allowed, patterns, isAllowed };
}

const policy = buildOriginPolicy();

/** Ready-made options object for the `cors` middleware. */
const corsOptions = {
  origin: (origin, callback) => {
    // No Origin header at all: mobile apps, Postman, server-to-server.
    if (!origin) return callback(null, true);
    if (policy.isAllowed(origin)) return callback(null, true);
    // Passing an Error here surfaced as a 500 from the error handler, which is
    // both a misleading status for a policy decision and pure log noise. `false`
    // omits the CORS headers and lets the browser block the response, which is
    // what a CORS rejection is supposed to look like.
    console.warn(`[CORS] blocked origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
};

module.exports = {
  corsOptions,
  buildOriginPolicy,
  isAllowedOrigin: policy.isAllowed,
  ALLOWED_ORIGINS: policy.allowed,
};
