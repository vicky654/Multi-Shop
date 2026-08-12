/**
 * Tax engine tests — plain Node, no test framework needed.
 *   node src/modules/tax/tax.engine.test.js
 *
 * IMPORTANT: the rates in these fixtures are ARBITRARY TEST VALUES, not Indian
 * tax rates. They exist to prove the arithmetic and the refusal behaviour. The
 * engine ships with no rates at all — see taxRules.js for why.
 */
const assert = require('node:assert');
const E = require('./tax.engine');
const { resolveRules, financialYearOf, financialYearRange, emptyRuleSet } = require('./taxRules');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};

// Deliberately round, obviously-fake rates so no reader mistakes them for law.
const FIXTURE = {
  ...emptyRuleSet('2026-27'),
  confirmed: true,
  incomeTax: {
    slabs: [
      { upTo: 100000, ratePct: 0 },
      { upTo: 300000, ratePct: 10 },
      { upTo: null,   ratePct: 20 },
    ],
    firmRatePct: 30,
    companyRatePct: 25,
    surcharge: [{ incomeAbove: 1000000, ratePct: 10 }],
    cessPct: 4,
    standardDeduction: 0,
    rebate: null,
  },
  presumptive44AD: { digitalRatePct: 6, cashRatePct: 8, turnoverLimit: 20000000 },
  gstComposition: { traderRatePct: 1, manufacturerRatePct: 1, restaurantRatePct: 5, turnoverLimit: 15000000 },
  depreciationBlocks: {
    computer:  { label: 'Computers', ratePct: 40 },
    furniture: { label: 'Furniture', ratePct: 10 },
  },
};

console.log('\nFinancial year helpers');

t('April starts a new financial year', () => {
  assert.equal(financialYearOf(new Date('2026-04-01')), '2026-27');
});
t('March still belongs to the previous financial year', () => {
  assert.equal(financialYearOf(new Date('2026-03-31')), '2025-26');
});
t('January belongs to the year that started last April', () => {
  assert.equal(financialYearOf(new Date('2027-01-15')), '2026-27');
});
t('range spans 1 Apr to 31 Mar', () => {
  const { start, end } = financialYearRange('2026-27');
  assert.equal(start.toISOString().slice(0, 10), '2026-04-01');
  assert.equal(end.toISOString().slice(0, 10),   '2027-03-31');
});
t('a malformed year is rejected, not silently zeroed', () => {
  assert.throws(() => financialYearRange('nonsense'), (e) => e.status === 400);
});

console.log('\nThe engine REFUSES to guess when rates are unconfirmed');

t('no rates configured -> income tax estimate is null, not 0', () => {
  const { rules, missing } = resolveRules('2026-27', null);
  assert.ok(missing.includes('incomeTax.slabs'), 'missing list must name the gap');
  const s = E.buildTaxSummary({ grossSales: 1000000, cogs: 600000, expensesDeductible: 100000 }, rules, {});
  assert.equal(s.incomeTax, null, 'must be null, never a guessed number');
  assert.equal(s.afterTaxProfit, null);
  assert.equal(s.confirmed.incomeTaxRates, false);
});
t('accounting figures are still produced without rates', () => {
  const { rules } = resolveRules('2026-27', null);
  const s = E.buildTaxSummary({ grossSales: 1000000, salesReturns: 50000, cogs: 600000, expensesDeductible: 100000 }, rules, {});
  assert.equal(s.sales.netSales, 950000);
  assert.equal(s.grossProfit,    350000);
  assert.equal(s.bookProfit,     250000);
});
t('a disclaimer is always present', () => {
  const { rules } = resolveRules('2026-27', null);
  assert.match(E.buildTaxSummary({}, rules, {}).disclaimer, /not tax advice/i);
});

console.log('\nSlab arithmetic');

t('income inside the nil band pays nothing', () => {
  assert.equal(E.computeIncomeTax(90000, FIXTURE).total, 0);
});
t('only the slice inside each band is taxed', () => {
  // 200000: first 100000 @0 = 0, next 100000 @10% = 10000, +4% cess = 10400
  const r = E.computeIncomeTax(200000, FIXTURE);
  assert.equal(r.tax,   10000);
  assert.equal(r.cess,  400);
  assert.equal(r.total, 10400);
});
t('the open-ended top band applies above the last ceiling', () => {
  // 400000: 0 + 20000 + (100000 @20% = 20000) = 40000 tax, cess 1600
  const r = E.computeIncomeTax(400000, FIXTURE);
  assert.equal(r.tax,   40000);
  assert.equal(r.total, 41600);
});
t('surcharge applies above its threshold, then cess on the total', () => {
  // 2,000,000: tax = 20000 + (1,700,000 @20% = 340,000) = 360,000
  // surcharge 10% = 36,000 ; cess 4% of 396,000 = 15,840
  const r = E.computeIncomeTax(2000000, FIXTURE);
  assert.equal(r.tax,       360000);
  assert.equal(r.surcharge, 36000);
  assert.equal(r.cess,      15840);
  assert.equal(r.total,     411840);
});
t('a rebate can extinguish tax below its threshold', () => {
  const rules = { ...FIXTURE, incomeTax: { ...FIXTURE.incomeTax, rebate: { upToIncome: 250000, maxRebate: 99999 } } };
  assert.equal(E.computeIncomeTax(200000, rules).tax, 0);
});
t('negative or zero income never produces negative tax', () => {
  assert.equal(E.computeIncomeTax(-500, FIXTURE).total, 0);
  assert.equal(E.computeIncomeTax(0, FIXTURE).total, 0);
});

