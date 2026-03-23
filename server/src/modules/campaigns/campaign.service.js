const Campaign  = require('./campaign.model');
const Customer  = require('../customers/customer.model');
const Sale      = require('../sales/sale.model');
const Shop      = require('../shops/shop.model');
const { sendSms }    = require('./sms.service');
const { sendToUser } = require('../push/push.service');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise a phone string to 91xxxxxxxxxx (E.164-lite) */
const normalizePhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
};

/** Replace {name}, {due}, {amount}, {shop} placeholders */
const personalize = (template, vars = {}) =>
  template
    .replace(/\{name\}/gi,   vars.name   || 'Customer')
    .replace(/\{due\}/gi,    vars.due    || '0')
    .replace(/\{amount\}/gi, vars.amount || '0')
    .replace(/\{shop\}/gi,   vars.shop   || 'our shop');

/** Build a wa.me URL */
const buildWhatsAppUrl = (phone, message) => {
  const digits = String(phone).replace(/\D/g, '');
  const num = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
};

// ── Target customer resolution ────────────────────────────────────────────────

const getTargetCustomers = async (shopId, targetType, targetIds = []) => {
  const base = { shopId, isActive: true };

  if (targetType === 'selected') {
    if (!targetIds.length) return [];
    return Customer.find({ ...base, _id: { $in: targetIds } }).lean();
  }

  if (targetType === 'pending_dues') {
    // Customers who have at least one credit sale that hasn't been fully paid
    const dueSales = await Sale.distinct('customerId', {
      shopId,
      paymentMethod: 'credit',
      status: { $ne: 'refunded' },
      customerId: { $ne: null },
    });
    return Customer.find({ ...base, _id: { $in: dueSales } }).lean();
  }

  if (targetType === 'recent_buyers') {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const recent = await Sale.distinct('customerId', {
      shopId,
      customerId: { $ne: null },
      createdAt: { $gte: since },
    });
    return Customer.find({ ...base, _id: { $in: recent } }).lean();
  }

  if (targetType === 'inactive') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const recentBuyers = await Sale.distinct('customerId', {
      shopId,
      customerId: { $ne: null },
      createdAt: { $gte: cutoff },
    });
    return Customer.find({
      ...base,
      _id: { $nin: recentBuyers },
    }).lean();
  }

  if (targetType === 'high_spenders') {
    return Customer.find({ ...base, totalSpent: { $gte: 5000 } }).lean();
  }

  if (targetType === 'frequent_buyers') {
    return Customer.find({ ...base, totalPurchases: { $gte: 5 } }).lean();
  }

  if (targetType === 'new_customers') {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    return Customer.find({ ...base, createdAt: { $gte: since } }).lean();
  }

  // 'all'
  return Customer.find(base).lean();
};

// ── Due amount per customer for PAYMENT_REMINDER ──────────────────────────────

const getDueMap = async (shopId, customerIds) => {
  const sales = await Sale.find({
    shopId,
    paymentMethod: 'credit',
    status: { $ne: 'refunded' },
    customerId: { $in: customerIds },
  }).select('customerId totalAmount').lean();

  const map = {};
  for (const s of sales) {
    const id = String(s.customerId);
    map[id] = (map[id] || 0) + s.totalAmount;
  }
  return map;
};

// ── Internal send core ────────────────────────────────────────────────────────
// If existingCampaignId is provided, updates that document in place instead of creating a new one.

