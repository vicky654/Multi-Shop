// ─────────────────────────────────────────────────────────────────────────────
//  Demo capture support — login + presentation helpers
// ─────────────────────────────────────────────────────────────────────────────

// Framework noise must never abort a capture run mid-video.
Cypress.on('uncaught:exception', () => false);

// Session captured once by cy.demoLogin() and replayed into every page load.
let session = { token: null, user: null };

/**
 * Seed auth + first-run state into a page BEFORE its bundle evaluates.
 *
 * This has to happen in `onBeforeLoad`, not after the visit, because:
 *   1. authStore reads `localStorage.ms_token` at MODULE-LOAD time
 *      (`token: localStorage.getItem(TOKEN_KEY)`), so a token written after the
 *      app boots is never seen — ProtectedRoute redirects to /login.
 *   2. Loading a page without a token fires authenticated requests that 401, and
 *      the axios interceptor responds by REMOVING ms_token — racing with, and
 *      erasing, any token injected afterwards.
 */
function seedSession(win) {
  if (!session.token) return;
  win.localStorage.setItem('ms_token', session.token);
  if (session.user) win.localStorage.setItem('user', JSON.stringify(session.user));

  // Suppress first-run overlays so they never cover a marketing asset
  win.localStorage.setItem('multishop_has_seen_tour_v1', 'true');
  win.localStorage.setItem('ms-setup-v1', JSON.stringify({
    state: {
      hasProducts: true, hasCustomers: true, hasSales: true,
      modalDismissed: true, isDemoMode: false,
    },
    version: 1,
  }));
}

/**
 * cy.demoLogin()
 *
 * Authenticates via the API, so the login form is NEVER rendered and the password
 * is NEVER typed on screen. That matters here: this run records video, and a
 * keystroke-by-keystroke password would be baked into a file published to a
 * marketing site. `{ log: false }` also keeps credentials out of the command log,
 * which is visible in the recorded frame.
 */
Cypress.Commands.add('demoLogin', () => {
  const email    = Cypress.env('demoEmail');
  const password = Cypress.env('demoPassword');

  if (!email || !password) {
    throw new Error('demoEmail/demoPassword missing — check .env.demo');
  }

  cy.request({
    method: 'POST',
    url: `${Cypress.env('demoApiUrl')}/auth/login`,
    body: { email, password },
    failOnStatusCode: false,
    log: false,                       // never echo credentials
  }).then((res) => {
    expect(res.status, 'demo login').to.eq(200);
    session = { token: res.body.data.token, user: res.body.data.user || null };
    expect(session.token, 'demo auth token').to.be.a('string');
  });
});

/**
 * cy.gotoModule(route)
 * Visit an authenticated route with the session pre-seeded, then wait until the
 * screen has actually painted its data — never a spinner or a login redirect.
 */
Cypress.Commands.add('gotoModule', (route) => {
  cy.visit(route, { onBeforeLoad: seedSession });

  // Never capture the login screen into a marketing asset
  cy.location('pathname', { timeout: 20000 }).should('not.include', '/login');

  cy.get('body').should('be.visible');

  // Wait for every spinner to clear — including widgets that start loading after
  // the first paint, which a single point-in-time check missed (a spinning
  // "Quick Summary" tile shipped into a marketing screenshot).
  // Polls rather than asserts: one permanently-loading widget should degrade the
  // asset (hideVolatile hides it), not fail the whole capture run.
  const waitForSpinners = (attemptsLeft) => {
    cy.get('body').then(($b) => {
      if ($b.find('.animate-spin').length === 0 || attemptsLeft <= 0) return;
      cy.wait(700);
      waitForSpinners(attemptsLeft - 1);
    });
  };
  waitForSpinners(40);          // up to ~28s — dashboard aggregations are slow

  cy.wait(1200); // let charts finish their entry animation
});

/**
 * cy.settle(ms) — a readable pause for video pacing.
 */
Cypress.Commands.add('settle', (ms = 1200) => cy.wait(ms));

/**
 * cy.hideVolatile()
 * Hide anything that changes run-to-run or would clutter a published asset.
 */
Cypress.Commands.add('hideVolatile', () => {
  cy.document().then((doc) => {
    if (!doc.getElementById('demo-capture-style')) {
      const style = doc.createElement('style');
      style.id = 'demo-capture-style';
      style.innerHTML = `
        [data-testid="global-new-bill"] { display: none !important; }
        .Toastify, [class*="toast"] { display: none !important; }
        /* A spinner that never resolved must not ship in a marketing asset */
        .animate-spin { visibility: hidden !important; }
        /* In-app demo/onboarding promo strips ("Try Demo", "Demo Mode Active").
           Done in CSS, not inline styles: React re-renders between hideVolatile
           and the screenshot and would restore an inline display:none. */
        .shrink-0.bg-indigo-50,
        .shrink-0.bg-amber-50 { display: none !important; }
      `;
      doc.head.appendChild(style);
    }

    // Hide the in-app demo/onboarding promo strips. Matched by their BUTTON TEXT
    // rather than by class or position, so restyling the banner won't silently
    // reintroduce it into published screenshots.
    const PROMO_LABELS = ['Try Demo', 'Regenerate', 'Clear Demo'];
    for (const btn of Array.from(doc.querySelectorAll('button'))) {
      const label = (btn.textContent || '').trim();
      if (!PROMO_LABELS.some((l) => label === l)) continue;
      // Walk up to the banner strip that spans the content width
      const banner = btn.closest('div.shrink-0') || btn.parentElement?.parentElement;
      if (banner) banner.style.display = 'none';
    }
  });
});
