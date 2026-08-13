/**
 * Cypress config for RECORDING the workflow guides.
 *
 * Separate from cypress.config.js on purpose:
 *   • video must be ON here and stays OFF for the normal suite (recording every
 *     test run wastes minutes and disk for no benefit);
 *   • retries must be OFF — a retried test produces a video containing the failed
 *     attempt followed by the successful one, which is useless as a guide;
 *   • the specs live under cypress/e2e/guides/ and are excluded from the main
 *     suite, so `npm run cy:run` does not execute them.
 *
 * The recordings are genuine captures of the real application driving real
 * endpoints against the seeded test database. Nothing is staged or mocked: if the
 * app cannot actually do the step, the spec fails and no video is produced. That
 * is deliberate — a guide that shows something the product cannot do is worse
 * than no guide.
 *
 *   npm run guides:record          (all eight)
 *   npm run guides:record -- --spec cypress/e2e/guides/g04-creating-a-bill.cy.js
 */
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:4000',
    specPattern: 'cypress/e2e/guides/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',

    video: true,
    videosFolder: 'cypress/videos/guides',
    videoCompression: 32,          // small enough to ship, still legible
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots/guides',
    trashAssetsBeforeRuns: true,

    // A guide is watched, not scanned: a slightly larger viewport and slower
    // pacing read far better than the 1280x800 the test suite uses.
    viewportWidth: 1440,
    viewportHeight: 900,

    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 20000,
    pageLoadTimeout: 30000,

    // No retries — see the header comment.
    retries: { runMode: 0, openMode: 0 },

    env: {
      ownerEmail: 'owner@multishop.com',
      ownerPassword: 'owner123',
      apiUrl: 'http://127.0.0.1:5001/api',
      // Pauses between actions so a viewer can follow what is happening.
      guidePace: 700,
    },

    setupNodeEvents(on, config) {
      on('task', {
        log(msg) { console.log('\n[GUIDE]', msg); return null; },
      });
      return config;
    },
  },
});
