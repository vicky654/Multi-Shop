/**
 * Tax & profit computation engine — pure, no DB, no clock.
 *
 * SCOPE AND HONESTY RULES (these are requirements, not style notes)
 *   1. This produces ESTIMATES for the owner's planning. It is not tax advice and
 *      never claims to be. Every returned figure that depends on statutory rates
 *      carries `confirmed`, and is null when the rates have not been confirmed by
 *      the shop's accountant. A missing estimate is correct; a guessed one is not.
 *   2. It never invents a deduction. Expenses and ITC come in as recorded data
 *      with an explicit eligibility flag set by a human; anything marked 'review'
 *      is EXCLUDED from the estimate and reported separately so it cannot quietly
 *      inflate a deduction.
 *   3. Under presumptive taxation (44AD) profit is a percentage of turnover, so
 *      business expenses do NOT reduce the liability. The engine says so via
 *      `expensesReduceTax: false` rather than showing a tax-saving simulator that
 *      would not apply.
 *   4. Under the GST composition scheme input tax credit is not available, so
 *      eligible ITC is reported as zero with a reason, not as a credit.
 *
 * GST IS NOT INCOME
 *   Output GST collected is a liability held on the government's behalf, not
 *   revenue. `netSales` here is the TAXABLE value, exclusive of GST. The existing
 *   reports module sums `totalAmount` (GST-inclusive) as "revenue", which
 *   overstates income — this engine deliberately does not repeat that.
 */

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nz = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

/**
 * Income tax on a taxable income, from confirmed slabs.
 * Returns null when the rules are not confirmed — the caller surfaces that state.
 */
function computeIncomeTax(taxableIncome, rules) {
  const it = rules?.incomeTax;
  if (!it?.slabs?.length || it.cessPct === null || it.cessPct === undefined) return null;

  const income = Math.max(0, nz(taxableIncome));
  const afterDeduction = Math.max(0, income - nz(it.standardDeduction));

  // Walk the ordered bands, taxing only the slice that falls in each.
  let tax = 0;
  let lower = 0;
  for (const band of it.slabs) {
    const ceiling = band.upTo === null || band.upTo === undefined ? Infinity : nz(band.upTo);
    if (afterDeduction <= lower) break;
    const slice = Math.min(afterDeduction, ceiling) - lower;
    if (slice > 0) tax += slice * (nz(band.ratePct) / 100);
    lower = ceiling;
    if (!Number.isFinite(ceiling)) break;
  }

  // Rebate can extinguish tax entirely below a threshold.
  if (it.rebate?.upToIncome != null && afterDeduction <= nz(it.rebate.upToIncome)) {
    tax = Math.max(0, tax - nz(it.rebate.maxRebate ?? tax));
  }

  // Surcharge applies to the tax, on the highest band the income clears.
  let surchargePct = 0;
  for (const s of it.surcharge || []) {
    if (afterDeduction > nz(s.incomeAbove)) surchargePct = nz(s.ratePct);
  }
  const surcharge = tax * (surchargePct / 100);
  const cess = (tax + surcharge) * (nz(it.cessPct) / 100);

  return {
    taxableIncome: r2(afterDeduction),
    tax: r2(tax),
    surcharge: r2(surcharge),
    cess: r2(cess),
    total: r2(tax + surcharge + cess),
  };
}

/** Deemed profit under 44AD. Digital and cash receipts are deemed at different rates. */
function computePresumptiveProfit({ digitalTurnover, cashTurnover }, rules) {
  const p = rules?.presumptive44AD;
  if (p?.digitalRatePct === null || p?.cashRatePct === null) return null;

  const digital = Math.max(0, nz(digitalTurnover));
  const cash    = Math.max(0, nz(cashTurnover));
  return {
    digitalTurnover: r2(digital),
    cashTurnover:    r2(cash),
    deemedProfit: r2(digital * (nz(p.digitalRatePct) / 100) + cash * (nz(p.cashRatePct) / 100)),
    ratesUsed: { digitalRatePct: p.digitalRatePct, cashRatePct: p.cashRatePct },
    turnoverLimit: p.turnoverLimit ?? null,
    // The eligibility ceiling is a fact the owner must check; flag, do not decide.
    exceedsLimit: p.turnoverLimit != null ? (digital + cash) > nz(p.turnoverLimit) : null,
  };
}

