const AutomationLog = require('./automationLog.model');
const {
  getAutomationConfig,
  toggleAutomation,
  triggerNow,
} = require('./erp-automation.service');
const { success, error } = require('../../utils/response');

// GET /api/erp-automations?shopId=
const list = async (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return error(res, 'shopId is required', 400);

  const automations = getAutomationConfig(shopId);
  success(res, { automations }, 'ERP automations fetched');
};

// PATCH /api/erp-automations/:type/toggle  body: { shopId, enabled }
const toggle = async (req, res) => {
  const { type } = req.params;
  const { shopId, enabled } = req.body;
  if (!shopId) return error(res, 'shopId is required', 400);
  if (typeof enabled !== 'boolean') return error(res, 'enabled must be boolean', 400);

  try {
    const state = toggleAutomation(shopId, type, enabled);
    success(res, { type, ...state }, `Automation ${enabled ? 'enabled' : 'disabled'}`);
  } catch (e) {
    error(res, e.message, 400);
  }
};

// POST /api/erp-automations/:type/run  body: { shopId }
const runNow = async (req, res) => {
  const { type } = req.params;
  const { shopId } = req.body;
  if (!shopId) return error(res, 'shopId is required', 400);

  try {
    const result = await triggerNow(shopId, type);
    success(res, { type, result }, 'Automation executed');
  } catch (e) {
    error(res, e.message, 400);
  }
};

// GET /api/erp-automations/logs?shopId=&type=&limit=
const logs = async (req, res) => {
  const { shopId, type, limit = 50 } = req.query;
  if (!shopId) return error(res, 'shopId is required', 400);

  const filter = { shopId };
  if (type) filter.type = type;

  const docs = await AutomationLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit), 200))
    .lean();

  success(res, { logs: docs, count: docs.length }, 'Logs fetched');
};

module.exports = { list, toggle, runNow, logs };
