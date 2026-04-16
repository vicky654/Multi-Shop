const { processScheduledCampaigns } = require('./campaign.service');
const { runScheduledAutomations }   = require('./automation.service');
const { runErpAutomations }         = require('../erp-automation/erp-automation.service');

const start = () => {
  // Process scheduled campaigns every 2 minutes
  setInterval(
    () => processScheduledCampaigns().catch((e) => console.error('[Scheduler] campaign error:', e.message)),
    2 * 60 * 1000
  );

  // Run campaign automation rules every 30 minutes
  setInterval(
    () => runScheduledAutomations().catch((e) => console.error('[Scheduler] automation error:', e.message)),
    30 * 60 * 1000
  );

  // Run ERP business automations every 5 minutes (each automation respects its own interval)
  setInterval(
    () => runErpAutomations().catch((e) => console.error('[Scheduler] ERP automation error:', e.message)),
    5 * 60 * 1000
  );

  // Initial run after 15 seconds startup delay
  setTimeout(() => {
    processScheduledCampaigns().catch((e) => console.error('[Scheduler] init error:', e.message));
    runScheduledAutomations().catch((e) => console.error('[Scheduler] init automation error:', e.message));
    runErpAutomations().catch((e) => console.error('[Scheduler] init ERP automation error:', e.message));
  }, 15000);

  console.log('[Scheduler] Started — campaigns every 2min, automations every 30min, ERP every 5min');
};

module.exports = { start };
