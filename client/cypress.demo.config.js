import { defineConfig } from 'cypress';

/**
 * Cypress config for Demo Asset Automation (marketing screenshots + video).
 *
 * Separate from cypress.config.js so the demo run cannot pick up E2E specs and
 * the E2E run cannot pick up demo specs. Ports, viewport and credentials are all
 * injected by scripts/demo/update.mjs from .env.demo — nothing is hardcoded.
 *
 * Video: Cypress records H.264 MP4 natively via its bundled ffmpeg, which is why
 * no extra recording dependency is needed.
 */
const PORT_WEB = process.env.DEMO_WEB_PORT || '4055';

export default defineConfig({
  e2e: {
    baseUrl: `http://127.0.0.1:${PORT_WEB}`,

    specPattern:    'cypress/demo/**/*.cy.js',
    supportFile:    'cypress/demo/support.js',
    fixturesFolder: false,

    screenshotsFolder: 'cypress/demo-output/images',
    videosFolder:      'cypress/demo-output/video',
    // MUST stay false: the pipeline runs Cypress twice (screenshots, then video)
    // and trashing would make the video run delete the screenshots the first run
    // just produced. update.mjs clears the whole demo-output folder once instead.
    trashAssetsBeforeRuns: false,

    // Marketing assets want a clean 16:9 frame
    viewportWidth:  Number(process.env.DEMO_VIEWPORT_WIDTH  || 1600),
    viewportHeight: Number(process.env.DEMO_VIEWPORT_HEIGHT || 900),

    // Always on. A CLI `--config video=…` override proved unreliable here, so the
    // config is the single source of truth and publish.mjs picks the tour video by
    // spec name (the screenshot run's throwaway video is ignored).
    video: true,
    videoCompression: 26,          // smaller file, still crisp for web

    // Cypress 12+ resets cookies/localStorage between tests. This run injects an
    // auth token once in `before()`, so isolation would log us out after the
    // first capture and every later module would render the login screen.
    // A capture run is one continuous session by design.
    testIsolation: false,

    // Marketing capture waits on real data loading over a real API
    defaultCommandTimeout: 15000,
    requestTimeout:        20000,
    responseTimeout:       25000,
    pageLoadTimeout:       40000,

    // A flaky retry would produce duplicate/garbled video, so never retry
    retries: { runMode: 0, openMode: 0 },

    env: {
      // Deliberately NOT named `apiUrl`. client/cypress.env.json defines `apiUrl`
      // for the E2E suite (pointing at the DEV API on :5001) and cypress.env.json
      // OVERRIDES config.env — which silently sent demo logins to the development
      // database and failed with 401.
      demoApiUrl:   process.env.DEMO_API_URL  || `http://127.0.0.1:${process.env.DEMO_API_PORT || '5055'}/api`,
      demoEmail:    process.env.DEMO_EMAIL    || '',
      demoPassword: process.env.DEMO_PASSWORD || '',
      companyName:  process.env.DEMO_COMPANY_NAME || 'Nova Retail Group',
    },

    setupNodeEvents(on) {
      on('task', {
        log(msg) { console.log('   ·', msg); return null; },
      });

      // Setting viewportWidth/Height alone is NOT enough for capture: in
      // `cypress run` the headless browser WINDOW is 1280×720, and Cypress scales
      // the app to fit it — so screenshots and video came out 1280×720 no matter
      // what the viewport said. Size the actual browser window to match.
      on('before:browser:launch', (browser = {}, launchOptions) => {
        const w = Number(process.env.DEMO_VIEWPORT_WIDTH  || 1600);
        const h = Number(process.env.DEMO_VIEWPORT_HEIGHT || 900);

        if (browser.name === 'electron') {
          launchOptions.preferences.width  = w;
          launchOptions.preferences.height = h;
        } else if (browser.family === 'chromium') {
          launchOptions.args.push(`--window-size=${w},${h}`);
          launchOptions.args.push('--force-device-scale-factor=1');
        }
        return launchOptions;
      });
    },
  },
});
