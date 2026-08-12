const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');
const svc = require('./purchase.service');
const { logAction, LOG_ACTIONS } = require('../../utils/logger');

const getAll = asyncHandler(async (req, res) => {
  const { purchases, total, page, limit } = await svc.getPurchases(req.user, req.query);
  paginated(res, purchases, total, page, limit, 'Purchases fetched');
});

const create = asyncHandler(async (req, res) => {
  const purchase = await svc.createPurchase(req.user, req.body);
  logAction(req, LOG_ACTIONS.PRODUCT_CREATE, 'purchases',
    `Purchase draft created: ${purchase.supplierName} / ${purchase.invoiceNumber}`);
  success(res, { purchase }, 'Purchase draft created', 201);
});

const update = asyncHandler(async (req, res) => {
  const purchase = await svc.updatePurchase(req.params.id, req.user, req.body);
  logAction(req, LOG_ACTIONS.PRODUCT_UPDATE, 'purchases', `Purchase draft updated: ${req.params.id}`);
  success(res, { purchase }, 'Purchase updated');
});

// Posting is the moment inventory changes, so it is logged as its own event.
const post = asyncHandler(async (req, res) => {
  const purchase = await svc.postPurchase(req.params.id, req.user);
  logAction(req, LOG_ACTIONS.PRODUCT_UPDATE, 'purchases',
    `GRN POSTED: ${purchase.supplierName}/${purchase.invoiceNumber} — `
    + `${purchase.totalUnits} unit(s) received into inventory`);
  success(res, { purchase }, 'Goods received — inventory updated');
});

const cancel = asyncHandler(async (req, res) => {
  const purchase = await svc.cancelPurchase(req.params.id, req.user, { reason: req.body?.reason });
  logAction(req, LOG_ACTIONS.PRODUCT_UPDATE, 'purchases',
    `GRN CANCELLED: ${purchase.supplierName}/${purchase.invoiceNumber} — inventory movement reversed`);
  success(res, { purchase }, 'Purchase cancelled — inventory movement reversed');
});

const valuation = asyncHandler(async (req, res) => {
  const data = await svc.getStockValuation(req.user, req.query.shopId || null);
  success(res, data, 'Stock valuation');
});

const openingSnapshot = asyncHandler(async (req, res) => {
  const snap = await svc.recordOpeningSnapshot(req.user, req.body.shopId, {
    financialYear: req.body.financialYear, note: req.body.note,
  });
  logAction(req, LOG_ACTIONS.PRODUCT_UPDATE, 'purchases',
    `Opening stock snapshot recorded for FY ${snap.financialYear}: ${snap.units} units / ${snap.value}`);
  success(res, { snapshot: snap }, 'Opening stock recorded');
});

module.exports = { getAll, create, update, post, cancel, valuation, openingSnapshot };