const sendCampaignCore = async ({
  shopId, ownerId, type, channel, subject, message, targetType, targetIds, automationId,
  existingCampaignId,
}) => {
  const shop = await Shop.findById(shopId).lean();
  const notif = shop?.notifSettings || {};

  const customers = await getTargetCustomers(shopId, targetType, targetIds);
  if (!customers.length) throw new Error('No customers matched the target criteria');

  // Pre-fetch due amounts if needed
  let dueMap = {};
  if (type === 'PAYMENT_REMINDER') {
    dueMap = await getDueMap(shopId, customers.map((c) => c._id));
  }

  const recipients     = [];
  const whatsappLinks  = [];
  let totalSent = 0, totalFailed = 0, totalSkipped = 0;

  for (const customer of customers) {
    const phone = customer.phone;
    const vars  = {
      name:   customer.name,
      shop:   shop.name,
      due:    dueMap[String(customer._id)] ? `₹${dueMap[String(customer._id)].toFixed(2)}` : '₹0',
      amount: customer.totalSpent ? `₹${customer.totalSpent.toFixed(2)}` : '₹0',
    };
    const personalizedMsg = personalize(message, vars);

    if (channel === 'whatsapp') {
      if (!phone) {
        recipients.push({ customerId: customer._id, name: customer.name, phone: '', status: 'skipped', reason: 'No phone' });
        totalSkipped++;
        continue;
      }
      const url = buildWhatsAppUrl(phone, personalizedMsg);
      whatsappLinks.push({ name: customer.name, phone, url });
      recipients.push({ customerId: customer._id, name: customer.name, phone, status: 'sent' });
      totalSent++;
      continue;
    }

    if (channel === 'sms') {
      const norm = normalizePhone(phone);
      if (!norm) {
        recipients.push({ customerId: customer._id, name: customer.name, phone: phone || '', status: 'skipped', reason: 'No/invalid phone' });
        totalSkipped++;
        continue;
      }
      if (!notif.smsApiKey) {
        recipients.push({ customerId: customer._id, name: customer.name, phone, status: 'skipped', reason: 'SMS API key not configured' });
        totalSkipped++;
        continue;
      }
      const result = await sendSms(notif.smsApiKey, norm, personalizedMsg, notif.smsSenderId);
      if (result.success) {
        recipients.push({ customerId: customer._id, name: customer.name, phone, status: 'sent' });
        totalSent++;
      } else {
        recipients.push({ customerId: customer._id, name: customer.name, phone, status: 'failed', reason: result.error });
        totalFailed++;
      }
      continue;
    }

    if (channel === 'push') {
      // Push goes to the shop owner, not individual customers (customers don't have FCM tokens)
      // We'll send one push per campaign to the owner summarising the message
      // (handled after loop)
      recipients.push({ customerId: customer._id, name: customer.name, phone: phone || '', status: 'sent' });
      totalSent++;
    }
  }

  // For push channel: send one notification to the owner with a summary
  if (channel === 'push') {
    await sendToUser(ownerId, {
      title: subject || 'Campaign sent',
      body:  `Message sent to ${customers.length} customer(s): ${message.slice(0, 80)}`,
      data:  { link: '/campaigns' },
    });
  }

  const finalStatus =
    totalFailed === customers.length ? 'failed'
    : totalFailed > 0               ? 'partial'
    : 'sent';

  const campaignData = {
    shopId, ownerId, type, channel, subject, message, targetType,
    targetIds: targetIds || [],
    totalTargeted: customers.length,
    totalSent, totalFailed, totalSkipped,
    recipients, whatsappLinks,
    status: finalStatus,
    sentAt: new Date(),
  };
  if (automationId) campaignData.automationId = automationId;

  if (existingCampaignId) {
    const updated = await Campaign.findByIdAndUpdate(
      existingCampaignId,
      campaignData,
      { new: true }
    );
    return updated;
  }

  const campaign = await Campaign.create(campaignData);
  return campaign;
};

// ── Main send function ────────────────────────────────────────────────────────

const sendCampaign = async ({
  shopId, ownerId, type, channel, subject, message, targetType, targetIds,
  scheduledFor, automationId,
}) => {
  // If scheduledFor is in the future, save as scheduled without sending
  if (scheduledFor && new Date(scheduledFor) > new Date()) {
    const campaign = await Campaign.create({
      shopId,
      ownerId,
      type,
      channel,
      subject,
      message,
      targetType: targetType || 'all',
      targetIds:  targetIds  || [],
      status:     'scheduled',
      scheduledFor: new Date(scheduledFor),
      ...(automationId ? { automationId } : {}),
      totalTargeted: 0,
      totalSent:     0,
      totalFailed:   0,
      totalSkipped:  0,
    });
    return campaign;
  }

  // Daily rate limit check: max 500 messages per shop per day
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCampaigns = await Campaign.find({
    shopId,
    createdAt: { $gte: todayStart },
    status: { $ne: 'scheduled' },
  }).select('totalSent').lean();

  const sentToday = todayCampaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
  if (sentToday >= 500) {
    throw new Error('Daily message limit of 500 reached for this shop');
  }

  return sendCampaignCore({
    shopId, ownerId, type, channel, subject, message,
    targetType: targetType || 'all',
    targetIds:  targetIds  || [],
    automationId,
  });
};

