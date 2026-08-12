const asyncHandler = require('../../utils/asyncHandler');
const { success }  = require('../../utils/response');
const taxService   = require('./tax.service');
const TaxProfile   = require('./taxProfile.model');
const { KNOWN_YEARS, ASSET_BLOCKS, emptyRuleSet, financialYearOf } = require('./taxRules');
const { logAction, LOG_ACTIONS } = require('../../utils/logger');

// ── Dashboard ─────────────────────────────────────────────────────────────────
const summary = asyncHandler(async (req, res) => {
  const data = await taxService.getTaxSummary(req.user, req.query.shopId || null, {
    financialYear: req.query.financialYear,
  });
  success(res, data, 'Tax summary');
});

// ── Items a human must decide on before they affect any estimate ───────────────
const reviewQueue = asyncHandler(async (req, res) => {
  const items = await taxService.getReviewQueue(req.user, req.query.shopId || null, {
    financialYear: req.query.financialYear,
    limit: req.query.limit,
  });
  success(res, { items, count: items.length }, 'Review queue');
});

// ── Configuration ─────────────────────────────────────────────────────────────
const getConfig = asyncHandler(async (req, res) => {
  const profile = await taxService.getProfile(req.user, req.query.shopId);
  const fy = req.query.financialYear || financialYearOf();
  success(res, {
    profile,
    knownYears: KNOWN_YEARS,
    assetBlocks: ASSET_BLOCKS,
    // The template tells the UI exactly which fields an accountant must fill.
    template: emptyRuleSet(fy),
  }, 'Tax configuration');
});

/**
 * Save configuration. Every change is appended to an audit log — tax settings
 * change the numbers an owner may file against, so they are never edited silently.
 */
const saveConfig = asyncHandler(async (req, res) => {
  const { shopId, entityType, incomeTaxBasis, gstScheme, dealerKind,
          financialYear, ruleSet, accountantName, accountantEmail } = req.body;

  if (!shopId) throw Object.assign(new Error('shopId is required'), { status: 400 });

  const profile = await TaxProfile.findOne({ shopId })
    || new TaxProfile({ shopId, ownerId: req.user._id });

  const changes = [];
  const set = (key, value) => {
    if (value === undefined) return;
    if (String(profile[key] ?? '') !== String(value)) {
      changes.push(`${key}: ${profile[key] ?? '—'} -> ${value}`);
      profile[key] = value;
    }
  };
  set('entityType', entityType);
  set('incomeTaxBasis', incomeTaxBasis);
  set('gstScheme', gstScheme);
  set('dealerKind', dealerKind);
  set('accountantName', accountantName);
  set('accountantEmail', accountantEmail);

  if (financialYear && ruleSet) {
    // Stamp who confirmed the rates — the estimate is only as good as this.
    profile.ruleSets.set(financialYear, {
      ...ruleSet,
      confirmed: !!ruleSet.confirmed,
      confirmedBy: ruleSet.confirmed ? req.user._id : null,
      confirmedAt: ruleSet.confirmed ? new Date() : null,
    });
    changes.push(`ruleSet[${financialYear}] updated (confirmed=${!!ruleSet.confirmed})`);
  }

  if (changes.length) {
    profile.auditLog.push({
      by: req.user._id,
      byName: req.user.name || '',
      action: financialYear ? `configure:${financialYear}` : 'configure',
      financialYear: financialYear || '',
      changes,
    });
  }

  await profile.save();
  logAction(req, LOG_ACTIONS.PRODUCT_UPDATE, 'tax',
    `Tax config updated: ${changes.join('; ') || 'no change'}`);

  success(res, { profile }, 'Tax configuration saved');
});

module.exports = { summary, reviewQueue, getConfig, saveConfig };
