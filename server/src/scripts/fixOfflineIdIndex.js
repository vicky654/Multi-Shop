/**
 * Migration — repair the Sale.offlineId unique index.
 *
 * THE BUG
 *   sale.model.js declared:
 *     offlineId: { type: String, default: null }
 *     index({ offlineId: 1 }, { unique: true, sparse: true })
 *
 *   A sparse index skips documents where the field is ABSENT — it does NOT skip
 *   documents where the field is present and null. Because `default: null` wrote
 *   an explicit null onto every online sale, the first such sale claimed
 *   { offlineId: null } in the unique index and every subsequent online sale
 *   failed with E11000 → the API returned 409 and billing stopped working.
 *
 * THE FIX
 *   1. Drop the legacy `offlineId_1` index.
 *   2. Unset the stale explicit nulls so the field is simply absent.
 *   3. Recreate the index as PARTIAL over string values only, which genuinely
 *      excludes non-offline sales while still preventing duplicate syncs.
 *
 * Safe to re-run: every step is idempotent.
 *
 *   Usage:  node src/scripts/fixOfflineIdIndex.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const INDEX_NAME = 'offlineId_1';

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set — check your .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const sales = mongoose.connection.db.collection('sales');
  console.log(`Connected to ${mongoose.connection.name}`);

  // ── 1. Inspect the current index ───────────────────────────────────────────
  const indexes = await sales.indexes();
  const existing = indexes.find((i) => i.name === INDEX_NAME);

  if (existing) {
    const isPartial = !!existing.partialFilterExpression;
    console.log(`Found ${INDEX_NAME}:`, JSON.stringify({
      unique: existing.unique, sparse: existing.sparse,
      partialFilterExpression: existing.partialFilterExpression,
    }));

    if (isPartial) {
      console.log('Index is already partial — nothing to drop.');
    } else {
      await sales.dropIndex(INDEX_NAME);
      console.log(`Dropped legacy index ${INDEX_NAME}`);
    }
  } else {
    console.log(`No ${INDEX_NAME} index present.`);
  }

  // ── 2. Clear stale explicit nulls ──────────────────────────────────────────
  const cleared = await sales.updateMany(
    { offlineId: null },
    { $unset: { offlineId: '' } }
  );
  console.log(`Unset offlineId on ${cleared.modifiedCount} sale(s) that held an explicit null`);

  // ── 3. Recreate as a partial unique index ──────────────────────────────────
  await sales.createIndex(
    { offlineId: 1 },
    { unique: true, partialFilterExpression: { offlineId: { $type: 'string' } }, name: INDEX_NAME }
  );
  console.log(`Recreated ${INDEX_NAME} as a partial unique index over string values`);

  const after = (await sales.indexes()).find((i) => i.name === INDEX_NAME);
  console.log('Final index:', JSON.stringify(after));

  await mongoose.disconnect();
  console.log('Done.');
})().catch(async (err) => {
  console.error('Migration failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
