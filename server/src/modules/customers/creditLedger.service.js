const CreditLedger = require('./creditLedger.model');
const Customer     = require('./customer.model');

// ── Get ledger for a customer ─────────────────────────────────────────────────
const getLedger = async (customerId, shopId, { page = 1, limit = 30 } = {}) => {
  const filter = { customerId, shopId };
  const skip   = (page - 1) * limit;

  const [entries, total, customer] = await Promise.all([
    CreditLedger.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('saleId', 'invoiceNumber totalAmount')
      .populate('recordedBy', 'name'),
    CreditLedger.countDocuments(filter),
    Customer.findById(customerId, 'name phone creditBalance'),
  ]);

  return { customer, entries, total, page: parseInt(page), limit: parseInt(limit) };
};

// ── Record a new credit entry (called by sale.service when paymentMethod=credit) ─
const recordCredit = async ({ customerId, shopId, saleId, amount, notes, recordedBy }, session) => {
  // Get current balance
  const last = await CreditLedger.findOne({ customerId, shopId }, null, {
    sort: { createdAt: -1 },
    session,
  });
  const prevBalance = last?.balance ?? 0;
  const newBalance  = +(prevBalance + amount).toFixed(2);

  const [entry] = await CreditLedger.create(
    [{ customerId, shopId, saleId, type: 'credit', amount, balance: newBalance, notes, recordedBy }],
    { session }
  );

  // Denormalize running balance on Customer document
  await Customer.findByIdAndUpdate(
    customerId,
    { $set: { creditBalance: newBalance } },
    { session }
  );

  return entry;
};

// ── Record a repayment ─────────────────────────────────────────────────────────
const recordRepayment = async (customerId, user, { shopId, amount, notes }) => {
  const customer = await Customer.findOne({ _id: customerId, shopId });
  if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === shopId))
    throw Object.assign(new Error('Access denied'), { status: 403 });

  const paid = Number(amount);
  if (paid <= 0) throw Object.assign(new Error('amount must be > 0'), { status: 400 });

  const last = await CreditLedger.findOne({ customerId, shopId }, null, {
    sort: { createdAt: -1 },
  });
  const prevBalance = last?.balance ?? 0;
  const newBalance  = Math.max(0, +(prevBalance - paid).toFixed(2));

  const entry = await CreditLedger.create({
    customerId,
    shopId,
    type:       'repay',
    amount:     paid,
    balance:    newBalance,
    notes,
    recordedBy: user._id,
  });

  await Customer.findByIdAndUpdate(customerId, { $set: { creditBalance: newBalance } });

  return { entry, previousBalance: prevBalance, newBalance };
};

// ── Summarise outstanding credit for all customers in a shop ──────────────────
const getShopCreditSummary = async (user, shopId) => {
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === shopId))
    throw Object.assign(new Error('Access denied'), { status: 403 });

  return Customer.find({ shopId, isActive: true, creditBalance: { $gt: 0 } })
    .select('name phone creditBalance')
    .sort({ creditBalance: -1 });
};

module.exports = { getLedger, recordCredit, recordRepayment, getShopCreditSummary };
