const alertService = require('./alert.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const getAlerts = asyncHandler(async (req, res) => {
  const shopId = req.query.shopId || null;
  const alerts = await alertService.generateAlerts(req.user, shopId);
  success(res, { alerts }, 'Alerts generated');
});

module.exports = { getAlerts };

