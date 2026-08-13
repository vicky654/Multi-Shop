/**
 * GST configuration validation tests — plain Node, no test framework needed.
 *   node src/modules/shops/gstConfig.test.js
 *
 * These guard the rules that a single schema field cannot express, and the
 * derivation that a `pre('save')` hook was supposed to do but never did on the
 * Settings update path.
 */
const assert = require('node:assert');
const { normaliseGstUpdate, assertGstCoherence } = require('./shop.service');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};
const rejects = (fn, re) => assert.throws(fn, (e) => {
  assert.equal(e.status, 400, `expected 400, got ${e.status}`);
  assert.match(e.message, re);
  return true;
});

// A real Punjab (03) GSTIN with a valid check digit — the suite's existing fixture.
const GSTIN_PB = '27AAPFU0939F1ZV';   // state 27 = Maharashtra

console.log('\nGSTIN validation');

t('a valid GSTIN is accepted and upper-cased', () => {
  const out = normaliseGstUpdate({ gstNumber: GSTIN_PB.toLowerCase() });
  assert.equal(out.gstNumber, GSTIN_PB);
});
t('a bad check digit is rejected', () => {
  rejects(() => normaliseGstUpdate({ gstNumber: '27AAPFU0939F1ZA' }), /Invalid GSTIN/i);
});
t('a wrong-length GSTIN is rejected', () => {
  rejects(() => normaliseGstUpdate({ gstNumber: '27AAPFU0939F1Z' }), /Invalid GSTIN/i);
});
t('an empty GSTIN is allowed (shop not registered yet)', () => {
  const out = normaliseGstUpdate({ gstNumber: '' });
  assert.equal(out.gstNumber, '');
});
t('surrounding whitespace is trimmed', () => {
  assert.equal(normaliseGstUpdate({ gstNumber: `  ${GSTIN_PB} ` }).gstNumber, GSTIN_PB);
});

console.log('\nstateCode derivation — the bug this fixes');

t('stateCode is DERIVED from the GSTIN on update', () => {
  // The schema hook that did this only ran on save(), never on the
  // findOneAndUpdate that Settings uses, so the code went stale.
  const out = normaliseGstUpdate({ gstNumber: GSTIN_PB });
  assert.equal(out.stateCode, '27');
});
t('a stale stateCode is overwritten, not preserved', () => {
  const out = normaliseGstUpdate({ gstNumber: GSTIN_PB, stateCode: '27' });
  assert.equal(out.stateCode, '27');
});
t('clearing the GSTIN clears the stateCode', () => {
  // Leaving a state behind with no document to back it would keep driving the
  // CGST/SGST vs IGST split from a registration that no longer exists.
  const out = normaliseGstUpdate({ gstNumber: '' });
  assert.equal(out.stateCode, '');
});
t('a stateCode contradicting the GSTIN is REJECTED, not silently fixed', () => {
  rejects(() => normaliseGstUpdate({ gstNumber: GSTIN_PB, stateCode: '03' }),
    /does not match the GSTIN/i);
});
t('an unknown state code is rejected', () => {
  rejects(() => normaliseGstUpdate({ stateCode: '99' }), /Unknown state code/i);
});
t('a known state code alone is accepted', () => {
  assert.equal(normaliseGstUpdate({ stateCode: '03' }).stateCode, '03');
});

console.log('\nScheme coherence');

