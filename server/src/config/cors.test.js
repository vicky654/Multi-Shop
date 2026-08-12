/**
 * CORS origin policy tests — plain Node, no test framework needed.
 *   node src/config/cors.test.js
 *
 * These matter more than most: the pattern branch exists so per-deployment Vercel
 * URLs work, and a sloppy regex there would open the API to anybody's Vercel site.
 */
const assert = require('node:assert');
const { buildOriginPolicy } = require('./cors');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};

const { isAllowed } = buildOriginPolicy({});

console.log('\nOrigins that must be allowed');

t('the per-deployment URL that was failing in the browser', () => {
  assert.equal(isAllowed('https://multi-shop-1ntjazzi0-vicky654s-projects.vercel.app'), true);
});
t('any future deployment in the same Vercel scope', () => {
  assert.equal(isAllowed('https://multi-shop-abc123xyz-vicky654s-projects.vercel.app'), true);
  assert.equal(isAllowed('https://some-other-name-vicky654s-projects.vercel.app'), true);
});
t('the stable production alias', () => {
  assert.equal(isAllowed('https://multi-shop-tawny.vercel.app'), true);
});
t('local development origins', () => {
  assert.equal(isAllowed('http://localhost:4000'), true);
  assert.equal(isAllowed('http://127.0.0.1:4000'), true);
});

console.log('\nOrigins that must be blocked');

t('another Vercel account cannot call the API', () => {
  assert.equal(isAllowed('https://evil-attacker.vercel.app'), false);
});
t('a lookalike project name in the wrong scope is blocked', () => {
  // The scope suffix is the whole security boundary — this is the case a bare
  // /\.vercel\.app$/ would have wrongly allowed.
  assert.equal(isAllowed('https://multi-shop-evil.vercel.app'), false);
  assert.equal(isAllowed('https://multi-shop-hash-someone-elses-projects.vercel.app'), false);
});
t('a trailing-domain spoof cannot match', () => {
  assert.equal(isAllowed('https://multi-shop-x-vicky654s-projects.vercel.app.evil.com'), false);
  assert.equal(isAllowed('https://vicky654s-projects.vercel.app.evil.com'), false);
});
t('an http:// downgrade of a scoped host is blocked', () => {
  assert.equal(isAllowed('http://multi-shop-x-vicky654s-projects.vercel.app'), false);
});
t('a prefixed-domain spoof cannot match', () => {
  assert.equal(isAllowed('https://evil.com/https://multi-shop-x-vicky654s-projects.vercel.app'), false);
});
t('an uppercase-scope host does not sneak past the lowercase class', () => {
  // Browsers always send a lowercased host, so rejecting this is correct and
  // documents that the matcher is deliberately not case-insensitive.
  assert.equal(isAllowed('https://MULTI-SHOP-X-vicky654s-projects.vercel.app'), false);
});
t('an unrelated production domain is blocked', () => {
  assert.equal(isAllowed('https://example.com'), false);
});

console.log('\nEnvironment configuration');

t('CLIENT_URL adds exact origins', () => {
  const { isAllowed: check } = buildOriginPolicy({ CLIENT_URL: 'https://shop.example.com' });
  assert.equal(check('https://shop.example.com'), true);
  assert.equal(check('https://other.example.com'), false);
});
t('CLIENT_URL accepts a comma-separated list with stray spaces', () => {
  const { isAllowed: check } = buildOriginPolicy({
    CLIENT_URL: 'https://a.example.com , https://b.example.com',
  });
  assert.equal(check('https://a.example.com'), true);
  assert.equal(check('https://b.example.com'), true);
});
t('VERCEL_SCOPES replaces the default scope', () => {
  const { isAllowed: check } = buildOriginPolicy({ VERCEL_SCOPES: 'acme-team' });
  assert.equal(check('https://anything-acme-team.vercel.app'), true);
  // Overriding must genuinely replace, not silently append the old default.
  assert.equal(check('https://x-vicky654s-projects.vercel.app'), false);
});
t('VERCEL_SCOPES supports multiple scopes', () => {
  const { isAllowed: check } = buildOriginPolicy({ VERCEL_SCOPES: 'team-a,team-b' });
  assert.equal(check('https://x-team-a.vercel.app'), true);
  assert.equal(check('https://y-team-b.vercel.app'), true);
  assert.equal(check('https://z-team-c.vercel.app'), false);
});
t('a scope containing regex metacharacters is escaped, not interpreted', () => {
  const { isAllowed: check } = buildOriginPolicy({ VERCEL_SCOPES: 'a.b' });
  assert.equal(check('https://x-a.b.vercel.app'), true);
  assert.equal(check('https://x-aXb.vercel.app'), false);   // '.' must be literal
});
t('static origins survive an empty environment', () => {
  const { isAllowed: check } = buildOriginPolicy({ CLIENT_URL: '', VERCEL_SCOPES: '' });
  assert.equal(check('http://localhost:4000'), true);
  assert.equal(check('https://multi-shop-tawny.vercel.app'), true);
  // With no scopes configured, the pattern branch must simply be inert.
  assert.equal(check('https://x-vicky654s-projects.vercel.app'), false);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