console.log('\nPresumptive taxation (44AD)');

t('deemed profit uses different rates for digital and cash', () => {
  const p = E.computePresumptiveProfit({ digitalTurnover: 1000000, cashTurnover: 500000 }, FIXTURE);
  assert.equal(p.deemedProfit, 100000);   // 60000 + 40000
});
t('expenses do NOT reduce tax under 44AD, and the engine says so', () => {
  const s = E.buildTaxSummary(
    { grossSales: 1000000, cogs: 600000, expensesDeductible: 300000, digitalTurnover: 1000000 },
    FIXTURE, { incomeTaxBasis: 'presumptive_44ad' });
  assert.equal(s.expensesReduceTax, false);
  assert.match(s.expenses.note, /do not reduce/i);
  // Taxable profit is the deemed figure, unaffected by the 300000 of expenses.
  assert.equal(s.estimatedTaxableProfit, 60000);
});
t('44AD ignores the book profit entirely', () => {
  const s = E.buildTaxSummary(
    { grossSales: 1000000, cogs: 990000, digitalTurnover: 1000000 },
    FIXTURE, { incomeTaxBasis: 'presumptive_44ad' });
  assert.equal(s.bookProfit, 10000);            // real book position
  assert.equal(s.estimatedTaxableProfit, 60000); // deemed, higher than book
});
t('exceeding the turnover limit is flagged, not decided', () => {
  const p = E.computePresumptiveProfit({ digitalTurnover: 30000000, cashTurnover: 0 }, FIXTURE);
  assert.equal(p.exceedsLimit, true);
});
t('unset 44AD rates yield null, not a zero deemed profit', () => {
  const { rules } = resolveRules('2026-27', null);
  assert.equal(E.computePresumptiveProfit({ digitalTurnover: 100000 }, rules), null);
});

console.log('\nGST — regular scheme');

t('payable is output GST less eligible ITC', () => {
  const g = E.computeGstPosition({ scheme: 'regular', outputGst: 50000, eligibleItc: 20000, reviewItc: 0 }, FIXTURE);
  assert.equal(g.payable, 30000);
});
t('ITC awaiting review is reported but NEVER credited', () => {
  const g = E.computeGstPosition({ scheme: 'regular', outputGst: 50000, eligibleItc: 20000, reviewItc: 15000 }, FIXTURE);
  assert.equal(g.eligibleItc, 20000);
  assert.equal(g.reviewItc,   15000);
  assert.equal(g.payable,     30000, 'review ITC must not reduce the payable');
});
t('excess credit is a carry-forward, not a negative payable', () => {
  const g = E.computeGstPosition({ scheme: 'regular', outputGst: 10000, eligibleItc: 25000, reviewItc: 0 }, FIXTURE);
  assert.equal(g.payable, 0);
  assert.equal(g.creditCarryForward, 15000);
});

console.log('\nGST — composition scheme');

t('composition grants NO input tax credit and says why', () => {
  const g = E.computeGstPosition(
    { scheme: 'composition', dealerKind: 'trader', outputGst: 50000, eligibleItc: 20000, reviewItc: 0, turnover: 1000000 },
    FIXTURE);
  assert.equal(g.eligibleItc, 0, 'ITC is not available under composition');
  assert.equal(g.itcForgone, 20000, 'the forgone amount is still surfaced as a cost');
  assert.match(g.reason, /not available/i);
});
t('composition levies a flat rate on turnover', () => {
  const g = E.computeGstPosition(
    { scheme: 'composition', dealerKind: 'trader', turnover: 1000000, eligibleItc: 0, reviewItc: 0 }, FIXTURE);
  assert.equal(g.ratePct, 1);
  assert.equal(g.payable, 10000);
});
t('restaurant composition uses its own rate', () => {
  const g = E.computeGstPosition(
    { scheme: 'composition', dealerKind: 'restaurant', turnover: 1000000, eligibleItc: 0, reviewItc: 0 }, FIXTURE);
  assert.equal(g.payable, 50000);
});
t('unconfirmed composition rate yields null payable, not zero', () => {
  const { rules } = resolveRules('2026-27', null);
  const g = E.computeGstPosition({ scheme: 'composition', turnover: 1000000, eligibleItc: 0, reviewItc: 0 }, rules);
  assert.equal(g.payable, null);
  assert.equal(g.confirmed, false);
});

