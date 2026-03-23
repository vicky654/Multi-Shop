const pushService = require('./push.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success }  = require('../../utils/response');

/** POST /api/push/register — store this device's FCM token */
const register = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw Object.assign(new Error('token is required'), { status: 400 });
  await pushService.registerToken(req.user._id, token);
  success(res, {}, 'Device registered');
});

/** POST /api/push/unregister — remove token on logout */
const unregister = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (token) await pushService.removeToken(req.user._id, token);
  success(res, {}, 'Device unregistered');
});

/** POST /api/push/send-test — super_admin test push */
const sendTest = asyncHandler(async (req, res) => {
  const { userId, title = 'Test Push', body = 'Push is working!', data = {} } = req.body;
  const targetId = userId || req.user._id;
  await pushService.sendToUser(targetId, { title, body, data });
  success(res, {}, 'Test push sent');
});

module.exports = { register, unregister, sendTest };
