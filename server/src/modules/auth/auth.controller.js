const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const result = await authService.register({ name, email, password, role: 'owner', phone });
  success(res, result, 'Registered successfully', 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
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

module.exports = { register, login, getMe, completeOnboarding, createStaff, getStaff, updateStaff, deleteStaff };
