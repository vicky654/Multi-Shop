const Customer      = require('../customers/customer.model');
const Sale          = require('../sales/sale.model');
const Shop          = require('../shops/shop.model');
const notifService  = require('../../services/notification.service');
const asyncHandler  = require('../../utils/asyncHandler');
const { success }   = require('../../utils/response');

// ── POST /api/notify/send ──────────────────────────────────────────────────────
// Body: { shopId, message, customerIds: "all" | string[] }
const send = asyncHandler(async (req, res) => {
  const { shopId, message, customerIds } = req.body;

  if (!shopId)   return res.status(400).json({ message: 'shopId required' });
  if (!message)  return res.status(400).json({ message: 'message required' });

  let customers;

  if (customerIds === 'all') {
    customers = await Customer.find({ shopId, isActive: true }).select('name phone').lean();
  } else if (Array.isArray(customerIds) && customerIds.length) {
    customers = await Customer.find({ _id: { $in: customerIds } }).select('name phone').lean();
  } else {
    return res.status(400).json({ message: 'customerIds must be "all" or a non-empty array' });
  }

  // Replace {shop} placeholder with actual shop name (all customers get same message)
  const shop        = await Shop.findById(shopId).select('name').lean();
  const shopName    = shop?.name || '';
  const finalMsg    = message.replace(/\{shop\}/gi, shopName);

  const result = await notifService.sendBulk(customers, finalMsg);

  success(res, result, `SMS sent to ${result.sent} of ${customers.length} customers`);
});

// ── POST /api/notify/due-reminders ────────────────────────────────────────────
// Body: { shopId }
// Finds all customers who have credit-payment sales and sends reminders
const dueReminders = asyncHandler(async (req, res) => {
  const { shopId } = req.body;
  if (!shopId) return res.status(400).json({ message: 'shopId required' });

  const shop     = await Shop.findById(shopId).select('name').lean();
  const shopName = shop?.name || 'our store';

  // Find distinct customers with at least one credit sale
  const creditCustIds = await Sale.distinct('customerId', {
    shopId,
    paymentMethod: 'credit',
    customerId:    { $ne: null },
    status:        'completed',
  });

  if (!creditCustIds.length) {
    return success(res, { sent: 0, total: 0 }, 'No customers with pending credit sales');
  }

  const customers = await Customer
    .find({ _id: { $in: creditCustIds }, isActive: true })
    .select('name phone')
    .lean();

  const message = `You have a pending payment at ${shopName}. Please visit us to settle your dues. Thank you for your business!`;
  const result  = await notifService.sendBulk(customers, message);

  success(res, { ...result, total: customers.length }, `Due reminders: sent ${result.sent} of ${customers.length}`);
});

// ── POST /api/notify/receipt ──────────────────────────────────────────────────
// Body: { saleId }
// Sends receipt SMS to the customer on a specific sale
const receipt = asyncHandler(async (req, res) => {
  const { saleId } = req.body;
  if (!saleId) return res.status(400).json({ message: 'saleId required' });

  const sale = await Sale.findById(saleId)
    .populate('customerId', 'name phone')
    .populate('shopId',     'name')
    .lean();

  if (!sale)              return res.status(404).json({ message: 'Sale not found' });
  if (!sale.customerId)   return res.status(400).json({ message: 'Sale has no customer attached' });
  if (!sale.customerId.phone) return res.status(400).json({ message: 'Customer has no phone number' });

  const result = await notifService.sendReceipt(
    sale.customerId,
    sale,
    sale.shopId?.name || 'our store'
  );

  success(
    res,
    result,
    result.success ? 'Receipt SMS sent' : `SMS failed: ${result.error}`,
    result.success ? 200 : 200   // Always 200 — let client check result.success
  );
});

module.exports = { send, dueReminders, receipt };
