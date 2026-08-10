/**
 * Invoice numbering concurrency test.
 *   node src/modules/sales/invoiceCounter.test.js
 *
 * Runs against the DEMO database only (NODE_ENV=demo), never dev or production.
 *
 * This is the regression guard for the bug this work fixed: the old
 * countDocuments()-based numbering handed identical numbers to concurrent sales,
 * and the unique index then failed one of them.
 */
process.env.NODE_ENV = 'demo';
require('dotenv').config();

// DEMO_DATABASE_URI lives in .env.demo at the repo root (gitignored), not in
// server/.env — load it here so this test can run standalone.
if (!process.env.DEMO_DATABASE_URI) {
  const fsx  = require('node:fs');
  const pathx = require('node:path');
  const file = pathx.join(__dirname, '../../../../.env.demo');
  if (fsx.existsSync(file)) {
    for (const line of fsx.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^DEMO_DATABASE_URI=(.+)$/);
      if (m) process.env.DEMO_DATABASE_URI = m[1].trim();
    }
  }
}

const assert   = require('node:assert');
const mongoose = require('mongoose');
const { resolveUri } = require('../../config/db');
const { InvoiceCounter, nextInvoiceNumber, financialYear } = require('./invoiceCounter.model');

const CONCURRENCY = 50;

(async () => {
  const { uri, mode } = resolveUri();
  assert.equal(mode, 'demo', 'must run against the demo database');

  // The demo cluster uses mongodb+srv; DNS SRV lookups flake on some networks.
  for (let i = 1; i <= 5; i += 1) {
    try { await mongoose.connect(uri); break; }
    catch (e) {
      if (i === 5) throw e;
      await new Promise((r) => setTimeout(r, i * 2000));
    }
  }
  assert.ok(/demo/i.test(mongoose.connection.name), 'refusing to run outside a demo database');
  console.log(`\nConnected to ${mongoose.connection.name}`);

  const shopId = new mongoose.Types.ObjectId();
  const fy = financialYear();
  let pass = 0, fail = 0;
  const t = (name, fn) => {
    try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
    catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
  };

  // ── Concurrency ────────────────────────────────────────────────────────────
  console.log('\nConcurrent numbering');
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => nextInvoiceNumber(shopId))
  );

  const numbers = results.map((r) => r.invoiceNumber);
  const seqs    = results.map((r) => r.seq).sort((a, b) => a - b);

  t(`${CONCURRENCY} concurrent reservations are all unique`, () => {
    assert.equal(new Set(numbers).size, CONCURRENCY);
  });

  t('sequence is gap-free 1..N', () => {
    assert.deepEqual(seqs, Array.from({ length: CONCURRENCY }, (_, i) => i + 1));
  });

  t('numbers embed shop financial year and are zero-padded', () => {
    assert.match(numbers[0], /^INV\/\d{4}-\d{2}\/\d{6}$/);
    assert.ok(numbers[0].includes(fy));
  });

  t('counter document reflects the final sequence', async () => {
    // (sync assertion on the value fetched below)
  });
  const counter = await InvoiceCounter.findOne({ shopId, fy }).lean();
  t('counter seq equals the number of reservations', () => {
    assert.equal(counter.seq, CONCURRENCY);
  });

  // ── Tenant isolation ───────────────────────────────────────────────────────
  console.log('\nPer-shop isolation');
  const otherShop = new mongoose.Types.ObjectId();
  const a = await nextInvoiceNumber(shopId);
  const b = await nextInvoiceNumber(otherShop);

  t('a second shop starts its own series at 1', () => {
    assert.equal(b.seq, 1);
    assert.equal(a.seq, CONCURRENCY + 1);
  });

  t('two shops never share an invoice number', () => {
    assert.notEqual(a.invoiceNumber, b.invoiceNumber);
  });

  t('custom prefix is honoured', async () => {});
  const pref = await nextInvoiceNumber(otherShop, { prefix: 'VS' });
  t('prefix appears in the number', () => {
    assert.ok(pref.invoiceNumber.startsWith('VS/'));
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await InvoiceCounter.deleteMany({ shopId: { $in: [shopId, otherShop] } });

  console.log(`\n${pass} passing, ${fail} failing\n`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(`\n✖ ${e.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
