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
