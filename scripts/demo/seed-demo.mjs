/**
 * Step 1 — reset and seed the isolated demo account.
 *
 * Reuses the project's existing seeder (server/seed.js) so demo data stays
 * realistic and in sync with the real schema, then applies demo-only overrides:
 *   - owner credentials taken from .env.demo (never hardcoded)
 *   - fake company branding + generated logo
 *   - every other seeded login gets a random throwaway password, so the
 *     well-known seed passwords can't be used against the demo instance
 *
 * Runs with NODE_ENV=demo, which makes server/src/config/db.js resolve
 * DEMO_DATABASE_URI and refuse to start unless the database name says "demo".
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadDemoEnv, ROOT, step, ok, info } from './lib/env.mjs';

const env = loadDemoEnv();
const SERVER_DIR = path.join(ROOT, 'server');
const require = createRequire(path.join(SERVER_DIR, 'package.json'));

// Inline SVG logo — no network fetch, no binary asset to track.
const buildLogo = (name) => {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#4F46E5"/><stop offset="100%" stop-color="#818CF8"/>
  </linearGradient></defs>
  <rect width="160" height="160" rx="36" fill="url(#g)"/>
  <text x="80" y="104" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="66"
        font-weight="700" fill="#fff" text-anchor="middle">${initials}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

async function main() {
  const TOTAL = 3;

  // ── 1. Run the project seeder against the demo database ────────────────────
  step(1, TOTAL, `Seeding demo database "${env._dbName}" (wipes it first)`);

  // `mongodb+srv://` requires a DNS SRV lookup that fails transiently on flaky
  // networks, so retry the whole seed rather than failing the asset run.
  const runSeeder = () => spawnSync(process.execPath, ['seed.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'demo',
      DEMO_DATABASE_URI: env.DEMO_DATABASE_URI,
    },
    encoding: 'utf8',
  });

  let seed;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    seed = runSeeder();
    if (seed.status === 0) break;

    const raw = `${seed.stdout || ''}${seed.stderr || ''}`;
    const transient = /querySrv|ENOTFOUND|EREFUSED|ESERVFAIL|ETIMEOUT|timed out/i.test(raw);
    if (!transient || attempt === 4) {
      // Surface the seeder's diagnostics, never its connection string
      const safe = raw.replace(/mongodb(\+srv)?:\/\/[^\s"']+/g, 'mongodb://••••').trim();
      throw new Error(
        `Seeder failed (exit ${seed.status}) after ${attempt} attempt(s):\n` +
        (safe ? safe.slice(-1800) : '(seeder produced no output)')
      );
    }
    info(`seed attempt ${attempt} hit a transient DNS/connect error — retrying…`);
    await new Promise((r) => setTimeout(r, attempt * 3000));
  }
  ok('Base data seeded (users, shops, products, customers, sales, expenses, roles)');

  // ── 2. Apply demo-only overrides ───────────────────────────────────────────
  step(2, TOTAL, 'Applying demo credentials and company branding');

  process.env.NODE_ENV = 'demo';
  process.env.DEMO_DATABASE_URI = env.DEMO_DATABASE_URI;

  const mongoose = require('mongoose');
  const { resolveUri } = require(path.join(SERVER_DIR, 'src/config/db.js'));
  const User = require(path.join(SERVER_DIR, 'src/modules/auth/auth.model.js'));
  const Shop = require(path.join(SERVER_DIR, 'src/modules/shops/shop.model.js'));

  const { uri, mode } = resolveUri();
  if (mode !== 'demo') throw new Error(`Expected demo mode, resolved "${mode}"`);

  // `mongodb+srv://` needs a DNS SRV lookup, which fails transiently on flaky
  // networks (querySrv EREFUSED/ESERVFAIL) — retry rather than failing the whole
  // asset run over one bad resolve.
  const connect = async (attempts = 4) => {
    for (let i = 1; i <= attempts; i += 1) {
      try {
        await mongoose.connect(uri);
        return;
      } catch (err) {
        const transient = /querySrv|ENOTFOUND|EREFUSED|ESERVFAIL|ETIMEOUT|timed out/i.test(err.message);
        if (!transient || i === attempts) throw err;
        info(`DNS/connect attempt ${i} failed (${err.code || 'transient'}) — retrying…`);
        await new Promise((r) => setTimeout(r, i * 2000));
      }
    }
  };
  await connect();
  info(`connected to ${mongoose.connection.name}`);

  // Demo owner — credentials come from .env.demo. Assigning plain text is
  // correct here: the User model's pre('save') hook hashes it.
  const owner = await User.findOne({ role: 'owner' });
  if (!owner) throw new Error('Seeded owner not found — did the seeder change?');

  owner.email    = env.DEMO_EMAIL;
  owner.password = env.DEMO_PASSWORD;
  owner.name     = 'Demo Owner';
  await owner.save();
  ok('Demo owner credentials applied from .env.demo');

  // Every other seeded account gets the SAME demo password from .env.demo, so all
  // roles are usable for demos and walkthroughs. The documented seed passwords
  // (owner123 / staff123 …) are still overwritten, so they cannot be used against
  // this instance — but the shared secret means one leak exposes every role, which
  // is acceptable only because this database is disposable and non-production.
  const others = await User.find({ _id: { $ne: owner._id } });
  for (const u of others) {
    u.password = env.DEMO_PASSWORD;
    await u.save();
  }
  ok(`${others.length} other demo logins set to the .env.demo password`);

  // Fake company branding across all shops
  const logo = buildLogo(env.DEMO_COMPANY_NAME);
  const shops = await Shop.find({});
  const suffixes = ['Fashion', 'Toys', 'Footwear', 'Outlet', 'Express'];
  for (const [i, shop] of shops.entries()) {
    shop.name = i === 0
      ? env.DEMO_COMPANY_NAME
      : `${env.DEMO_COMPANY_NAME} — ${suffixes[i % suffixes.length]}`;
    shop.description = env.DEMO_COMPANY_TAGLINE;
    shop.email = `hello@${env.DEMO_COMPANY_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '')}.test`;
    shop.logo = logo;
    await shop.save();
  }
  ok(`${shops.length} shops branded as "${env.DEMO_COMPANY_NAME}"`);

  // ── 3. Summary ─────────────────────────────────────────────────────────────
  step(3, TOTAL, 'Demo account ready');

  const db = mongoose.connection.db;
  const count = (c, q = {}) => db.collection(c).countDocuments(q);

  const [shopDocs, userDocs] = await Promise.all([
    db.collection('shops').find({}).project({ name: 1, type: 1, taxRate: 1 }).toArray(),
    db.collection('users').find({}).project({ name: 1, email: 1, role: 1 }).toArray(),
  ]);

  const [products, customers, sales, expenses, roles, notifs] = await Promise.all([
    count('products'), count('customers'), count('sales'),
    count('expenses'), count('roles'), count('notifications'),
  ]);

  const revenue = await db.collection('sales').aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]).toArray();

  const line = '─'.repeat(74);

  console.log(`\n${line}`);
  console.log(`  DEMO DATA SUMMARY — database: ${mongoose.connection.name}`);
  console.log(line);
  console.log(`  Company    : ${env.DEMO_COMPANY_NAME}`);
  console.log(`  Shops      : ${shopDocs.length}`);
  for (const s of shopDocs) console.log(`               · ${s.name}  (${s.type}, GST ${s.taxRate}%)`);
  console.log(`  Users      : ${userDocs.length}`);
  console.log(`  Products   : ${products}`);
  console.log(`  Customers  : ${customers}`);
  console.log(`  Sales      : ${sales}   (completed revenue ₹${Math.round(revenue[0]?.total || 0).toLocaleString('en-IN')})`);
  console.log(`  Expenses   : ${expenses}`);
  console.log(`  Roles      : ${roles}`);
  console.log(`  Notifs     : ${notifs}`);

  // ── Credentials (terminal only — never written to any file) ────────────────
  console.log(`\n${line}`);
  console.log('  DEMO LOGIN CREDENTIALS  (terminal only — not written to disk)');
  console.log(line);
  console.log(`  ${'EMAIL'.padEnd(34)}${'PASSWORD'.padEnd(20)}ROLE`);
  console.log(`  ${'-'.repeat(34)}${'-'.repeat(20)}${'-'.repeat(16)}`);

  const roleOrder = ['super_admin', 'owner', 'manager', 'billing_staff', 'inventory_staff'];
  userDocs
    .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role))
    .forEach((u) => {
      console.log(`  ${u.email.padEnd(34)}${env.DEMO_PASSWORD.padEnd(20)}${u.role}`);
    });

  console.log(line);
  console.log('  All accounts share the DEMO_PASSWORD from .env.demo.');
  console.log('  Disposable demo database — safe to wipe and reseed at any time.');
  console.log(`${line}\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(`\n✖ Demo seed failed: ${err.message}`);
  process.exit(1);
});
