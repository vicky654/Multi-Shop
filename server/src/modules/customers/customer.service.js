const Customer = require('./customer.model');

const getCustomers = async (user, query) => {
  const { shopId, search, page = 1, limit = 20 } = query;
  const filter = { isActive: true };

  if (user.role !== 'super_admin') filter.shopId = { $in: user.shops };
  if (shopId) filter.shopId = shopId;
  if (search) filter.$text = { $search: search };

  const skip = (page - 1) * limit;
  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ totalSpent: -1 }).skip(skip).limit(parseInt(limit)),
    Customer.countDocuments(filter),
  ]);
  return { customers, total, page: parseInt(page), limit: parseInt(limit) };
};

const getCustomerById = async (id, user) => {
  const customer = await Customer.findById(id).populate('purchaseHistory.saleId', 'invoiceNumber totalAmount createdAt');
  if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === customer.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });
  return customer;
};

const createCustomer = async (user, data) => {
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === data.shopId))
    throw Object.assign(new Error('No access to this shop'), { status: 403 });
  return Customer.create({ ...data, ownerId: user.ownerId || user._id });
};

const updateCustomer = async (id, user, data) => {
  const customer = await Customer.findById(id);
  if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === customer.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });
  Object.assign(customer, data);
  return customer.save();
};

const deleteCustomer = async (id, user) => {
  const customer = await Customer.findById(id);
  if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === customer.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });
  customer.isActive = false;
  return customer.save();
};

module.exports = { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer };
