/**
 * TEST SUITE: Network Failure During Checkout
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests that the billing UI handles API failures gracefully:
 *   - Shows an error message (not a blank screen)
 *   - Does NOT clear the cart on failure (customer data preserved)
 *   - Re-enables the Pay button after failure (retry is possible)
 *   - Handles slow/timeout responses
 *   - Handles server 500 errors
 *
 * Without these tests, a network hiccup during peak hours = lost cart data
 * and an angry customer standing at the counter.
 */

describe('Network Failure During Checkout', () => {
  before(() => {
    cy.login();
  });

  beforeEach(() => {
    cy.login();
    cy.goToBilling();
    // Add any in-stock product to the cart.
    // We use a search + click here — no seeding needed since we're testing
    // UI behaviour on failure, not the specific product.
    cy.get('[data-testid="product-search"]').type('a'); // broad search
    cy.get('[data-testid^="product-card-"]', { timeout: 10000 })
      .filter(':not([data-out-of-stock="true"])')
      .first()
      .click();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-NET-001: Server 500 error — shows error toast, cart preserved', () => {
    // Force the /sales endpoint to return 500
    cy.intercept('POST', '**/sales', {
      statusCode: 500,
      body:       { success: false, message: 'Internal Server Error' },
      delay:      300,
    }).as('failedSale');

    cy.get('[data-testid="pay-button"]').click();
    cy.wait('@failedSale');

    // An error message MUST be shown — toast or inline
    cy.contains(/error|failed|something went wrong|try again/i, { timeout: 6000 })
      .should('exist');

    // Cart must NOT be cleared — item count still visible
    cy.get('[data-testid^="cart-item-"]').should('have.length.greaterThan', 0);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-NET-002: Pay button re-enabled after failed sale', () => {
    cy.intercept('POST', '**/sales', {
      statusCode: 500,
      body:       { success: false, message: 'Internal Server Error' },
    }).as('failedSale');

    cy.get('[data-testid="pay-button"]').click();
    cy.wait('@failedSale');

    // Button must become enabled again for retry
    cy.get('[data-testid="pay-button"]', { timeout: 5000 })
      .should('not.be.disabled');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-NET-003: Network timeout — shows timeout error, not blank screen', () => {
    // Simulate a very slow response (exceeds Cypress responseTimeout, but
    // we catch it before it fully times out by using forceNetworkError)
    cy.intercept('POST', '**/sales', { forceNetworkError: true }).as('networkError');

    cy.get('[data-testid="pay-button"]').click();
    cy.wait('@networkError');

    // Page must still render — no blank white screen
    cy.get('[data-testid="product-search"]').should('exist');

    // Error feedback must appear
    cy.contains(/error|failed|network|offline|try again/i, { timeout: 8000 })
      .should('exist');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-NET-004: 401 Unauthorized mid-session → redirected to login', () => {
    cy.intercept('POST', '**/sales', {
      statusCode: 401,
      body:       { success: false, message: 'Unauthorized' },
    }).as('unauthorized');

    cy.get('[data-testid="pay-button"]').click();
    cy.wait('@unauthorized');

    // Session expired → must redirect to login
    cy.url({ timeout: 8000 }).should('include', '/login');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-NET-005: 422 Validation error — shows specific message, not generic', () => {
    const SERVER_MESSAGE = 'Quantity must be a positive number';

    cy.intercept('POST', '**/sales', {
      statusCode: 422,
      body:       { success: false, message: SERVER_MESSAGE },
    }).as('validationError');

    cy.get('[data-testid="pay-button"]').click();
    cy.wait('@validationError');

    // The exact server message (or a user-friendly version) must appear
    // — not just a generic "Something went wrong"
    cy.contains(/quantity|positive|invalid/i, { timeout: 6000 }).should('exist');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-NET-006: Slow response — Pay button shows loading state', () => {
    // 3-second delay before 201 response
    cy.intercept('POST', '**/sales', (req) => {
      req.reply((res) => {
        res.setDelay(3000);
      });
    }).as('slowSale');

    cy.get('[data-testid="pay-button"]').click();

    // Immediately after click, button should be disabled (loading state)
    // This prevents double-submit
    cy.get('[data-testid="pay-button"]').should('be.disabled');

    // Wait for the slow response (use the original response, not stubbed body)
    cy.wait('@slowSale', { timeout: 10000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-NET-007: Successful retry after initial failure completes sale', () => {
    let callCount = 0;

    // First call fails, second call succeeds
    cy.intercept('POST', '**/sales', (req) => {
      callCount++;
      if (callCount === 1) {
        req.reply({ statusCode: 503, body: { message: 'Service Unavailable' } });
      } else {
        req.continue(); // pass through to real backend
      }
    }).as('retriedSale');

    // First attempt — fails
    cy.get('[data-testid="pay-button"]').click();
    cy.wait('@retriedSale');

    // Error shown, button re-enabled
    cy.contains(/error|failed|unavailable/i, { timeout: 6000 }).should('exist');
    cy.get('[data-testid="pay-button"]', { timeout: 5000 }).should('not.be.disabled');

    // Second attempt — succeeds (real API)
    cy.get('[data-testid="pay-button"]').click();
    cy.wait('@retriedSale', { timeout: 15000 });

    // Invoice modal should appear confirming successful sale
    cy.get('[data-testid="invoice-modal"]', { timeout: 10000 }).should('be.visible');
  });
});
