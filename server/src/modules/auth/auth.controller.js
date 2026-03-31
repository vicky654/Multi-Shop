const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const { logAction, LOG_ACTIONS } = require('../../utils/logger');

const register = asyncHandler(async (req, res) => {
  const { name: regName, email: regEmail, password, phone } = req.body;
  const result = await authService.register({ name: regName, email: regEmail, password, role: 'owner', phone });
  logAction(req, LOG_ACTIONS.REGISTER_SUCCESS, 'auth', `New owner registered: ${regEmail}`);
  success(res, result, 'Registered successfully', 201);
});

const login = asyncHandler(async (req, res) => {
  const { email: loginEmail, password } = req.body;
  if (process.env.NODE_ENV !== 'production') {
    console.log('📩 Login request body:', { email: loginEmail, password: '***' });
  }
  const result = await authService.login({ email: loginEmail, password });
  logAction(req, LOG_ACTIONS.LOGIN_SUCCESS, 'auth', `User logged in: ${result.user.email}`);

  if (process.env.NODE_ENV !== 'production') {
    console.log('📤 Sending response:', { success: true, user: result.user?.email, token: result.token?.slice(0, 20) + '…' });
  }
  success(res, result, 'Logged in successfully');
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  success(res, { user }, 'Profile fetched');
});

const createStaff = asyncHandler(async (req, res) => {
  const result = await authService.createStaff(
    req.user._id,
    req.user.shops,
    req.body
  );
  success(res, result, 'Staff created', 201);
});

const getStaff = asyncHandler(async (req, res) => {
  const staff = await authService.getStaff(req.user._id);
  success(res, { staff }, 'Staff fetched');
});

const updateStaff = asyncHandler(async (req, res) => {
  const staff = await authService.updateStaff(req.params.id, req.user._id, req.body);
  success(res, { staff }, 'Staff updated');
});

const deleteStaff = asyncHandler(async (req, res) => {
  await authService.deleteStaff(req.params.id, req.user._id);
  success(res, {}, 'Staff deleted');
});

const completeOnboarding = asyncHandler(async (req, res) => {
  await authService.completeOnboarding(req.user._id);
  success(res, {}, 'Onboarding completed');
});

const impersonate = asyncHandler(async (req, res) => {
  const { staffId } = req.params;

  // Block if already impersonating (prevent nested impersonation)
  if (req.isImpersonating) {
    return res.status(403).json({ success: false, message: 'Cannot impersonate while already impersonating' });
  }

  const result = await authService.impersonateStaff(req.user._id, req.user.role, staffId);

  logAction(req, LOG_ACTIONS.IMPERSONATE_START, 'auth',
    `${req.user.name} (${req.user.role}) started impersonating ${result.staff.name}`,
    { staffId, staffName: result.staff.name, staffRole: result.staff.role });

  success(res, result, `Impersonating ${result.staff.name}`);
});

module.exports = { register, login, getMe, completeOnboarding, createStaff, getStaff, updateStaff, deleteStaff, impersonate };
