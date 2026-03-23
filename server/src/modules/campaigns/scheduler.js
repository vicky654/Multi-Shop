const { processScheduledCampaigns } = require('./campaign.service');
const { runScheduledAutomations }   = require('./automation.service');

const start = () => {
  // Process scheduled campaigns every 2 minutes
  setInterval(
    () => processScheduledCampaigns().catch((e) => console.error('[Scheduler] campaign error:', e.message)),
    2 * 60 * 1000
  );

  // Run automation rules every 30 minutes
  setInterval(
    () => runScheduledAutomations().catch((e) => console.error('[Scheduler] automation error:', e.message)),
    30 * 60 * 1000
  );

  // Initial run after 8 seconds startup delay
  setTimeout(() => {
    processScheduledCampaigns().catch((e) => console.error('[Scheduler] init error:', e.message));
    runScheduledAutomations().catch((e) => console.error('[Scheduler] init automation error:', e.message));
  }, 8000);

  console.log('[Scheduler] Started — checking campaigns every 2min, automations every 30min');
};

module.exports = { start };