console.log('\nGST — unregistered');

t('unregistered shops get no output tax and no credit', () => {
  const g = E.computeGstPosition({ scheme: 'unregistered', outputGst: 5000, eligibleItc: 3000, reviewItc: 0 }, FIXTURE);
  assert.equal(g.applicable, false);
  assert.equal(g.outputGst, 0);
  assert.equal(g.eligibleItc, 0);
});

console.log('\nDepreciation');

t('written-down-value charge per block', () => {
  const d = E.computeDepreciation([
    { block: 'computer',  label: 'Laptop', openingWdv: 100000 },
    { block: 'furniture', label: 'Shelves', openingWdv: 50000 },
  ], FIXTURE);
  assert.equal(d.total, 45000);          // 40000 + 5000
  assert.equal(d.lines[0].closingWdv, 60000);
});
t('an asset in a block with no confirmed rate is not depreciated', () => {
  const d = E.computeDepreciation([{ block: 'vehicle', openingWdv: 500000 }], FIXTURE);
  assert.equal(d.total, 0);
  assert.equal(d.unratedCount, 1);
  assert.equal(d.confirmed, false);
  assert.equal(d.lines[0].depreciation, null);
});

console.log('\nFull summary — GST is not income');

t('net sales is the taxable value, excluding GST collected', () => {
  const s = E.buildTaxSummary({
    grossSales: 1000000,      // taxable value, GST-exclusive
    outputGst: 50000,         // held for the government, not revenue
    cogs: 600000,
  }, FIXTURE, {});
  assert.equal(s.sales.netSales, 1000000);
  assert.equal(s.grossProfit,     400000);
  // The 50000 of GST must not appear anywhere in the profit chain.
  assert.equal(s.gst.outputGst, 50000);
  assert.equal(s.bookProfit,    400000);
});
t('returns reduce net sales', () => {
  const s = E.buildTaxSummary({ grossSales: 1000000, salesReturns: 100000, cogs: 500000 }, FIXTURE, {});
  assert.equal(s.sales.netSales, 900000);
  assert.equal(s.grossProfit,    400000);
});
t('only deductible expenses reduce profit; review is excluded', () => {
  const s = E.buildTaxSummary({
    grossSales: 1000000, cogs: 500000,
    expensesDeductible: 200000, expensesReview: 80000, expensesNonDeductible: 50000,
  }, FIXTURE, {});
  assert.equal(s.bookProfit, 300000, 'review and non-deductible must not be subtracted');
  assert.equal(s.expenses.review, 80000, 'but review is still surfaced');
});
t('depreciation reduces book profit', () => {
  const s = E.buildTaxSummary({
    grossSales: 1000000, cogs: 500000, expensesDeductible: 100000,
    assets: [{ block: 'computer', openingWdv: 100000 }],
  }, FIXTURE, {});
  assert.equal(s.depreciation.total, 40000);
  assert.equal(s.bookProfit, 360000);
});
t('after-tax profit subtracts the estimated tax', () => {
  const s = E.buildTaxSummary({ grossSales: 500000, cogs: 200000 }, FIXTURE, {});
  assert.equal(s.estimatedTaxableProfit, 300000);
  // 300000: 0 + 20000 tax, cess 800 -> 20800
  assert.equal(s.incomeTax.total, 20800);
  assert.equal(s.afterTaxProfit,  279200);
});
t('firm entity uses the flat firm rate', () => {
  const s = E.buildTaxSummary({ grossSales: 500000, cogs: 200000 }, FIXTURE, { entityType: 'firm' });
  assert.equal(s.incomeTax.tax,   90000);   // 30% of 300000
  assert.equal(s.incomeTax.total, 93600);   // + 4% cess
});
t('company entity uses the flat company rate', () => {
  const s = E.buildTaxSummary({ grossSales: 500000, cogs: 200000 }, FIXTURE, { entityType: 'company' });
  assert.equal(s.incomeTax.tax, 75000);     // 25% of 300000
});
t('a loss-making year produces no tax and a negative profit', () => {
  const s = E.buildTaxSummary({ grossSales: 100000, cogs: 200000 }, FIXTURE, {});
  assert.equal(s.grossProfit, -100000);
  assert.equal(s.incomeTax.total, 0);
});
t('empty input does not throw or produce NaN', () => {
  const s = E.buildTaxSummary({}, FIXTURE, {});
  for (const v of [s.sales.netSales, s.cogs, s.grossProfit, s.bookProfit]) {
    assert.ok(Number.isFinite(v), 'every figure must be a real number');
  }
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
