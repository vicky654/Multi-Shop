const mongoose = require('mongoose');
const dns      = require('node:dns');

/**
 * Resolve which database to connect to.
 *
 * Three modes, each isolated from the others:
 *   development (default) → MONGODB_URI        — real working data
 *   test  (NODE_ENV=test) → TEST_DATABASE_URI  — E2E specs create/delete records
 *   demo  (NODE_ENV=demo) → DEMO_DATABASE_URI  — disposable marketing-asset data
 *
 * Test and demo modes MUST use their own database and MUST NOT be the production
 * one: the E2E suite deletes records and the demo seeder wipes the database
 * outright, so pointing either at live data destroys real financial records.
 * We fail fast rather than silently falling back to MONGODB_URI.
 */
const MODES = {
  test: { envVar: 'TEST_DATABASE_URI', mustMatch: /test/i, label: 'TEST DATABASE' },
  demo: { envVar: 'DEMO_DATABASE_URI', mustMatch: /demo/i, label: 'DEMO DATABASE' },
};

const activeMode = () => {
  if (process.env.NODE_ENV === 'test' || process.env.USE_TEST_DB === '1') return 'test';
  if (process.env.NODE_ENV === 'demo' || process.env.USE_DEMO_DB === '1') return 'demo';
  return null;
};

const resolveUri = () => {
  const mode = activeMode();

  if (!mode) {
    return {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/multi-shop',
      isTest: false,
      mode: 'development',
    };
  }

  const { envVar, mustMatch, label } = MODES[mode];
  const uri = process.env[envVar];

  if (!uri) {
    throw new Error(
      `${envVar} is not set. Refusing to run in ${mode} mode against the production ` +
      `database — add ${envVar} to server/.env (see .env.example).`
    );
  }

  if (process.env.MONGODB_URI && uri === process.env.MONGODB_URI) {
    throw new Error(
      `${envVar} is identical to MONGODB_URI. Point ${mode} mode at a separate database.`
    );
  }

  // Belt and braces: the database name must look the part, so a copy-paste of
  // the production URI can never slip through.
  const dbName = uri.split('/').pop().split('?')[0];
  if (!mustMatch.test(dbName)) {
    throw new Error(
      `${envVar} database name "${dbName}" does not contain "${mode}". ` +
      `Rename it (e.g. multi-shop-${mode}) so ${mode} runs cannot target real data.`
    );
  }

  return { uri, isTest: mode === 'test', isDemo: mode === 'demo', mode, label };
};

// ── DNS fallback for mongodb+srv:// ───────────────────────────────────────────
//
// WHY THIS EXISTS
//   A `mongodb+srv://` URI is not a hostname — the driver must first resolve a
//   DNS SRV record (_mongodb._tcp.<host>) plus a TXT record. Plenty of ISP and
//   router resolvers REFUSE SRV queries outright, and Node's resolver treats the
//   first REFUSED as fatal rather than trying the next configured server. The
//   result is a startup crash reading
//       ❌ DB connection failed: querySrv EREFUSED _mongodb._tcp.<cluster>
//   which looks intermittent (it depends on resolver order and cache state) but
//   is really a hard "this resolver won't answer SRV" every time.
//
//   Measured on the affected machine: system resolvers 0/3, public DNS 3/3.
//
//   So: try the system resolvers FIRST — corporate/split-horizon DNS and local
//   Mongo instances must keep working — and only on a DNS-shaped failure retry
//   through a public resolver. Override the fallback list with DNS_SERVERS, or
//   set DNS_SERVERS= (empty) to disable the fallback entirely.
const DNS_ERROR_CODES = new Set([
  'EREFUSED', 'ESERVFAIL', 'ETIMEOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ENODATA', 'ECONNREFUSED',
]);

// Exported for tests: misclassifying here would either mask a real connection
// failure behind a pointless retry, or skip the retry that actually fixes things.
const looksLikeDnsFailure = (err) =>
  DNS_ERROR_CODES.has(err?.code)
  || /querySrv|queryTxt|EREFUSED|ESERVFAIL|ENOTFOUND|EAI_AGAIN/i.test(err?.message || '');

const fallbackDnsServers = () =>
  (process.env.DNS_SERVERS ?? '8.8.8.8,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Connect, retrying through public resolvers if the SRV lookup fails.
 *
 * Extracted from connectDB so CLI scripts can use it too. seed.js used to call
 * `mongoose.connect` directly and therefore had no fallback at all — which is
 * backwards, because a hand-run seed is exactly where the flaky Atlas SRV lookup
 * is most likely to be hit and most annoying (`querySrv ESERVFAIL`).
 *
 * @param {string} uri
 * @param {object} [options]
 */
const connectWithDnsFallback = async (uri, options = {}) => {
  const opts = {
    // Without this the driver waits 30s by default anyway, but being explicit
    // means a bad resolver surfaces predictably instead of appearing to hang.
    serverSelectionTimeoutMS: Number(process.env.DB_TIMEOUT_MS) || 30000,
    ...options,
  };

  try {
    await mongoose.connect(uri, opts);
    return;
  } catch (err) {
    const fallback = fallbackDnsServers();
    const retryable = uri.startsWith('mongodb+srv://')
      && looksLikeDnsFailure(err)
      && fallback.length > 0;

    if (!retryable) throw err;

    console.warn(
      `⚠️  DNS lookup failed (${err.code || 'SRV'}) via system resolvers `
      + `[${dns.getServers().join(', ')}]`
    );
    console.warn(`   Retrying through [${fallback.join(', ')}] — override with DNS_SERVERS.`);

    dns.setServers(fallback);
    await mongoose.connect(uri, opts);
    console.log('✅ Connected after switching DNS resolvers.');
  }
};

const connectDB = async () => {
  const { uri, mode, label } = resolveUri();
  await connectWithDnsFallback(uri);

  console.log(
    `📦 MongoDB connected: ${mongoose.connection.host} / ${mongoose.connection.name}` +
    (label ? `  ⚠️  ${label}` : '')
  );
  return { mode };
};

module.exports = connectDB;
module.exports.connectWithDnsFallback = connectWithDnsFallback;
module.exports.resolveUri = resolveUri;
module.exports.looksLikeDnsFailure = looksLikeDnsFailure;
module.exports.fallbackDnsServers = fallbackDnsServers;
