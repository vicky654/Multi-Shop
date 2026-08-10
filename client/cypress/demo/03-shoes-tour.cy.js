/**
 * Vicky Shoes — full product demo video.
 *
 * Cypress records this run as H.264 MP4 via its bundled ffmpeg, so this spec IS
 * the video. It drives the real UI against the isolated demo database.
 *
 * Route + data-testid selectors only — no coordinates.
 */
const PACE = Number(Cypress.env('pace')) || 0.5;
const beat = (ms) => cy.settle(Math.round(ms * PACE));

let slug = '';

describe('Vicky Shoes — store + billing walkthrough', () => {
  before(() => {
    cy.demoLogin();
    cy.request(`${Cypress.env('demoApiUrl')}/shops/public`).then((r) => {
      slug = (r.body.data.shops || [])[0]?.slug || 'vicky-shoes';
    });
  });

  it('walks the complete flow', () => {
    // ── 1. Dashboard ─────────────────────────────────────────────────────────
    cy.gotoModule('/dashboard');
    cy.hideVolatile();
    cy.contains('Sales Trend', { timeout: 30000 }).should('exist');
    beat(3500);

    // ── 2. Inventory + shoe variants ─────────────────────────────────────────
    cy.gotoModule('/inventory');
    cy.hideVolatile();
    beat(2500);
    cy.get('main').scrollTo(0, 400, { duration: 1200, ensureScrollable: false });
    beat(2000);
    cy.get('main').scrollTo(0, 0, { duration: 700, ensureScrollable: false });
    beat(800);

    // ── 3. Customers ─────────────────────────────────────────────────────────
    cy.gotoModule('/customers');
    cy.hideVolatile();
    beat(2600);

    // ── 4. Staff + Roles ─────────────────────────────────────────────────────
    cy.gotoModule('/users');
    cy.hideVolatile();
    beat(2200);
    cy.gotoModule('/roles');
    cy.hideVolatile();
    beat(2200);

    // ── 5. Expenses ──────────────────────────────────────────────────────────
    cy.gotoModule('/expenses');
    cy.hideVolatile();
    beat(2400);

    // ── 6. Billing: search → variant → qty → discount → GST ──────────────────
    cy.gotoModule('/billing');
    cy.hideVolatile();
    beat(1500);

    cy.get('[data-testid="product-search"]').should('be.visible').type('Runner', { delay: 100 });
    beat(2000);
    cy.get('body').then(($b) => {
      if ($b.find('[data-testid^="product-card-"]').length) {
        cy.get('[data-testid^="product-card-"]').first().click();
        beat(1200);
        cy.get('[data-testid="qty-increment"]').first().click();
        beat(700);
        cy.get('[data-testid="discount-input"]').first().clear().type('10', { delay: 130 });
        beat(1600);
      }
    });

    // Second item so the bill looks real
    cy.get('[data-testid="product-search"]').clear().type('Oxford', { delay: 100 });
    beat(1800);
    cy.get('body').then(($b) => {
      if ($b.find('[data-testid^="product-card-"]').length) {
        cy.get('[data-testid^="product-card-"]').first().click();
        beat(1400);
      }
    });

    // GST preset
    cy.get('body').then(($b) => {
      if ($b.find('button:contains("12%")').length) {
        cy.contains('button', '12%').click();
        beat(1500);
      }
    });

    // ── 7. Hold bill → Resume bill ───────────────────────────────────────────
    cy.contains('button', 'Hold Bill').click();
    beat(1800);
    cy.contains('button', /^Resume \(/).click();
    beat(1200);
    cy.get('[data-testid="resume-held-bill"]').first().click();
    beat(2200);

    // ── 8. Payment methods incl. UPI QR ──────────────────────────────────────
    cy.get('[data-testid="payment-cash"]').click();
    beat(1400);
    cy.get('[data-testid="payment-card"]').click();
    beat(1100);
    cy.get('[data-testid="payment-upi"]').click();
    beat(1100);

    cy.get('body').then(($b) => {
      if ($b.find('[data-testid="payment-upi_qr"]').length) {
        cy.get('[data-testid="payment-upi_qr"]').click();
        beat(1800);
      }
    });

    // ── 9. Complete the sale (cash) → invoice ────────────────────────────────
    cy.get('[data-testid="payment-cash"]').click();
    beat(900);
    cy.get('[data-testid="pay-button"]').should('not.be.disabled').click();
    cy.get('[data-testid="invoice-modal"]', { timeout: 25000 }).should('be.visible');
    beat(3200);

    // ── 10. Edit Bill → audit trail ──────────────────────────────────────────
    cy.get('body').then(($b) => {
      if ($b.find('[data-testid="edit-bill-button"]').length) {
        cy.get('[data-testid="edit-bill-button"]').click();
        cy.get('[data-testid="edit-bill-modal"]').should('be.visible');
        beat(1800);
        cy.get('[data-testid="edit-bill-modal"]').find('input[type="number"]').first().clear().type('1');
        beat(1200);
        cy.get('[data-testid="edit-reason"]').type('Customer swapped size at counter', { delay: 55 });
        beat(1500);
        cy.get('[data-testid="edit-save-button"]').click();
        beat(900);
        cy.get('[data-testid="edit-confirm-save"]').click();
        cy.get('[data-testid="bill-edit-history"]', { timeout: 25000 }).should('exist');
        beat(3400);
      }
    });
    cy.get('body').then(($b) => {
      const close = $b.find('[data-testid="invoice-modal"] button');
      if (close.length) cy.get('[data-testid="invoice-modal"]').find('button').last().click({ force: true });
    });
    beat(800);

    // ── 11. Orders + Reports ─────────────────────────────────────────────────
    cy.gotoModule('/orders');
    cy.hideVolatile();
    beat(2800);

    cy.gotoModule('/reports');
    cy.hideVolatile();
    beat(3200);
    cy.get('main').scrollTo(0, 450, { duration: 1300, ensureScrollable: false });
    beat(2000);

    // ── 12. Customer storefront ──────────────────────────────────────────────
    cy.visit(`/shop/${slug}`);
    cy.get('article', { timeout: 30000 }).should('exist');
    beat(3200);
    cy.get('main').scrollTo(0, 700, { duration: 1500, ensureScrollable: false });
    beat(2200);

    // Search + listing
    cy.get('input[aria-label="Search products"]').first().type('boot{enter}');
    cy.get('article', { timeout: 25000 }).should('exist');
    beat(2600);

    // Product detail → size selection → add to cart
    cy.get('article h3').first().click();
    beat(2600);
    cy.get('body').then(($b) => {
      const size = $b.find('button:contains("9")').first();
      if (size.length) { cy.wrap(size).click({ force: true }); beat(1100); }
    });
    cy.get('body').then(($b) => {
      const add = $b.find('button:contains("Add to Cart"), button:contains("Add to cart")').first();
      if (add.length) { cy.wrap(add).click({ force: true }); beat(1600); }
    });

    // Cart → checkout
    cy.visit(`/shop/${slug}/cart`);
    beat(2400);
    cy.get('body').then(($b) => {
      if ($b.find('input[placeholder="Your name"]').length) {
        cy.get('input[placeholder="Your name"]').type('Demo Shopper', { delay: 55 });
        cy.get('input[placeholder="10-digit mobile"]').type('9876500011', { delay: 45 });
        beat(2000);
      }
    });
    beat(2600);
  });
});
