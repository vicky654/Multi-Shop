/**
 * DB connection helper tests — plain Node, no test framework needed.
 *   node src/config/db.test.js
 *
 * Covers the DNS-failure classifier and the mode/URI safety rules. The
 * classifier matters because a false negative loses the retry that actually
 * fixes "querySrv EREFUSED", and a false positive retries a genuine auth or
 * network failure through a different resolver for no reason.
 */
const assert = require('node:assert');
const { looksLikeDnsFailure, fallbackDnsServers, resolveUri } = require('./db');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};

// resolveUri reads process.env, so snapshot and restore around each case.
const withEnv = (patch, fn) => {
  const saved = { ...process.env };
  try {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    return fn();
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
};

console.log('\nDNS failure classification');

t('the real Atlas SRV refusal is recognised', () => {
  // Verbatim from the crash this was written for.
  const err = new Error('querySrv EREFUSED _mongodb._tcp.cluster0.vteutgq.mongodb.net');
  err.code = 'EREFUSED';
  assert.equal(looksLikeDnsFailure(err), true);
});
t('recognised by message alone when no code is attached', () => {
  assert.equal(
    looksLikeDnsFailure(new Error('querySrv EREFUSED _mongodb._tcp.example.net')),
    true
  );
});
t('recognised by code alone when the message is unhelpful', () => {
  assert.equal(looksLikeDnsFailure(Object.assign(new Error('nope'), { code: 'ESERVFAIL' })), true);
});
t('other DNS codes are covered', () => {
  for (const code of ['ETIMEOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ENODATA']) {
    assert.equal(looksLikeDnsFailure(Object.assign(new Error('x'), { code })), true, code);
  }
});

console.log('\nNon-DNS failures must NOT trigger a resolver switch');

t('bad credentials are not treated as DNS', () => {
  const err = new Error('Authentication failed.');
  err.code = 8000;
  assert.equal(looksLikeDnsFailure(err), false);
});
t('IP-not-whitelisted is not treated as DNS', () => {
  assert.equal(
    looksLikeDnsFailure(new Error('Could not connect to any servers in your MongoDB Atlas cluster')),
    false
  );
});
t('a plain server-selection timeout is not treated as DNS', () => {
  assert.equal(looksLikeDnsFailure(new Error('Server selection timed out after 30000 ms')), false);
});
t('null / undefined are handled without throwing', () => {
  assert.equal(looksLikeDnsFailure(null), false);
  assert.equal(looksLikeDnsFailure(undefined), false);
  assert.equal(looksLikeDnsFailure({}), false);
});

console.log('\nFallback resolver configuration');

t('defaults to Google + Cloudflare', () => {
  withEnv({ DNS_SERVERS: undefined }, () => {
    assert.deepEqual(fallbackDnsServers(), ['8.8.8.8', '1.1.1.1']);
  });
});
t('DNS_SERVERS overrides the list and tolerates spaces', () => {
  withEnv({ DNS_SERVERS: '9.9.9.9 , 149.112.112.112' }, () => {
    assert.deepEqual(fallbackDnsServers(), ['9.9.9.9', '149.112.112.112']);
  });
});
t('DNS_SERVERS= (empty) disables the fallback entirely', () => {
  // Explicit opt-out for networks where overriding DNS would break split-horizon
  // resolution. `??` in the implementation is what makes this honoured.
  withEnv({ DNS_SERVERS: '' }, () => {
    assert.deepEqual(fallbackDnsServers(), []);
  });
});

console.log('\nDatabase mode safety (unchanged behaviour)');

t('development mode uses MONGODB_URI', () => {
  withEnv({ NODE_ENV: 'development', USE_TEST_DB: undefined, USE_DEMO_DB: undefined,
            MONGODB_URI: 'mongodb://localhost:27017/multi-shop' }, () => {
    const r = resolveUri();
    assert.equal(r.mode, 'development');
    assert.equal(r.isTest, false);
  });
});
t('test mode refuses to run without TEST_DATABASE_URI', () => {
  withEnv({ NODE_ENV: 'test', TEST_DATABASE_URI: undefined }, () => {
    assert.throws(() => resolveUri(), /TEST_DATABASE_URI is not set/);
  });
});
t('test mode refuses a URI identical to production', () => {
  withEnv({ NODE_ENV: 'test',
            MONGODB_URI: 'mongodb+srv://x/multi-shop-test',
            TEST_DATABASE_URI: 'mongodb+srv://x/multi-shop-test' }, () => {
    assert.throws(() => resolveUri(), /identical to MONGODB_URI/);
  });
});
t('test mode refuses a database name that does not look like a test db', () => {
  withEnv({ NODE_ENV: 'test', MONGODB_URI: 'mongodb+srv://x/prod',
            TEST_DATABASE_URI: 'mongodb+srv://x/multi-shop' }, () => {
    assert.throws(() => resolveUri(), /does not contain "test"/);
  });
});
t('test mode accepts a properly named test database', () => {
  withEnv({ NODE_ENV: 'test', MONGODB_URI: 'mongodb+srv://x/multi-shop',
            TEST_DATABASE_URI: 'mongodb+srv://x/multi-shop-test' }, () => {
    const r = resolveUri();
    assert.equal(r.isTest, true);
    assert.equal(r.label, 'TEST DATABASE');
  });
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
