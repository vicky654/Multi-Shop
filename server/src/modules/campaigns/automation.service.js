const Automation    = require('./automation.model');
const { sendCampaign } = require('./campaign.service');
const Shop          = require('../shops/shop.model');

// ── Trigger → targetType mapping ─────────────────────────────────────────────

const getTargetTypeForTrigger = (trigger) => {
  switch (trigger) {
    case 'NEW_CUSTOMER':       return 'new_customers';
    case 'INACTIVE_CUSTOMER':  return 'inactive';
    case 'DUE_PAYMENT':        return 'pending_dues';
    case 'DAILY_SUMMARY':      return 'all';
    case 'LOW_STOCK':          return 'all';
    case 'NEW_PRODUCT':        return 'all';
    default:                   return 'all';
  }
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

const createAutomation = (ownerId, data) => {
  return Automation.create({ ...data, ownerId });
};

const getAutomations = (shopId) => {
  return Automation.find({ shopId }).sort({ createdAt: -1 }).lean();
};

const updateAutomation = (id, ownerId, data) => {
  return Automation.findOneAndUpdate(
    { _id: id, ownerId },
    data,
    { new: true, runValidators: true }
  );
};

const deleteAutomation = (id, ownerId) => {
  return Automation.findOneAndDelete({ _id: id, ownerId });
};

// ── Run a single automation ───────────────────────────────────────────────────

const runAutomation = async (automation) => {
  const shop = await Shop.findById(automation.shopId).lean();
  if (!shop) throw new Error(`Shop not found for automation ${automation._id}`);

  await sendCampaign({
    shopId:     automation.shopId,
    ownerId:    automation.ownerId,
    type:       'AUTOMATION',
    channel:    automation.channel,
    subject:    automation.subject,
    message:    automation.messageTemplate,
    targetType: getTargetTypeForTrigger(automation.trigger),
    automationId: automation._id,
  });

  await Automation.findByIdAndUpdate(automation._id, {
    lastRunAt: new Date(),
    $inc: { runCount: 1 },
  });
};

// ── Scheduler entry point ─────────────────────────────────────────────────────

const SCHEDULED_TRIGGERS = ['DUE_PAYMENT', 'INACTIVE_CUSTOMER', 'DAILY_SUMMARY'];

const runScheduledAutomations = async () => {
  const automations = await Automation.find({ enabled: true }).lean();

  const now           = new Date();
  const currentHour   = now.getHours();
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  for (const automation of automations) {
    if (!SCHEDULED_TRIGGERS.includes(automation.trigger)) continue;

    const hourMatches   = automation.runHour === currentHour;
    const notRunToday   = !automation.lastRunAt || automation.lastRunAt < todayMidnight;

    if (!hourMatches || !notRunToday) continue;

    try {
      await runAutomation(automation);
    } catch (err) {
      console.error(`[runScheduledAutomations] Error running automation ${automation._id}:`, err.message);
    }
  }
};

module.exports = {
  createAutomation,
  getAutomations,
  updateAutomation,
  deleteAutomation,
  runScheduledAutomations,
};