// ── Send digital receipt ──────────────────────────────────────────────────────

const sendReceipt = async ({ shopId, ownerId, customerId, sale, channel }) => {
  const shop     = await Shop.findById(shopId).lean();
  const customer = await Customer.findById(customerId).lean();
  if (!customer) throw new Error('Customer not found');

  const notif = shop?.notifSettings || {};
  const items = sale.items
    .map((i) => `${i.name} x${i.quantity} = ₹${i.subtotal.toFixed(2)}`)
    .join('\n');

  const message =
    `Hi ${customer.name}! 🧾\n` +
    `Receipt for your purchase at *${shop.name}*\n\n` +
    `${items}\n\n` +
    `Total: ₹${sale.totalAmount.toFixed(2)}\n` +
    `Invoice: ${sale.invoiceNumber}\n` +
    `Thank you for shopping with us! 🙏`;

  let whatsappLinks = [];
  let recipients    = [];
  let totalSent = 0, totalFailed = 0;

  if (channel === 'whatsapp') {
    if (!customer.phone) throw new Error('Customer has no phone number');
    const url = buildWhatsAppUrl(customer.phone, message);
    whatsappLinks = [{ name: customer.name, phone: customer.phone, url }];
    recipients    = [{ customerId, name: customer.name, phone: customer.phone, status: 'sent' }];
    totalSent     = 1;
  }

  if (channel === 'sms') {
    const norm = normalizePhone(customer.phone);
    if (!norm) throw new Error('Customer has no valid phone number');
    if (!notif.smsApiKey) throw new Error('SMS API key not configured in shop settings');
    const shortMsg = `${shop.name}: Thanks ${customer.name}! Receipt for ₹${sale.totalAmount.toFixed(2)}. Invoice: ${sale.invoiceNumber}`;
    const result = await sendSms(notif.smsApiKey, norm, shortMsg, notif.smsSenderId);
    if (result.success) {
      recipients = [{ customerId, name: customer.name, phone: customer.phone, status: 'sent' }];
      totalSent  = 1;
    } else {
      recipients = [{ customerId, name: customer.name, phone: customer.phone, status: 'failed', reason: result.error }];
      totalFailed = 1;
    }
  }

  const campaign = await Campaign.create({
    shopId, ownerId,
    type:    'ORDER_RECEIPT',
    channel, message,
    targetType: 'selected',
    targetIds:  [customerId],
    totalTargeted: 1, totalSent, totalFailed, totalSkipped: 0,
    recipients, whatsappLinks,
    status: totalFailed ? 'failed' : 'sent',
    sentAt: new Date(),
  });

  return campaign;
};

// ── Daily summary ─────────────────────────────────────────────────────────────

const getDailySummary = async (shopId) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  // Yesterday bounds
  const yesterdayStart = new Date(start);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(start);
  yesterdayEnd.setMilliseconds(yesterdayEnd.getMilliseconds() - 1);

  const [sales, yesterdaySales] = await Promise.all([
    Sale.find({
      shopId,
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'refunded' },
    }).lean(),
    Sale.find({
      shopId,
      createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
      status: { $ne: 'refunded' },
    }).lean(),
  ]);

  const totalSales       = sales.reduce((s, r) => s + r.totalAmount, 0);
  const totalProfit      = sales.reduce((s, r) => s + (r.totalProfit || 0), 0);
  const transactionCount = sales.length;
  const date             = start.toISOString().slice(0, 10);

  const yTotalSales       = yesterdaySales.reduce((s, r) => s + r.totalAmount, 0);
  const yTransactionCount = yesterdaySales.length;

  const salesChangePercent =
    yTotalSales === 0
      ? null
      : Math.round(((totalSales - yTotalSales) / yTotalSales) * 100 * 10) / 10;

  return {
    totalSales,
    totalProfit,
    transactionCount,
    date,
    yesterday: {
      totalSales:       yTotalSales,
      transactionCount: yTransactionCount,
    },
    salesChangePercent,
  };
};

