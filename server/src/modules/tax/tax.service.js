const mongoose   = require('mongoose');
const Sale       = require('../sales/sale.model');
const Expense    = require('../expenses/expense.model');
const TaxProfile = require('./taxProfile.model');
const Shop       = require('../shops/shop.model');
const { buildTaxSummary } = require('./tax.engine');
const { resolveRules, financialYearOf, financialYearRange } = require('./taxRules');
const purchaseService = require('../purchases/purchase.service');

/**
 * Tax & profit aggregations.
 *
 * Every figure here comes from recorded transactions. Nothing is estimated,
 * inferred or invented at this layer — the engine turns these facts into
 * estimates, and only where a human-confirmed rate exists.
 *
 * COGS METHOD — and a known gap
 *   The requested formula is Opening Stock + Purchases − Closing Stock. MultiShop
 *   has NO purchase/GRN ledger and no period stock history (stockSnapshot holds
 *   current state only), so that formula is not computable from existing data.
 *
 *   Instead COGS is summed from sale lines, each of which snapshots the item's
 *   costPrice at the moment of sale. For a shop selling identifiable goods this is
 *   specific-identification COGS and is MORE precise than the periodic formula,
 *   which is an approximation used when per-line cost is unknown.
 *
 *   The periodic reconciliation stays unavailable until a purchase ledger exists.
 *   `cogsMethod` is reported so the UI can say which basis it used rather than
 *   implying a reconciliation that has not happened.
 */

const oid = (v) => (v ? new mongoose.Types.ObjectId(String(v)) : null);

/** Restrict to shops the caller may see. Mirrors reports/shopFilter. */
const shopScope = (user, shopId) => {
  if (shopId) return { shopId: oid(shopId) };
  if (user.role === 'super_admin') return {};
  return { shopId: { $in: (user.shops || []).map(oid) } };
};

/**
 * Sales position for a period.
 *
 * Deliberately separates the taxable value from the GST collected: output GST is
 * money held for the government, not revenue. Refunded sales are netted as
 * returns rather than dropped, so gross and net both reconcile.
 */
async function getSalesPosition(user, shopId, start, end) {
  const match = {
    ...shopScope(user, shopId),
    createdAt: { $gte: start, $lte: end },
    // Cancelled bills never happened; pending ones are not yet income.
    status: { $in: ['completed', 'refunded'] },
  };

  const rows = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        // Taxable value, GST-exclusive. gst.taxableAmount is the engine's own
        // figure; older sales predate it, so fall back to total minus tax.
        taxable: {
          $sum: {
            $cond: [
              { $gt: ['$gst.taxableAmount', 0] },
              '$gst.taxableAmount',
              { $subtract: ['$totalAmount', { $ifNull: ['$taxAmount', 0] }] },
            ],
          },
        },
        outputGst: { $sum: { $ifNull: ['$taxAmount', 0] } },
        count:     { $sum: 1 },
      },
    },
  ]);

  const byStatus = Object.fromEntries(rows.map((r) => [r._id, r]));
  const completed = byStatus.completed || { taxable: 0, outputGst: 0, count: 0 };
  const refunded  = byStatus.refunded  || { taxable: 0, outputGst: 0, count: 0 };

  return {
    grossSales:   +(completed.taxable + refunded.taxable).toFixed(2),
    salesReturns: +refunded.taxable.toFixed(2),
    outputGst:    +(completed.outputGst).toFixed(2),
    billCount:    completed.count,
    returnCount:  refunded.count,
  };
}

/**
 * COGS from sale-line cost snapshots.
 *
 * Uses each item's stored costPrice × quantity, minus the cost of anything
 * refunded, so a returned item's cost does not stay in COGS.
 */
async function getCogs(user, shopId, start, end) {
  const rows = await Sale.aggregate([
    {
      $match: {
        ...shopScope(user, shopId),
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['completed', 'refunded'] },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: null,
        soldCost: {
          $sum: { $multiply: [{ $ifNull: ['$items.costPrice', 0] }, { $ifNull: ['$items.quantity', 0] }] },
        },
        // Refunded units leave stock again, so their cost is not a cost of sale.
        refundedCost: {
          $sum: { $multiply: [{ $ifNull: ['$items.costPrice', 0] }, { $ifNull: ['$items.refundedQty', 0] }] },
        },
      },
    },
  ]);

  const soldCost     = rows[0]?.soldCost     || 0;
  const refundedCost = rows[0]?.refundedCost || 0;
  return {
    cogs: +Math.max(0, soldCost - refundedCost).toFixed(2),
    cogsMethod: 'sale_line_cost',
    // Surfaced so the UI can be explicit about the basis instead of implying a
    // periodic reconciliation that this data cannot support.
    periodicReconciliationAvailable: false,
    periodicReconciliationBlockedBy:
      'No purchase ledger — Opening + Purchases − Closing needs recorded purchases '
      + 'and period stock snapshots, neither of which exist yet.',
  };
}