t('switching TO regular without a GSTIN is refused', () => {
  rejects(() => assertGstCoherence({ gstNumber: '', gstScheme: 'unregistered' },
                                   { gstScheme: 'regular', gstNumber: '' }),
    /GSTIN is required/i);
});
t('switching TO composition without a GSTIN is refused', () => {
  rejects(() => assertGstCoherence({ gstNumber: '', gstScheme: 'unregistered' },
                                   { gstScheme: 'composition', gstNumber: '' }),
    /GSTIN is required/i);
});
t('clearing the GSTIN while on a registered scheme is refused', () => {
  rejects(() => assertGstCoherence({ gstNumber: GSTIN_PB, gstScheme: 'regular' },
                                   { gstNumber: '' }),
    /GSTIN is required/i);
});
t('an unrelated edit on a shop that already lacks a GSTIN is ALLOWED', () => {
  // The old rule blocked this: a seeded shop with no GSTIN and the default
  // 'regular' scheme could not save even its invoice prefix.
  assertGstCoherence({ gstNumber: '', gstScheme: 'regular' }, { invoicePrefix: 'ABC' });
  assertGstCoherence({ gstNumber: '', gstScheme: 'regular' }, { taxRate: 5 });
});
t('switching to unregistered without a GSTIN is allowed', () => {
  assertGstCoherence({ gstNumber: '', gstScheme: 'regular' }, { gstScheme: 'unregistered' });
});
t('supplying a GSTIN while switching to regular is allowed', () => {
  assertGstCoherence({ gstNumber: '', gstScheme: 'unregistered' },
                     { gstScheme: 'regular', gstNumber: GSTIN_PB });
});
t('unregistered scheme may have no GSTIN', () => {
  const out = normaliseGstUpdate({ gstScheme: 'unregistered', gstNumber: '' });
  assert.equal(out.gstScheme, 'unregistered');
});
t('normalise no longer owns the coherence rule (it needs the stored state)', () => {
  // Must NOT throw here — the merged-state check in assertGstCoherence does it.
  const out = normaliseGstUpdate({ gstScheme: 'regular' });
  assert.equal(out.gstScheme, 'regular');
});
t('regular scheme with a valid GSTIN is accepted', () => {
  const out = normaliseGstUpdate({ gstScheme: 'regular', gstNumber: GSTIN_PB });
  assert.equal(out.gstScheme, 'regular');
  assert.equal(out.stateCode, '27');
});
t('an unknown scheme is rejected', () => {
  rejects(() => normaliseGstUpdate({ gstScheme: 'whatever' }), /must be regular, composition or unregistered/i);
});
t('changing scheme alone does not require re-sending the GSTIN', () => {
  // gstNumber undefined = "not being changed", which must not be read as empty.
  const out = normaliseGstUpdate({ gstScheme: 'composition' });
  assert.equal(out.gstScheme, 'composition');
});

console.log('\nPrice mode');

t('exclusive and inclusive are accepted', () => {
  assert.equal(normaliseGstUpdate({ gstMode: 'exclusive' }).gstMode, 'exclusive');
  assert.equal(normaliseGstUpdate({ gstMode: 'inclusive' }).gstMode, 'inclusive');
});
t('an unknown price mode is rejected', () => {
  rejects(() => normaliseGstUpdate({ gstMode: 'sometimes' }), /must be exclusive or inclusive/i);
});

console.log('\nDefault rate');

t('a rate inside 0-100 is accepted and coerced to a number', () => {
  assert.strictEqual(normaliseGstUpdate({ taxRate: '18' }).taxRate, 18);
});
t('0% is a legitimate rate', () => {
  assert.strictEqual(normaliseGstUpdate({ taxRate: 0 }).taxRate, 0);
});
t('a negative rate is rejected', () => {
  rejects(() => normaliseGstUpdate({ taxRate: -5 }), /between 0 and 100/i);
});
t('a rate above 100 is rejected', () => {
  rejects(() => normaliseGstUpdate({ taxRate: 101 }), /between 0 and 100/i);
});
t('a non-numeric rate is rejected, not coerced to 0', () => {
  rejects(() => normaliseGstUpdate({ taxRate: 'eighteen' }), /between 0 and 100/i);
});

console.log('\nInvoice prefix & round-off');

t('a prefix is upper-cased and trimmed', () => {
  assert.equal(normaliseGstUpdate({ invoicePrefix: '  inv ' }).invoicePrefix, 'INV');
});
t('slashes and hyphens are allowed', () => {
  assert.equal(normaliseGstUpdate({ invoicePrefix: 'INV/A-1' }).invoicePrefix, 'INV/A-1');
});
t('an empty prefix is rejected', () => {
  rejects(() => normaliseGstUpdate({ invoicePrefix: '   ' }), /cannot be empty/i);
});
t('unsafe characters are rejected', () => {
  // The prefix ends up inside a stored document reference and a filename.
  rejects(() => normaliseGstUpdate({ invoicePrefix: 'IN<>V' }), /letters, numbers/i);
});
t('an over-long prefix is rejected', () => {
  rejects(() => normaliseGstUpdate({ invoicePrefix: 'ABCDEFGHIJK' }), /max 10/i);
});
t('round-off is coerced to a boolean', () => {
  assert.strictEqual(normaliseGstUpdate({ invoiceRoundOff: 'yes' }).invoiceRoundOff, true);
  assert.strictEqual(normaliseGstUpdate({ invoiceRoundOff: 0 }).invoiceRoundOff, false);
});

console.log('\nUnrelated fields pass through untouched');

t('a name-only update is not treated as a GST change', () => {
  const out = normaliseGstUpdate({ name: 'New Name' });
  assert.equal(out.name, 'New Name');
  // Absent keys must stay absent, or a partial update would clear GST config.
  assert.equal('gstNumber' in out, false);
  assert.equal('stateCode' in out, false);
  assert.equal('gstScheme' in out, false);
});
t('upiSettings are left alone', () => {
  const out = normaliseGstUpdate({ upiSettings: { enabled: true, vpa: 'a@b' } });
  assert.deepEqual(out.upiSettings, { enabled: true, vpa: 'a@b' });
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