const sendDailySummary = async ({ shopId, ownerId }) => {
  const shop    = await Shop.findById(shopId).lean();
  const summary = await getDailySummary(shopId);
  const notif   = shop?.notifSettings || {};

  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const message =
    `📊 *Daily Summary — ${dateStr}*\n` +
    `Shop: *${shop.name}*\n\n` +
    `💰 Total Sales: ₹${summary.totalSales.toFixed(2)}\n` +
    `📈 Total Profit: ₹${summary.totalProfit.toFixed(2)}\n` +
    `🛒 Transactions: ${summary.transactionCount}`;

  let whatsappLinks = [];
  let channel = 'push';
  let totalSent = 0;

  // Prefer WhatsApp if owner number is set
  if (notif.ownerWhatsapp) {
    channel = 'whatsapp';
    const url = buildWhatsAppUrl(notif.ownerWhatsapp, message);
    whatsappLinks = [{ name: shop.name, phone: notif.ownerWhatsapp, url }];
    totalSent = 1;
  } else {
    // Fall back to push notification to the owner
    await sendToUser(ownerId, {
      title: `Daily Summary — ${dateStr}`,
      body:  `Sales ₹${summary.totalSales.toFixed(2)} · Profit ₹${summary.totalProfit.toFixed(2)} · ${summary.transactionCount} txns`,
      data:  { link: '/reports' },
    });
    totalSent = 1;
  }

  const campaign = await Campaign.create({
    shopId, ownerId,
    type:       'DAILY_SUMMARY',
    channel,
    message,
    targetType: 'all',
    totalTargeted: 1, totalSent, totalFailed: 0, totalSkipped: 0,
    recipients:  [],
    whatsappLinks,
    summaryData: {
      totalSales:       summary.totalSales,
      totalProfit:      summary.totalProfit,
      transactionCount: summary.transactionCount,
      date:             summary.date,
    },
    status: 'sent',
    sentAt: new Date(),
  });

  return { campaign, summary };
};

// ── Segment counts ────────────────────────────────────────────────────────────

const getSegmentCounts = async (shopId) => {
  const now = new Date();

  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);

  const cutoff60 = new Date(now);
  cutoff60.setDate(cutoff60.getDate() - 60);

  const cutoff7 = new Date(now);
  cutoff7.setDate(cutoff7.getDate() - 7);

  const [
    allCount,
    pendingDuesIds,
    recentBuyerIds,
    highSpendersCount,
    frequentBuyersCount,
    newCustomersCount,
    recentBuyers60,
  ] = await Promise.all([
    Customer.countDocuments({ shopId, isActive: true }),
    Sale.distinct('customerId', {
      shopId,
      paymentMethod: 'credit',
      status: { $ne: 'refunded' },
      customerId: { $ne: null },
    }),
    Sale.distinct('customerId', {
      shopId,
      customerId: { $ne: null },
      createdAt: { $gte: cutoff30 },
    }),
    Customer.countDocuments({ shopId, isActive: true, totalSpent: { $gte: 5000 } }),
    Customer.countDocuments({ shopId, isActive: true, totalPurchases: { $gte: 5 } }),
    Customer.countDocuments({ shopId, isActive: true, createdAt: { $gte: cutoff7 } }),
    Sale.distinct('customerId', {
      shopId,
      customerId: { $ne: null },
      createdAt: { $gte: cutoff60 },
    }),
  ]);

  const inactiveCount = await Customer.countDocuments({
    shopId,
    isActive: true,
    _id: { $nin: recentBuyers60 },
  });

  return {
    all:              allCount,
    pending_dues:     pendingDuesIds.length,
    recent_buyers:    recentBuyerIds.length,
    inactive:         inactiveCount,
    high_spenders:    highSpendersCount,
    frequent_buyers:  frequentBuyersCount,
    new_customers:    newCustomersCount,
  };
};