/**
 * Expenses split by the treatment a human confirmed.
 *
 * 'review' is reported but never counted as a deduction or a credit — that is the
 * whole point of the three-valued flag.
 */
async function getExpensePosition(user, shopId, start, end) {
  const rows = await Expense.aggregate([
    {
      $match: {
        ...shopScope(user, shopId),
        date: { $gte: start, $lte: end },
        // Capital purchases are depreciated, not expensed.
        isCapitalAsset: { $ne: true },
      },
    },
    {
      $group: {
        _id: { deduction: '$deductionStatus', itc: '$itcStatus' },
        amount:    { $sum: '$amount' },
        gstAmount: { $sum: '$gstAmount' },
        count:     { $sum: 1 },
      },
    },
  ]);

  const acc = {
    expensesDeductible: 0, expensesReview: 0, expensesNonDeductible: 0,
    eligibleItc: 0, reviewItc: 0, notEligibleItc: 0,
    counts: { deductible: 0, review: 0, notDeductible: 0, itcReview: 0 },
  };

  for (const r of rows) {
    const { deduction, itc } = r._id;
    if (deduction === 'deductible')          { acc.expensesDeductible += r.amount; acc.counts.deductible += r.count; }
    else if (deduction === 'not_deductible') { acc.expensesNonDeductible += r.amount; acc.counts.notDeductible += r.count; }
    else                                     { acc.expensesReview += r.amount; acc.counts.review += r.count; }

    if (itc === 'eligible')          acc.eligibleItc += r.gstAmount;
    else if (itc === 'not_eligible') acc.notEligibleItc += r.gstAmount;
    else                             { acc.reviewItc += r.gstAmount; acc.counts.itcReview += r.count; }
  }

  for (const k of ['expensesDeductible', 'expensesReview', 'expensesNonDeductible',
                   'eligibleItc', 'reviewItc', 'notEligibleItc']) {
    acc[k] = +acc[k].toFixed(2);
  }
  return acc;
}

/**
 * Turnover split by receipt mode — 44AD deems digital and cash receipts at
 * different rates, so the split has to come from real payment data.
 */
async function getTurnoverByMode(user, shopId, start, end) {
  const rows = await Sale.aggregate([
    {
      $match: {
        ...shopScope(user, shopId),
        createdAt: { $gte: start, $lte: end },
        status: 'completed',
      },
    },
    { $group: { _id: '$paymentMethod', taxable: { $sum: '$totalAmount' } } },
  ]);

  let digital = 0, cash = 0;
  for (const r of rows) {
    if (r._id === 'cash') cash += r.taxable;
    else digital += r.taxable;   // card / upi / credit / split all settle non-cash
  }
  return { digitalTurnover: +digital.toFixed(2), cashTurnover: +cash.toFixed(2) };
}

/** Load (or lazily create) the shop's tax profile. */
async function getProfile(user, shopId) {
  let profile = await TaxProfile.findOne({ shopId: oid(shopId) }).lean();
  if (!profile) {
    profile = {
      shopId, entityType: 'individual', incomeTaxBasis: 'normal',
      gstScheme: 'regular', dealerKind: 'trader', ruleSets: {},
      _unsaved: true,
    };
  }
  return profile;
}

/**
 * The Tax & Profit dashboard for a financial year.
 */