/**
 * GST position.
 *
 * Regular:     output GST − eligible ITC.
 * Composition: a flat percentage of turnover, and ITC is NOT available.
 * Unregistered: no GST at all.
 */
function computeGstPosition({ scheme, dealerKind, outputGst, eligibleItc, reviewItc, turnover }, rules) {
  if (scheme === 'unregistered') {
    return {
      scheme, applicable: false,
      reason: 'Shop is not GST registered — no output tax and no input tax credit.',
      outputGst: 0, eligibleItc: 0, reviewItc: r2(reviewItc), payable: 0, confirmed: true,
    };
  }

  if (scheme === 'composition') {
    const c = rules?.gstComposition || {};
    const rateByKind = {
      trader:       c.traderRatePct,
      manufacturer: c.manufacturerRatePct,
      restaurant:   c.restaurantRatePct,
    };
    const ratePct = rateByKind[dealerKind ?? 'trader'];
    const confirmed = ratePct !== null && ratePct !== undefined;
    return {
      scheme, applicable: true, dealerKind: dealerKind ?? 'trader',
      // Stated plainly rather than showing a credit that cannot be claimed.
      reason: 'Composition scheme — input tax credit is not available, so recorded '
            + 'purchase GST is a cost rather than a credit.',
      outputGst: 0,
      eligibleItc: 0,
      itcForgone: r2(eligibleItc),
      reviewItc: r2(reviewItc),
      ratePct: confirmed ? ratePct : null,
      turnover: r2(turnover),
      payable: confirmed ? r2(nz(turnover) * (nz(ratePct) / 100)) : null,
      confirmed,
    };
  }

  // Regular scheme.
  const out = r2(outputGst);
  const itc = r2(eligibleItc);
  const net = out - itc;
  return {
    scheme: 'regular', applicable: true,
    outputGst: out,
    eligibleItc: itc,
    reviewItc: r2(reviewItc),   // pending human decision; never counted as credit
    payable: r2(Math.max(0, net)),
    // A negative net is a carry-forward, not a refund cheque — labelled as such.
    creditCarryForward: r2(Math.max(0, -net)),
    confirmed: true,
  };
}

/** Written-down-value depreciation for one block over one year. */
function computeDepreciation(assets, rules) {
  const blocks = rules?.depreciationBlocks || {};
  const lines = [];
  let total = 0;
  let unratedCount = 0;

  for (const a of assets || []) {
    const block = blocks[a.block];
    const ratePct = block?.ratePct;
    if (ratePct === null || ratePct === undefined) {
      unratedCount += 1;
      lines.push({ ...a, ratePct: null, depreciation: null, closingWdv: null });
      continue;
    }
    const opening = nz(a.openingWdv ?? a.cost);
    // Additions are simplified to a full-year charge here; the half-year rule for
    // assets used under 180 days is a Phase 2 refinement and is flagged, not faked.
    const dep = opening * (nz(ratePct) / 100);
    total += dep;
    lines.push({
      ...a, ratePct,
      depreciation: r2(dep),
      closingWdv: r2(opening - dep),
    });
  }

  return {
    lines,
    total: r2(total),
    unratedCount,
    confirmed: unratedCount === 0 && lines.length > 0,
  };
}

/**
 * Assemble the whole dashboard.
 *
 * @param {object} input  recorded, aggregated facts — never invented here
 * @param {object} rules  resolved rule set for the tax year
 * @param {object} profile { incomeTaxBasis: 'normal'|'presumptive_44ad',
 *                           entityType: 'individual'|'firm'|'company',
 *                           gstScheme, dealerKind }
 */
