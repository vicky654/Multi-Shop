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

/**
 * Fields a client must never set directly. The review stamp is evidence of who
 * approved a deduction or an input tax credit — if the request body could supply
 * it, the audit trail would be forgeable and therefore worthless. Set only by
 * classifyExpense, from the authenticated user.
 */
const SERVER_CONTROLLED = ['reviewedBy', 'reviewedAt', 'ownerId', 'addedBy'];

const updateExpense = async (id, user, data) => {
  const clean = { ...data };
  for (const k of SERVER_CONTROLLED) delete clean[k];

  const filter = user.role === 'super_admin' ? { _id: id } : { _id: id, ownerId: user.ownerId || user._id };
  const expense = await Expense.findOneAndUpdate(filter, clean, { new: true, runValidators: true });
  if (!expense) throw Object.assign(new Error('Expense not found'), { status: 404 });
  return expense;
};

/**
 * Record a human decision on how an expense is treated for tax.
 *
 * This is the ONLY path that may change itcStatus/deductionStatus, because each
 * change alters what the tax estimate deducts or claims. The reviewer and time are
 * stamped from the session, never from the payload.
 */
const classifyExpense = async (id, user, { itcStatus, deductionStatus, reviewNote } = {}) => {
  const { ITC_STATUS, DEDUCTION_STATUS } = Expense;

  if (itcStatus !== undefined && !ITC_STATUS.includes(itcStatus))
    throw Object.assign(new Error(`itcStatus must be one of: ${ITC_STATUS.join(', ')}`), { status: 400 });
  if (deductionStatus !== undefined && !DEDUCTION_STATUS.includes(deductionStatus))
    throw Object.assign(new Error(`deductionStatus must be one of: ${DEDUCTION_STATUS.join(', ')}`), { status: 400 });
  if (itcStatus === undefined && deductionStatus === undefined)
    throw Object.assign(new Error('Provide itcStatus and/or deductionStatus'), { status: 400 });

  const filter = user.role === 'super_admin' ? { _id: id } : { _id: id, ownerId: user.ownerId || user._id };
  const update = { reviewedBy: user._id, reviewedAt: new Date() };
  if (itcStatus !== undefined)       update.itcStatus = itcStatus;
  if (deductionStatus !== undefined) update.deductionStatus = deductionStatus;
  if (reviewNote !== undefined)      update.reviewNote = String(reviewNote).slice(0, 500);

  const expense = await Expense.findOneAndUpdate(filter, update, { new: true, runValidators: true });
  if (!expense) throw Object.assign(new Error('Expense not found'), { status: 404 });
  return expense;
};

/**
 * Classify several expenses at once — the realistic case when a shop has a
 * backlog of unreviewed rows. Applies the same rules and stamps per row.
 */
const classifyExpensesBulk = async (user, { ids, itcStatus, deductionStatus, reviewNote } = {}) => {
  if (!Array.isArray(ids) || ids.length === 0)
    throw Object.assign(new Error('No expense ids provided'), { status: 400 });
  if (ids.length > 200)
    throw Object.assign(new Error('Classify at most 200 expenses at a time'), { status: 400 });

  const results = { updated: 0, failed: [] };
  for (const id of ids) {
    try {
      // Sequential on purpose: each row is validated and stamped individually, so
      // one bad id cannot silently take the whole batch down.
      await classifyExpense(id, user, { itcStatus, deductionStatus, reviewNote });
      results.updated += 1;
    } catch (e) {
      results.failed.push({ id, error: e.message });
    }
  }
  return results;
};

const deleteExpense = async (id, user) => {
  const filter = user.role === 'super_admin' ? { _id: id } : { _id: id, ownerId: user.ownerId || user._id };
  const expense = await Expense.findOneAndDelete(filter);
  if (!expense) throw Object.assign(new Error('Expense not found'), { status: 404 });
  return expense;
};

module.exports = {
  getExpenses, getTotalExpenses, createExpense, updateExpense, deleteExpense,
  classifyExpense, classifyExpensesBulk,
};
