import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // ── Server endpoints ────────────────────────────────────────────────────────
    baseUrl: 'http://localhost:4000',   // Vite dev server

    // ── Spec discovery ──────────────────────────────────────────────────────────
    specPattern:    'cypress/e2e/**/*.cy.{js,jsx}',
    supportFile:    'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',

    // ── Timeouts ────────────────────────────────────────────────────────────────
    // React Query re-fetches + Framer Motion + network latency all add up.
    // Generous but not infinite — flaky tests hide here when too short.
    defaultCommandTimeout: 8000,   // cy.get / cy.contains
    requestTimeout:        12000,  // cy.request / cy.intercept wait
    responseTimeout:       15000,  // backend response window
    pageLoadTimeout:       25000,  // full SPA route transitions

    // ── Viewport ────────────────────────────────────────────────────────────────
    // Match the most common QA workstation resolution
    viewportWidth:  1280,
    viewportHeight: 800,

    // ── Failure artifacts ───────────────────────────────────────────────────────
    screenshotOnRunFailure: true,       // always capture on failure
    video:                  false,      // flip to true in CI for recordings
    videosFolder:           'cypress/videos',
    screenshotsFolder:      'cypress/screenshots',
    trashAssetsBeforeRuns:  true,       // clean stale artifacts on each run

    // ── Retries ─────────────────────────────────────────────────────────────────
    // CI: 2 retries absorbs transient network hiccups without masking real bugs
    // Local: 0 retries so you see real failures immediately
    retries: {
      runMode:  2,
      openMode: 0,
    },

    // ── Environment variables ───────────────────────────────────────────────────
    // Override any of these in cypress.env.json (gitignored) or CI env vars.
    // Cypress merges: config.env < cypress.env.json < --env CLI flag
    env: {
      // ── Auth ──────────────────────────────────────────────────────────────────
      ownerEmail:      'owner@multishop.com',
      ownerPassword:   'owner123',
      managerEmail:    'manager@multishop.com',
      managerPassword: 'manager123',

      // ── API base (backend port = 5001) ────────────────────────────────────────
      apiUrl: 'http://localhost:5001/api',

      // ── Feature flags for conditional test behavior ───────────────────────────
      skipSlowTests:   false,  // set true in cypress.env.json to skip long suites
    },

    setupNodeEvents(on, config) {
      // ── Task: log to terminal from test code ─────────────────────────────────
      on('task', {
        log(msg) {
          console.log('\n[CYPRESS]', msg);
          return null;
        },
      });

      return config;
    },
  },
});