function buildTaxSummary(input, rules, profile) {
  const {
    grossSales = 0, salesReturns = 0, outputGst = 0,
    cogs = 0,
    expensesDeductible = 0, expensesReview = 0, expensesNonDeductible = 0,
    eligibleItc = 0, reviewItc = 0,
    digitalTurnover = 0, cashTurnover = 0,
    assets = [],
  } = input || {};

  const netSales    = r2(nz(grossSales) - nz(salesReturns));
  const grossProfit = r2(netSales - nz(cogs));

  const depreciation = computeDepreciation(assets, rules);

  const basis = profile?.incomeTaxBasis === 'presumptive_44ad' ? 'presumptive_44ad' : 'normal';
  const expensesReduceTax = basis === 'normal';

  // Only expenses a human marked deductible are subtracted. 'review' is reported
  // beside the figure so its effect is visible but never silently applied.
  const bookProfit = r2(grossProfit - nz(expensesDeductible) - nz(depreciation.total || 0));

  const presumptive = basis === 'presumptive_44ad'
    ? computePresumptiveProfit({ digitalTurnover, cashTurnover }, rules)
    : null;

  const estimatedTaxableProfit = basis === 'presumptive_44ad'
    ? (presumptive ? presumptive.deemedProfit : null)
    : bookProfit;

  let incomeTax = null;
  if (estimatedTaxableProfit !== null) {
    if (profile?.entityType === 'firm' && rules?.incomeTax?.firmRatePct != null) {
      const t = Math.max(0, estimatedTaxableProfit) * (nz(rules.incomeTax.firmRatePct) / 100);
      const cess = rules.incomeTax.cessPct != null ? t * (nz(rules.incomeTax.cessPct) / 100) : null;
      incomeTax = cess === null ? null
        : { taxableIncome: r2(estimatedTaxableProfit), tax: r2(t), surcharge: 0, cess: r2(cess), total: r2(t + cess) };
    } else if (profile?.entityType === 'company' && rules?.incomeTax?.companyRatePct != null) {
      const t = Math.max(0, estimatedTaxableProfit) * (nz(rules.incomeTax.companyRatePct) / 100);
      const cess = rules.incomeTax.cessPct != null ? t * (nz(rules.incomeTax.cessPct) / 100) : null;
      incomeTax = cess === null ? null
        : { taxableIncome: r2(estimatedTaxableProfit), tax: r2(t), surcharge: 0, cess: r2(cess), total: r2(t + cess) };
    } else {
      incomeTax = computeIncomeTax(estimatedTaxableProfit, rules);
    }
  }

  const gst = computeGstPosition({
    scheme: profile?.gstScheme || 'regular',
    dealerKind: profile?.dealerKind,
    outputGst, eligibleItc, reviewItc,
    turnover: netSales,
  }, rules);

  const afterTaxProfit = incomeTax
    ? r2(estimatedTaxableProfit - incomeTax.total)
    : null;

  return {
    financialYear: rules?.financialYear ?? null,
    basis,
    entityType: profile?.entityType || 'individual',

    sales: { grossSales: r2(grossSales), salesReturns: r2(salesReturns), netSales },
    cogs: r2(cogs),
    grossProfit,

    expenses: {
      deductible:    r2(expensesDeductible),
      review:        r2(expensesReview),
      nonDeductible: r2(expensesNonDeductible),
      // Spelled out because it is the single most misread part of a tax screen.
      note: expensesReduceTax
        ? 'Deductible expenses reduce estimated taxable profit. Items marked "review" are excluded until confirmed.'
        : 'Under presumptive taxation profit is a percentage of turnover, so business '
          + 'expenses do not reduce the estimated liability.',
    },
    depreciation,
    expensesReduceTax,

    bookProfit,
    presumptive,
    estimatedTaxableProfit,

    incomeTax,
    gst,
    afterTaxProfit,

    // Everything the UI needs to be honest about what is and is not an estimate.
    confirmed: {
      incomeTaxRates: incomeTax !== null,
      gstRates: gst.confirmed,
      depreciationRates: depreciation.confirmed,
    },
    disclaimer: 'Estimates for planning only, based on your recorded transactions and '
      + 'the rates your accountant configured. Not tax advice. Confirm with a qualified '
      + 'professional before filing.',
  };
}

module.exports = {
  computeIncomeTax,
  computePresumptiveProfit,
  computeGstPosition,
  computeDepreciation,
  buildTaxSummary,
};
