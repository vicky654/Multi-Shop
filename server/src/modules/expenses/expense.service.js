const mongoose = require('mongoose');
const Expense   = require('./expense.model');

// aggregate() does NOT auto-cast strings → ObjectId the way .find() does.
// This helper makes every shopId safe to use inside $match pipelines.
const toObjectId = (id) => {
  try { return new mongoose.Types.ObjectId(id.toString()); } catch { return null; }
};

const getExpenses = async (user, query) => {
  const { shopId, type, startDate, endDate, page = 1, limit = 20 } = query;
  const filter = {};

  if (user.role !== 'super_admin') filter.shopId = { $in: user.shops };
  if (shopId) filter.shopId = shopId;
  if (type) filter.type = type;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate)   filter.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
  }

  const skip = (page - 1) * limit;
  const [expenses, total] = await Promise.all([
    Expense.find(filter).populate('addedBy', 'name').sort({ date: -1 }).skip(skip).limit(parseInt(limit)),
    Expense.countDocuments(filter),
  ]);
  return { expenses, total, page: parseInt(page), limit: parseInt(limit) };
};

const getTotalExpenses = async (user, shopId, month, year) => {
  const filter = {};

  // Cast to ObjectId — aggregate() does not auto-cast strings unlike .find()
  if (user.role !== 'super_admin') {
    filter.shopId = { $in: (user.shops || []).map(toObjectId).filter(Boolean) };
  }
  if (shopId) {
    const oid = toObjectId(shopId);
    if (oid) filter.shopId = oid;
  }

  if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59);
    filter.date = { $gte: start, $lte: end };
  }

  const result = await Expense.aggregate([
    { $match: filter },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } },
  ]);
  return result;
};

const createExpense = async (user, data) => {
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === data.shopId))
    throw Object.assign(new Error('No access to this shop'), { status: 403 });
  return Expense.create({ ...data, ownerId: user.ownerId || user._id, addedBy: user._id });
};

const updateExpense = async (id, user, data) => {
  const filter = user.role === 'super_admin' ? { _id: id } : { _id: id, ownerId: user.ownerId || user._id };
  const expense = await Expense.findOneAndUpdate(filter, data, { new: true, runValidators: true });
  if (!expense) throw Object.assign(new Error('Expense not found'), { status: 404 });
  return expense;
};

const deleteExpense = async (id, user) => {
  const filter = user.role === 'super_admin' ? { _id: id } : { _id: id, ownerId: user.ownerId || user._id };
  const expense = await Expense.findOneAndDelete(filter);
  if (!expense) throw Object.assign(new Error('Expense not found'), { status: 404 });
  return expense;
};

module.exports = { getExpenses, getTotalExpenses, createExpense, updateExpense, deleteExpense };