async function getTaxSummary(user, shopId, { financialYear } = {}) {
  const fy = financialYear || financialYearOf();
  const { start, end } = financialYearRange(fy);

  const profile = await getProfile(user, shopId);

  /**
   * The GST scheme lives on the SHOP, not the tax profile.
   *
   * It sits with the GSTIN and state code, it is what Settings → Tax/GST writes,
   * and billing reads it to decide whether to charge GST at all. Reading it from
   * TaxProfile here gave two sources of truth: a shop switched to composition in
   * Settings still showed "regular" on this screen and kept claiming input tax
   * credit it is not entitled to. TaxProfile remains the authority for income-tax
   * basis, entity type and the confirmed rate sets, and its gstScheme is used only
   * as a fallback for profiles written before this was settled.
   */
  const shopDoc = shopId
    ? await Shop.findById(shopId).select('gstScheme').lean()
    : null;
  const effectiveProfile = {
    ...profile,
    gstScheme: shopDoc?.gstScheme || profile.gstScheme || 'regular',
  };

  const stored  = profile.ruleSets instanceof Map
    ? profile.ruleSets.get(fy)
    : profile.ruleSets?.[fy];
  const { rules, missing } = resolveRules(fy, stored || null);

  const [sales, cogsInfo, expenses, turnover, purchases, valuation] = await Promise.all([
    getSalesPosition(user, shopId, start, end),
    getCogs(user, shopId, start, end),
    getExpensePosition(user, shopId, start, end),
    getTurnoverByMode(user, shopId, start, end),
    // Now that a purchase ledger exists, the Purchases term is real data.
    purchaseService.getPurchaseTotals(user, shopId, start, end),
    purchaseService.getStockValuation(user, shopId),
  ]);

  // Opening stock is the one term that cannot be reconstructed — it must have been
  // snapshotted. With it, the periodic COGS figure becomes a real cross-check.
  const openingStock = await purchaseService.getOpeningStock(user, shopId, fy);

  const summary = buildTaxSummary(
    {
      grossSales:   sales.grossSales,
      salesReturns: sales.salesReturns,
      outputGst:    sales.outputGst,
      cogs:         cogsInfo.cogs,
      expensesDeductible:    expenses.expensesDeductible,
      expensesReview:        expenses.expensesReview,
      expensesNonDeductible: expenses.expensesNonDeductible,
      // Purchase GST joins expense GST in the credit position — both are input tax,
      // and both only count once a human has marked them eligible.
      eligibleItc: expenses.eligibleItc + purchases.purchaseGstEligible,
      reviewItc:   expenses.reviewItc   + purchases.purchaseGstReview,
      ...turnover,
      assets: [],   // Phase 2: BusinessAsset records feed depreciation
    },
    rules,
    effectiveProfile
  );

  return {
    ...summary,
    period: { financialYear: fy, start, end },
    counts: { ...expenses.counts, bills: sales.billCount, returns: sales.returnCount },
    cogsMethod: cogsInfo.cogsMethod,
    purchases: {
      value: purchases.purchasesValue,
      units: purchases.units,
      grnCount: purchases.count,
      gstEligible: purchases.purchaseGstEligible,
      gstReview: purchases.purchaseGstReview,
      gstNotEligible: purchases.purchaseGstNotEligible,
    },
    stockValuation: valuation,
    /**
     * Opening + Purchases − Closing is now PARTLY available: purchases are real
     * ledger data and closing stock can be valued. Opening stock cannot be
     * reconstructed for a period that has already begun — there is no historical
     * valuation snapshot to read. So the periodic figure is offered as a
     * cross-check only once an opening snapshot exists for the year, and the
     * sale-line method stays primary until then.
     */
    openingStock: openingStock
      ? { value: openingStock.value, units: openingStock.units,
          takenAt: openingStock.takenAt, takenLate: openingStock.takenLate }
      : null,
    periodicReconciliation: openingStock
      ? {
          available: true,
          openingStockValue: openingStock.value,
          purchasesValue: purchases.purchasesValue,
          closingStockValue: valuation.closingStockValue,
          periodicCogs: Math.round(
            (openingStock.value + purchases.purchasesValue - valuation.closingStockValue) * 100
          ) / 100,
          // Reported, not silently reconciled: a gap between the two methods is
          // real information (shrinkage, damage, unrecorded movement).
          saleLineCogs: cogsInfo.cogs,
          note: openingStock.takenLate
            ? 'Opening stock was snapshotted after the year began, so it approximates the '
              + 'position on 1 April rather than measuring it.'
            : null,
        }
      : {
          available: false,
          purchasesValue: purchases.purchasesValue,
          closingStockValue: valuation.closingStockValue,
          blockedBy: 'Opening stock for this year has not been recorded. '
            + 'Use "Record Opening Stock" on the Purchases screen; purchases and closing '
            + 'stock are already available.',
        },
    itcNotEligible: expenses.notEligibleItc,
    // Names the exact rate paths still unset, so the UI can tell the owner what
    // to ask their accountant for instead of a vague "not configured".
    missingRates: missing,
    profileConfigured: !profile._unsaved,
  };
}

/** Items needing a human decision before they can affect any estimate. */
async function getReviewQueue(user, shopId, { financialYear, limit = 100 } = {}) {
  const fy = financialYear || financialYearOf();
  const { start, end } = financialYearRange(fy);

  return Expense.find({
    ...shopScope(user, shopId),
    date: { $gte: start, $lte: end },
    $or: [{ deductionStatus: 'review' }, { itcStatus: 'review' }],
  })
    .sort({ date: -1 })
    .limit(Math.min(Number(limit) || 100, 500))
    .lean();
}

module.exports = {
  getTaxSummary,
  getReviewQueue,
  getSalesPosition,
  getCogs,
  getExpensePosition,
  getTurnoverByMode,
  getProfile,
};
