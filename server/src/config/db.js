const mongoose = require('mongoose');

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

const connectDB = async () => {
  const { uri, mode, label } = resolveUri();
  await mongoose.connect(uri);
  console.log(
    `📦 MongoDB connected: ${mongoose.connection.host} / ${mongoose.connection.name}` +
    (label ? `  ⚠️  ${label}` : '')
  );
  return { mode };
};

module.exports = connectDB;
module.exports.resolveUri = resolveUri;
