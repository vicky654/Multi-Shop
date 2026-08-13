/**
 * Rate-limit configuration tests — plain Node, no test framework needed.
 *   node src/middlewares/rateLimit.test.js
 *
 * The point of these is not that the numbers parse. It is that PRODUCTION CANNOT
 * BE WEAKENED by an environment variable, and that no configuration path can turn
 * the limiter off. Those two properties are the security of the login endpoint, so
 * they get tests that fail loudly if someone relaxes them later.
 */
const assert = require('node:assert');
const { resolveLimits, DEFAULTS } = require('./rateLimit.middleware');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};

// The strict values that ship. Written literally, not read from DEFAULTS, so that
// silently editing DEFAULTS breaks these tests instead of quietly passing.
const PROD_AUTH_MAX      = 10;
const PROD_AUTH_WINDOW   = 15 * 60 * 1000;
const PROD_API_MAX       = 200;
const PROD_API_WINDOW    = 60 * 1000;

t('the shipped defaults are the documented strict values', () => {
  assert.equal(DEFAULTS.auth.max, PROD_AUTH_MAX);
  assert.equal(DEFAULTS.auth.windowMs, PROD_AUTH_WINDOW);
  assert.equal(DEFAULTS.api.max, PROD_API_MAX);
  assert.equal(DEFAULTS.api.windowMs, PROD_API_WINDOW);
});

console.log('\nProduction — overrides must be ignored');

t('production with no env vars uses the strict limits', () => {
  const l = resolveLimits({ NODE_ENV: 'production' });
  assert.equal(l.auth.max, PROD_AUTH_MAX);
  assert.equal(l.auth.windowMs, PROD_AUTH_WINDOW);
  assert.equal(l.mode, 'production');
});
t('AUTH_RATE_LIMIT_MAX=100 does NOT relax production', () => {
  // This is the whole safety property: the same .env that relaxes a demo box must
  // not relax production if it is copied there by mistake.
  const l = resolveLimits({ NODE_ENV: 'production', AUTH_RATE_LIMIT_MAX: '100' });
  assert.equal(l.auth.max, PROD_AUTH_MAX);
  assert.equal(l.overridesApplied, false);
});
t('AUTH_RATE_LIMIT_WINDOW_MS does NOT shrink the production window', () => {
  const l = resolveLimits({ NODE_ENV: 'production', AUTH_RATE_LIMIT_WINDOW_MS: '1000' });
  assert.equal(l.auth.windowMs, PROD_AUTH_WINDOW);
});
t('API overrides do not relax production either', () => {
  const l = resolveLimits({
    NODE_ENV: 'production', API_RATE_LIMIT_MAX: '99999', API_RATE_LIMIT_WINDOW_MS: '1000',
  });
  assert.equal(l.api.max, PROD_API_MAX);
  assert.equal(l.api.windowMs, PROD_API_WINDOW);
});
t('a huge auth override in production is still the strict limit', () => {
  const l = resolveLimits({ NODE_ENV: 'production', AUTH_RATE_LIMIT_MAX: '1000000' });
  assert.equal(l.auth.max, PROD_AUTH_MAX);
});

console.log('\nDevelopment / test / demo — overrides apply');

t('development honours AUTH_RATE_LIMIT_MAX=100', () => {
  const l = resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: '100' });
  assert.equal(l.auth.max, 100);
  assert.equal(l.overridesApplied, true);
});
t('demo honours AUTH_RATE_LIMIT_MAX', () => {
  assert.equal(resolveLimits({ NODE_ENV: 'demo', AUTH_RATE_LIMIT_MAX: '250' }).auth.max, 250);
});
t('test honours AUTH_RATE_LIMIT_MAX', () => {
  assert.equal(resolveLimits({ NODE_ENV: 'test', AUTH_RATE_LIMIT_MAX: '50' }).auth.max, 50);
});
t('an unset NODE_ENV is treated as development', () => {
  const l = resolveLimits({ AUTH_RATE_LIMIT_MAX: '100' });
  assert.equal(l.auth.max, 100);
  assert.equal(l.mode, 'development');
});
t('development without overrides still gets the strict defaults', () => {
  // Relaxation is opt-in. A plain `npm run dev` is as strict as production.
  const l = resolveLimits({ NODE_ENV: 'development' });
  assert.equal(l.auth.max, PROD_AUTH_MAX);
  assert.equal(l.overridesApplied, false);
});
t('the auth window is configurable in development', () => {
  const l = resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_WINDOW_MS: '60000' });
  assert.equal(l.auth.windowMs, 60000);
});
t('the api limits are configurable in development', () => {
  const l = resolveLimits({
    NODE_ENV: 'development', API_RATE_LIMIT_MAX: '2000', API_RATE_LIMIT_WINDOW_MS: '30000',
  });
  assert.equal(l.api.max, 2000);
  assert.equal(l.api.windowMs, 30000);
});
t('overriding one limit leaves the others at their defaults', () => {
  const l = resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: '100' });
  assert.equal(l.auth.windowMs, PROD_AUTH_WINDOW);
  assert.equal(l.api.max, PROD_API_MAX);
});

