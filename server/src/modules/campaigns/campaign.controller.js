const Campaign = require('./campaign.model');
const {
  sendCampaign,
  sendReceipt,
  getDailySummary,
  sendDailySummary,
  getSegmentCounts,
  getSmartSuggestions,
  getCampaignStats,
  getTargetCustomers,
} = require('./campaign.service');

// POST /api/campaigns
const send = async (req, res) => {
  const { shopId, type, channel, subject, message, targetType, targetIds, scheduledFor, automationId } = req.body;
  if (!shopId || !type || !channel || !message) {
    return res.status(400).json({ message: 'shopId, type, channel and message are required' });
  }

  const campaign = await sendCampaign({
    shopId,
    ownerId:      req.user._id,
    type, channel, subject, message,
    targetType:   targetType   || 'all',
    targetIds:    targetIds    || [],
    scheduledFor: scheduledFor || null,
    automationId: automationId || null,
  });

  res.status(201).json({ campaign });
};

// GET /api/campaigns?shopId=xxx&limit=20&page=1
const history = async (req, res) => {
  const { shopId, limit = 20, page = 1 } = req.query;
  if (!shopId) return res.status(400).json({ message: 'shopId is required' });

  const skip = (Number(page) - 1) * Number(limit);
  const [campaigns, total] = await Promise.all([
    Campaign.find({ shopId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Campaign.countDocuments({ shopId }),
  ]);

  res.json({ campaigns, total, page: Number(page), limit: Number(limit) });
};

// POST /api/campaigns/receipt
const receipt = async (req, res) => {
  const { shopId, customerId, sale, channel } = req.body;
  if (!shopId || !customerId || !sale || !channel) {
    return res.status(400).json({ message: 'shopId, customerId, sale and channel are required' });
  }

  const campaign = await sendReceipt({
    shopId,
    ownerId: req.user._id,
    customerId,
    sale,
    channel,
  });

  res.status(201).json({ campaign });
};

// GET /api/campaigns/daily-summary?shopId=xxx
const getDailySummaryHandler = async (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.status(400).json({ message: 'shopId is required' });

  const summary = await getDailySummary(shopId);
  res.json({ summary });
};

// POST /api/campaigns/daily-summary
const sendDailySummaryHandler = async (req, res) => {
  const { shopId } = req.body;
  if (!shopId) return res.status(400).json({ message: 'shopId is required' });

  const { campaign, summary } = await sendDailySummary({
    shopId,
    ownerId: req.user._id,
  });

  res.status(201).json({ campaign, summary });
};

// GET /api/campaigns/segments?shopId=xxx
const segments = async (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.status(400).json({ message: 'shopId is required' });

  const counts = await getSegmentCounts(shopId);
  res.json({ segments: counts });
};

// GET /api/campaigns/suggestions?shopId=xxx
const suggestions = async (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.status(400).json({ message: 'shopId is required' });

  const data = await getSmartSuggestions(shopId);
  res.json({ suggestions: data });
};

// GET /api/campaigns/stats?shopId=xxx
const stats = async (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.status(400).json({ message: 'shopId is required' });

  const data = await getCampaignStats(shopId);
  res.json({ stats: data });
};

// GET /api/campaigns/segment-customers?shopId=xxx&targetType=yyy&targetIds=[...]
// Returns minimal customer data (name + phone) for client-side WhatsApp link generation.
const segmentCustomers = async (req, res) => {
  const { shopId, targetType = 'all', targetIds } = req.query;
  if (!shopId) return res.status(400).json({ message: 'shopId is required' });

  let ids = [];
  if (targetIds) {
    try { ids = JSON.parse(targetIds); } catch { ids = []; }
  }

  const customers = await getTargetCustomers(shopId, targetType, ids);

  // Return all contacts including those missing phone (Verify step shows them for editing)
  const result = customers.map((c) => ({
    _id:   c._id,
    name:  c.name,
    phone: c.phone || '',
    email: c.email || '',
  }));

  res.json({ customers: result, total: result.length });
};

module.exports = {
  send,
  history,
  receipt,
  getDailySummaryHandler,
  sendDailySummaryHandler,
  segments,
  suggestions,
  stats,
  segmentCustomers,
};
