// ── Global support file ───────────────────────────────────────────────────────
// Runs before every spec file. Import custom commands, set global config.

import './commands';

// ── Suppress noisy-but-harmless React/browser exceptions ─────────────────────
// These are framework noise, not real test failures.
Cypress.on('uncaught:exception', (err) => {
  const ignore = [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'ChunkLoadError',
    'Minified React error',        // framer-motion unmount edge case
    'Cannot read properties of null', // React hot-reload race condition
  ];
  if (ignore.some((msg) => err.message.includes(msg))) return false;
  return true; // all other exceptions still fail the test
});

// ── Clear localStorage before each test ──────────────────────────────────────
// Use cy.clearLocalStorage() — safe even before any visit() call.
// cy.window() would fail here because no page is loaded yet.
beforeEach(() => {
  cy.clearLocalStorage('multishop:held-bills');
  cy.clearLocalStorage('ms_last_payment');
});

// ── Production-database guard ────────────────────────────────────────────────
// The E2E specs create and delete sales, products and customers. Running them
// against the live database corrupts real financial records, so before any spec
// executes we ask the API which database it is connected to and abort the whole
// run unless it is a dedicated test database.
//
// Start the API in test mode first:   npm run dev:test   (in /server)
before(() => {
  cy.request({
    method: 'GET',
    url: `${Cypress.env('apiUrl')}/test-utils/db-info`,
    failOnStatusCode: false,
  }).then((res) => {
    if (res.status === 404) {
      throw new Error(
        'ABORTED: /test-utils/db-info is not mounted, which means the API is NOT ' +
        'running in test mode. Start it with `npm run dev:test` in /server so the ' +
        'suite cannot write to the production database.'
      );
    }
    const info = res.body?.data || {};
    if (!info.isTestDb) {
      throw new Error(
        `ABORTED: the API is connected to "${info.dbName}", which is not a test ` +
        'database. Set TEST_DATABASE_URI and start the API with `npm run dev:test`.'
      );
    }
    cy.task('log', `DB guard OK — using test database "${info.dbName}"`);
  });
});

// ── Auto-cleanup ────────────────────────────────────────────────────────────
// Purge everything the run created so a shared test database does not
// accumulate test sales (which would skew report assertions on later runs).
after(() => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/test-utils/purge`,
    failOnStatusCode: false,
  }).then((res) => {
    if (res.status === 200) {
      const d = res.body?.data || {};
      cy.task('log', `Purged test data — sales:${d.salesDeleted} products:${d.productsDeleted} customers:${d.customersDeleted}`);
    }
  });
});
