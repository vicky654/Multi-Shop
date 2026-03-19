const Sale     = require('./sale.model');
const Product  = require('../products/product.model');
const Customer = require('../customers/customer.model');
const Shop     = require('../shops/shop.model');

// ── Build enriched items from raw cart items ──────────────────────────────────
const enrichItems = async (items) => {
  let totalAmount = 0, totalDiscount = 0, totalProfit = 0;
  const enrichedItems = [];

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product || !product.isActive)
      throw Object.assign(new Error(`Product "${item.name || item.productId}" not found`), { status: 400 });

    if (product.stock < item.quantity)
      throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { status: 400 });

    const discount       = item.discount || 0;
    const productDiscount = product.discount || 0; // base product discount
    const effectiveDisc  = Math.max(discount, productDiscount); // use higher discount
    const discountedPrice = product.price * (1 - effectiveDisc / 100);
    const subtotal        = discountedPrice * item.quantity;
    const profit          = (discountedPrice - product.costPrice) * item.quantity;

    enrichedItems.push({
      product:       product._id,
      name:          product.name,
      price:         product.price,
      costPrice:     product.costPrice,
      quantity:      item.quantity,
      discount:      effectiveDisc,
      subtotal,
      profit,
      selectedSize:  item.selectedSize  || item.size  || '',
      selectedColor: item.selectedColor || item.color || '',
    });

    totalAmount   += subtotal;
    totalDiscount += (product.price - discountedPrice) * item.quantity;
    totalProfit   += profit;
  }

  return { enrichedItems, totalAmount, totalDiscount, totalProfit };
};

// ── Admin (staff) sale ────────────────────────────────────────────────────────
const createSale = async (user, data) => {
  const { shopId, items, customerId, paymentMethod, notes, taxRate = 0 } = data;

  if (!items || !items.length) throw Object.assign(new Error('No items in sale'), { status: 400 });

  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === shopId)) {
    throw Object.assign(new Error('No access to this shop'), { status: 403 });
  }

  const { enrichedItems, totalAmount, totalDiscount, totalProfit } = await enrichItems(items);

  const taxAmount  = totalAmount * (taxRate / 100);
  const finalTotal = totalAmount + taxAmount;

  // Deduct stock atomically
  for (const item of enrichedItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
  }

  const ownerId = user.role === 'owner' ? user._id : (user.ownerId || user._id);
  const sale = await Sale.create({
    items: enrichedItems,
    totalAmount: finalTotal,
    totalDiscount,
    totalProfit,
    taxAmount,
    taxRate,
    paymentMethod: paymentMethod || 'cash',
    customerId:    customerId || null,
    shopId,
    ownerId,
    staffId:  user._id,
    notes,
    status:   'completed',
  });

  if (customerId) {
    await Customer.findByIdAndUpdate(customerId, {
      $inc:  { totalPurchases: 1, totalSpent: finalTotal },
      $push: { purchaseHistory: { saleId: sale._id, amount: finalTotal, date: sale.createdAt } },
    });
  }

  await sale.populate(['customerId', 'staffId', { path: 'shopId', select: 'name address phone currency taxRate logo' }]);
  return sale;
};

// ── Public (online customer) checkout ─────────────────────────────────────────
const createPublicSale = async (data) => {
  const { shopId, items, customerName, customerPhone, customerEmail, paymentMethod, notes } = data;

  if (!shopId)   throw Object.assign(new Error('shopId is required'), { status: 400 });
  if (!items || !items.length) throw Object.assign(new Error('No items in sale'), { status: 400 });
  if (!customerName || !customerPhone)
    throw Object.assign(new Error('Customer name and phone are required'), { status: 400 });

  const shop = await Shop.findById(shopId);
  if (!shop || !shop.isActive)
    throw Object.assign(new Error('Shop not found'), { status: 404 });

  const { enrichedItems, totalAmount, totalDiscount, totalProfit } = await enrichItems(items);

  const taxRate   = shop.taxRate || 0;
  const taxAmount = totalAmount * (taxRate / 100);
  const finalTotal = totalAmount + taxAmount;

  // Find or create customer record
  let customer = await Customer.findOne({ shopId, phone: customerPhone });
  if (!customer) {
    customer = await Customer.create({
      name:    customerName,
      phone:   customerPhone,
      email:   customerEmail || '',
      shopId,
      ownerId: shop.owner,
    });
  }

  for (const item of enrichedItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
  }

  const sale = await Sale.create({
    items: enrichedItems,
    totalAmount:   finalTotal,
    totalDiscount,
    totalProfit,
    taxAmount,
    taxRate,
    paymentMethod: paymentMethod || 'cash',
    customerId:    customer._id,
    shopId,
    ownerId:       shop.owner,
    customerName,
    customerPhone,
    notes,
    status:        'pending',    // pending until fulfilled
    isOnlineOrder: true,
  });

  await Customer.findByIdAndUpdate(customer._id, {
    $inc:  { totalPurchases: 1, totalSpent: finalTotal },
    $push: { purchaseHistory: { saleId: sale._id, amount: finalTotal, date: sale.createdAt } },
  });

  await sale.populate([
    { path: 'shopId', select: 'name address phone currency logo' },
  ]);
  return sale;
};

// ── List sales ────────────────────────────────────────────────────────────────
const getSales = async (user, query) => {
  const { shopId, startDate, endDate, paymentMethod, status, page = 1, limit = 20 } = query;
  const filter = {};

  if (user.role !== 'super_admin') filter.shopId = { $in: user.shops };
  if (shopId)        filter.shopId        = shopId;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (status)        filter.status        = status;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate)   filter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
  }

  const skip = (page - 1) * limit;
  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .populate('customerId', 'name phone')
      .populate('staffId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Sale.countDocuments(filter),
  ]);

  return { sales, total, page: parseInt(page), limit: parseInt(limit) };
};

const getSaleById = async (id, user) => {
  const sale = await Sale.findById(id)
    .populate('customerId', 'name phone email')
    .populate('staffId', 'name')
    .populate('shopId', 'name address phone currency logo gstNumber')
    .populate('items.product', 'name barcode sku');

  if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === sale.shopId._id.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });
  return sale;
};

const refundSale = async (id, user) => {
  const sale = await Sale.findById(id);
  if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (sale.status === 'refunded') throw Object.assign(new Error('Already refunded'), { status: 400 });

  for (const item of sale.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
  }

  sale.status = 'refunded';
  await sale.save();
  return sale;
};

module.exports = { createSale, createPublicSale, getSales, getSaleById, refundSale };
