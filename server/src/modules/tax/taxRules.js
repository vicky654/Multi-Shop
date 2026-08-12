/**
 * Year-versioned tax rule registry.
 *
 * WHY RATES ARE NOT HARDCODED HERE
 *   Indian tax rules change by tax year — the Income-tax Act, 2025 applies to tax
 *   years beginning on or after 1 April 2026, replacing the 1961 Act — and a rate
 *   baked into a release is wrong the moment it changes. Worse, a *confidently
 *   wrong* rate in tax software is more damaging than no rate at all: the owner
 *   would file against a number this module invented.
 *
 *   So this module ships the SHAPE of each year's rules with values unset and
 *   `confirmed: false`. The engine refuses to produce an income-tax or
 *   composition-GST estimate until a shop's accountant supplies and confirms the
 *   figures (stored on TaxProfile). Until then the dashboard shows the accounting
 *   figures it CAN compute — sales, COGS, gross profit, expenses, output GST,
 *   eligible ITC — and an explicit "rates not confirmed" state for the tax lines.
 *
 *   This is deliberate. It is not a placeholder to be filled in with guesses.
 *
 * WHAT IS SAFE TO HARDCODE
 *   Structure, not amounts: that income tax uses slabs plus surcharge plus cess,
 *   that 44AD deems profit as a percentage of turnover with different rates for
 *   digital and cash receipts, that composition levies a flat percentage of
 *   turnover, that depreciation runs on written-down-value blocks. Those shapes
 *   are stable; the numbers are not.
 */

/** Financial year for a date, e.g. 2026-04-01 -> '2026-27' (India: Apr–Mar). */
function financialYearOf(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  // Jan–Mar belong to the FY that started the previous April.
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Start/end instants of a financial year string. */
function financialYearRange(fy) {
  const startYear = Number(String(fy).slice(0, 4));
  if (!Number.isFinite(startYear)) throw Object.assign(new Error(`Invalid financial year "${fy}"`), { status: 400 });
  return {
    start: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)),          // 1 Apr
    end:   new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59)),  // 31 Mar
  };
}

/**
 * The rule TEMPLATE for a year. Every monetary/rate value is null until an
 * accountant supplies it, which is what keeps this module from asserting tax law.
 */
const emptyRuleSet = (fy) => ({
  financialYear: fy,
  statute: null,          // e.g. 'Income-tax Act, 2025' — set by the accountant
  confirmed: false,
  confirmedBy: null,
  confirmedAt: null,

  incomeTax: {
    // Ordered bands: [{ upTo: number|null (null = no ceiling), ratePct: number }]
    slabs: [],
    // Flat rates for non-individual entities, when applicable.
    firmRatePct: null,
    companyRatePct: null,
    // [{ incomeAbove: number, ratePct: number }] applied to tax, then cess on total.
    surcharge: [],
    cessPct: null,
    // Standard/other deductions the accountant wants applied before slabs.
    standardDeduction: null,
    rebate: null,          // { upToIncome, maxRebate }
  },

  presumptive44AD: {
    // Deemed profit as a % of turnover. Digital and cash receipts differ.
    digitalRatePct: null,
    cashRatePct: null,
    turnoverLimit: null,   // eligibility ceiling
  },

  gstComposition: {
    // Flat % of turnover by dealer kind; ITC is not available under this scheme.
    traderRatePct: null,
    manufacturerRatePct: null,
    restaurantRatePct: null,
    turnoverLimit: null,
  },

  // { blockKey: { label, ratePct } } — written-down-value blocks.
  depreciationBlocks: {},
});

/**
 * Known years. Present so the UI can offer a picker and so a year the software
 * has never heard of is an explicit error rather than a silent zero.
 */
const KNOWN_YEARS = ['2024-25', '2025-26', '2026-27', '2027-28'];

/** Asset block keys the UI offers. Rates come from the confirmed rule set. */
const ASSET_BLOCKS = {
  computer:        'Computers & software',
  pos_machine:     'POS / billing machines',
  printer:         'Printers & peripherals',
  furniture:       'Furniture & fittings',
  air_conditioner: 'Air conditioners',
  equipment:       'Shop equipment',
  vehicle:         'Vehicles',
  building:        'Building / premises',
};

/**
 * Resolve the rules to use for a year, merging whatever the shop's accountant has
 * confirmed over the empty template.
 *
 * @param {string} fy               financial year, e.g. '2026-27'
 * @param {object} [override]       TaxProfile.ruleSets[fy] as stored
 * @returns {{ rules: object, missing: string[] }} missing = rate paths still unset
 */
function resolveRules(fy, override = null) {
  const base = emptyRuleSet(fy);
  const rules = override
    ? {
        ...base,
        ...override,
        incomeTax:          { ...base.incomeTax,          ...(override.incomeTax || {}) },
        presumptive44AD:    { ...base.presumptive44AD,    ...(override.presumptive44AD || {}) },
        gstComposition:     { ...base.gstComposition,     ...(override.gstComposition || {}) },
        depreciationBlocks: { ...base.depreciationBlocks, ...(override.depreciationBlocks || {}) },
      }
    : base;

  // Report exactly what is missing so the UI can name it, rather than showing a
  // vague "not configured".
  const missing = [];
  if (!rules.incomeTax.slabs?.length)       missing.push('incomeTax.slabs');
  if (rules.incomeTax.cessPct === null)     missing.push('incomeTax.cessPct');
  if (rules.presumptive44AD.digitalRatePct === null) missing.push('presumptive44AD.digitalRatePct');
  if (rules.presumptive44AD.cashRatePct === null)    missing.push('presumptive44AD.cashRatePct');
  if (rules.gstComposition.traderRatePct === null)   missing.push('gstComposition.traderRatePct');

  return { rules, missing };
}

module.exports = {
  financialYearOf,
  financialYearRange,
  emptyRuleSet,
  resolveRules,
  KNOWN_YEARS,
  ASSET_BLOCKS,
};