// ── Smart suggestions ─────────────────────────────────────────────────────────

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const getSmartSuggestions = async (shopId) => {
  const counts = await getSegmentCounts(shopId);

  const suggestions = [];

  if (counts.pending_dues > 0) {
    suggestions.push({
      id:          'pending_dues',
      title:       'Payment Reminder',
      description: `${counts.pending_dues} customer(s) have pending dues`,
      type:        'PAYMENT_REMINDER',
      channel:     'whatsapp',
      targetType:  'pending_dues',
      message:     'Hi {name}, you have a pending balance at {shop}. Please clear it at your convenience. Thank you! 🙏',
      priority:    'high',
      count:       counts.pending_dues,
    });
  }

  if (counts.inactive > 0) {
    suggestions.push({
      id:          'inactive',
      title:       'Win Back Inactive Customers',
      description: `${counts.inactive} customer(s) haven't visited in 60 days`,
      type:        'DISCOUNT_OFFER',
      channel:     'whatsapp',
      targetType:  'inactive',
      message:     "Hi {name}! We miss you at {shop}! 😊 Come visit us for exclusive deals.",
      priority:    'medium',
      count:       counts.inactive,
    });
  }

  if (counts.new_customers > 0) {
    suggestions.push({
      id:          'new_customers',
      title:       'Welcome New Customers',
      description: `${counts.new_customers} new customer(s) joined in the last 7 days`,
      type:        'CUSTOM_MESSAGE',
      channel:     'whatsapp',
      targetType:  'new_customers',
      message:     'Welcome to {shop}, {name}! 🎉 We are so glad to have you. Visit us soon for great deals!',
      priority:    'medium',
      count:       counts.new_customers,
    });
  }

  if (counts.high_spenders > 0) {
    suggestions.push({
      id:          'high_spenders',
      title:       'VIP Customer Offer',
      description: `${counts.high_spenders} high-spending customer(s) to reward`,
      type:        'DISCOUNT_OFFER',
      channel:     'whatsapp',
      targetType:  'high_spenders',
      message:     'Hi {name}! As one of our VIP customers, we have a special offer at {shop} just for you. 🌟',
      priority:    'low',
      count:       counts.high_spenders,
    });
  }

  if (counts.frequent_buyers > 0) {
    suggestions.push({
      id:          'frequent_buyers',
      title:       'Reward Loyal Customers',
      description: `${counts.frequent_buyers} frequent buyer(s) to appreciate`,
      type:        'CUSTOM_MESSAGE',
      channel:     'whatsapp',
      targetType:  'frequent_buyers',
      message:     'Hi {name}! Thank you for being a loyal customer at {shop}. Your loyalty means everything to us! ❤️',
      priority:    'low',
      count:       counts.frequent_buyers,
    });
  }

  suggestions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return suggestions;
};

// ── Campaign stats ────────────────────────────────────────────────────────────

const getCampaignStats = async (shopId) => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const campaigns = await Campaign.find({
    shopId,
    createdAt: { $gte: monthStart },
    status: { $ne: 'scheduled' },
  }).select('totalSent totalFailed channel').lean();

  const totalCampaigns = campaigns.length;
  const totalSent      = campaigns.reduce((s, c) => s + (c.totalSent   || 0), 0);
  const totalFailed    = campaigns.reduce((s, c) => s + (c.totalFailed || 0), 0);
  const total          = totalSent + totalFailed;
  const successRate    = total === 0 ? 0 : Math.round((totalSent / total) * 100 * 10) / 10;

  const byChannel = { whatsapp: 0, sms: 0, push: 0 };
  for (const c of campaigns) {
    if (byChannel[c.channel] !== undefined) byChannel[c.channel]++;
  }

  return { totalCampaigns, totalSent, totalFailed, successRate, byChannel };
};

// ── Process scheduled campaigns ───────────────────────────────────────────────

const processScheduledCampaigns = async () => {
  const now = new Date();

  const scheduled = await Campaign.find({
    status:       'scheduled',
    scheduledFor: { $lte: now },
  }).lean();

  for (const campaign of scheduled) {
    try {
      // Mark as pending so it won't be picked up again on next tick
      await Campaign.findByIdAndUpdate(campaign._id, { status: 'pending' });

      await sendCampaignCore({
        shopId:           campaign.shopId,
        ownerId:          campaign.ownerId,
        type:             campaign.type,
        channel:          campaign.channel,
        subject:          campaign.subject,
        message:          campaign.message,
        targetType:       campaign.targetType,
        targetIds:        campaign.targetIds || [],
        automationId:     campaign.automationId,
        existingCampaignId: campaign._id,
      });
    } catch (err) {
      console.error(`[processScheduledCampaigns] Error processing campaign ${campaign._id}:`, err.message);
      await Campaign.findByIdAndUpdate(campaign._id, { status: 'failed' }).catch(() => {});
    }
  }
};

module.exports = {
  sendCampaign,
  sendReceipt,
  getDailySummary,
  sendDailySummary,
  getSegmentCounts,
  getSmartSuggestions,
  getCampaignStats,
  processScheduledCampaigns,
  getTargetCustomers,
};