console.log('\nThe limiter can never be switched off');

t('AUTH_RATE_LIMIT_MAX=0 is clamped to 1, not treated as unlimited', () => {
  // 0 would mean "block everything" in express-rate-limit, and a naive
  // `parsed || default` would silently restore the default instead. Neither is a
  // way to disable the limiter, and neither is what the operator meant.
  assert.equal(resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: '0' }).auth.max, 1);
});
t('a negative max is clamped to 1', () => {
  assert.equal(resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: '-5' }).auth.max, 1);
});
t('an absurd max is clamped to the ceiling, not honoured', () => {
  const l = resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: '99999999' });
  assert.equal(l.auth.max, 10000);
});
t('a non-numeric max falls back to the strict default', () => {
  assert.equal(
    resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: 'unlimited' }).auth.max,
    PROD_AUTH_MAX
  );
});
t('an empty-string max falls back to the strict default', () => {
  assert.equal(
    resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: '' }).auth.max,
    PROD_AUTH_MAX
  );
});
t('"false"/"off" do not disable the limiter', () => {
  for (const v of ['false', 'off', 'none', 'null']) {
    assert.equal(resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: v }).auth.max,
      PROD_AUTH_MAX, `"${v}" must not disable the limiter`);
  }
});
t('a sub-second window is clamped up to 1s', () => {
  const l = resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_WINDOW_MS: '1' });
  assert.equal(l.auth.windowMs, 1000);
});
t('a window longer than an hour is clamped to an hour', () => {
  const l = resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_WINDOW_MS: '99999999' });
  assert.equal(l.auth.windowMs, 60 * 60 * 1000);
});
t('a decimal max is truncated to a usable integer', () => {
  assert.equal(resolveLimits({ NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: '25.9' }).auth.max, 25);
});

console.log('\nThe middleware is always mounted');

t('both limiters are exported as middleware functions', () => {
  // If either were conditionally undefined, app.use would throw at boot — but a
  // future "if (!production) skip" would pass silently. Assert they exist.
  const mod = require('./rateLimit.middleware');
  assert.equal(typeof mod.authLimiter, 'function');
  assert.equal(typeof mod.apiLimiter, 'function');
});
t('resolveLimits never returns a falsy or infinite max', () => {
  const envs = [
    { NODE_ENV: 'production' }, { NODE_ENV: 'development' }, { NODE_ENV: 'demo' }, {},
    { NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: '0', API_RATE_LIMIT_MAX: '0' },
    { NODE_ENV: 'development', AUTH_RATE_LIMIT_MAX: 'Infinity' },
  ];
  for (const env of envs) {
    const l = resolveLimits(env);
    for (const k of ['auth', 'api']) {
      assert.ok(l[k].max >= 1 && Number.isFinite(l[k].max), `${k}.max invalid for ${JSON.stringify(env)}`);
      assert.ok(l[k].windowMs >= 1000 && Number.isFinite(l[k].windowMs), `${k}.windowMs invalid`);
    }
  }
});

console.log('\nRestart clears the in-memory counters');

t('neither limiter is given an external store, so state dies with the process', () => {
  // This is what makes "restart the dev server" clear a 429. If someone later adds
  // a Redis store, this test fails and they must update the documented behaviour.
  const src = require('node:fs').readFileSync(`${__dirname}/rateLimit.middleware.js`, 'utf8');
  assert.equal(/\bstore\s*:/.test(src), false,
    'a custom store was added — restart no longer clears the limiter');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
