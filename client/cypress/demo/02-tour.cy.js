/**
 * Demo video — a paced walkthrough of the live app.
 *
 * Cypress records the run as H.264 MP4 via its bundled ffmpeg, so this spec IS
 * the video. Pacing is tuned to land in the 60–120s target; `PACE` scales every
 * dwell if the total drifts.
 *
 * Deliberately drives the real UI (typing into the real search box, clicking the
 * real stepper) rather than stubbing, so the video always reflects what shipped.
 */

const PACE = 1;                       // scale all dwell times
const beat  = (ms) => cy.settle(Math.round(ms * PACE));

describe('Demo assets — product tour video', () => {
  before(() => {
    cy.demoLogin();
  });

  it('walks the core workflow end to end', () => {
    // ── 1. Dashboard: the money overview ─────────────────────────────────────
    cy.gotoModule('/dashboard');
    cy.hideVolatile();
    cy.location('pathname').should('eq', '/dashboard');
    beat(3500);

    // ── 2. Inventory: catalogue and stock health ──────────────────────────────
    cy.gotoModule('/inventory');
    cy.hideVolatile();
    beat(3000);
    // Scroll the catalogue so the viewer sees real depth of data
    cy.get('main').scrollTo(0, 380, { duration: 1200, ensureScrollable: false });
    beat(1600);
    cy.get('main').scrollTo(0, 0, { duration: 800, ensureScrollable: false });
    beat(1000);

    // ── 3. Billing: the POS, driven for real ─────────────────────────────────
    cy.gotoModule('/billing');
    cy.hideVolatile();
    beat(1800);

    // Search a product by name — real debounce, real API
    cy.get('[data-testid="product-search"]').should('be.visible').type('shirt', { delay: 110 });
    beat(2200);

    cy.get('body').then(($b) => {
      if ($b.find('[data-testid^="product-card-"]').length) {
        cy.get('[data-testid^="product-card-"]').first().click();
        beat(1400);

        // Quantity + a discount, so the totals visibly recalculate
        cy.get('[data-testid="qty-increment"]').first().click();
        beat(700);
        cy.get('[data-testid="qty-increment"]').first().click();
        beat(900);
        cy.get('[data-testid="discount-input"]').first().clear().type('10', { delay: 140 });
        beat(1800);
      } else {
        cy.task('log', 'no product matched "shirt" — skipping cart demo');
      }
    });

    // GST preset — tax recalculates live
    cy.get('body').then(($b) => {
      if ($b.find('button:contains("18%")').length) {
        cy.contains('button', '18%').click();
        beat(1800);
      }
    });

    // Payment options, including scan-to-pay if configured
    cy.get('[data-testid="payment-cash"]').click();
    beat(1600);
    cy.get('[data-testid="payment-card"]').click();
    beat(1200);

    // ── 4. Orders: bill history ──────────────────────────────────────────────
    cy.gotoModule('/orders');
    cy.hideVolatile();
    beat(3200);

    // ── 5. Customers: CRM + credit ───────────────────────────────────────────
    cy.gotoModule('/customers');
    cy.hideVolatile();
    beat(3000);

    // ── 6. Reports: the charts marketing cares about ─────────────────────────
    cy.gotoModule('/reports');
    cy.hideVolatile();
    beat(4000);
    cy.get('main').scrollTo(0, 420, { duration: 1400, ensureScrollable: false });
    beat(2200);
    cy.get('main').scrollTo(0, 0, { duration: 800, ensureScrollable: false });

    // ── 7. AI Insights ───────────────────────────────────────────────────────
    cy.gotoModule('/ai-insights');
    cy.hideVolatile();
    beat(3800);

    // ── 8. Expenses ──────────────────────────────────────────────────────────
    cy.gotoModule('/expenses');
    cy.hideVolatile();
    beat(2800);

    // ── 9. Campaigns + Automations ───────────────────────────────────────────
    cy.gotoModule('/campaigns');
    cy.hideVolatile();
    beat(2800);

    cy.gotoModule('/automations');
    cy.hideVolatile();
    beat(2800);

    // ── 10. Roles + Staff: multi-user control ────────────────────────────────
    cy.gotoModule('/roles');
    cy.hideVolatile();
    beat(2600);

    cy.gotoModule('/users');
    cy.hideVolatile();
    beat(2600);

    // ── 11. Settings: close on configurability ───────────────────────────────
    cy.gotoModule('/settings');
    cy.hideVolatile();
    beat(2400);
    cy.get('main').scrollTo(0, 360, { duration: 1200, ensureScrollable: false });
    beat(2000);

    // Land back on the dashboard — a clean final frame for the poster image
    cy.gotoModule('/dashboard');
    cy.hideVolatile();
    beat(3000);
  });
});
