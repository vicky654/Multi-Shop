/**
 * TEST SUITE: Split Payment Flow
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the split payment UI and verifies that:
 *   - Selecting multiple payment methods is reflected in the sale record
 *   - The PaymentSelector buttons toggle aria-pressed correctly
 *   - The Pay button shows the correct grand total
 *   - The sale is created with the correct payments[] array
 *
 * Business scenario: Customer pays part in cash, part via UPI (very common
 * in Indian retail — e.g. cash ₹500 + UPI ₹300 for a ₹800 total)
 */

describe('Billing — Split Payment Flow', () => {
  let shopId;
  let productId;

  const PRODUCT_NAME  = 'Split Pay Test Shirt';
  const PRODUCT_PRICE = 800;  // Clean number makes math easy to assert

  before(() => {
    cy.login();

    cy.apiRequest('GET', '/shops').then((res) => {
      shopId = res.body.data[0]?._id;

      cy.apiRequest('POST', '/products', {
        name:      PRODUCT_NAME,
        category:  'Clothing',
        price:     PRODUCT_PRICE,
        costPrice: 400,
        stock:     10,
        shopId,
      }).then((r) => {
        productId = r.body.data?._id || r.body.data?.product?._id;
      });
    });
  });

  after(() => {
    if (productId) cy.apiRequest('DELETE', `/products/${productId}`);
  });

  beforeEach(() => {
    cy.goToBilling();
    cy.addProductToCart(PRODUCT_NAME);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-SPLIT-001: Payment method buttons toggle correctly', () => {
    // Default: cash should be selected
    cy.get('[data-testid="payment-cash"]')
      .should('have.attr', 'aria-pressed', 'true');

    // Switch to UPI
    cy.get('[data-testid="payment-upi"]').click();
    cy.get('[data-testid="payment-upi"]')
      .should('have.attr', 'aria-pressed', 'true');

    // Cash should now be deselected
    cy.get('[data-testid="payment-cash"]')
      .should('have.attr', 'aria-pressed', 'false');

    // Switch back to Cash
    cy.get('[data-testid="payment-cash"]').click();
    cy.get('[data-testid="payment-cash"]')
      .should('have.attr', 'aria-pressed', 'true');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-SPLIT-002: Pay button shows correct grand total (no tax)', () => {
    // Product price = ₹800, qty = 1, no discount, no tax
    cy.get('[data-testid="pay-button"]')
      .should('contain.text', '₹800');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-SPLIT-003: UPI payment creates sale with correct paymentMethod', () => {
    cy.get('[data-testid="payment-upi"]').click();

    cy.intercept('POST', '**/sales').as('createSale');
    cy.get('[data-testid="pay-button"]').click();

    cy.wait('@createSale').then((interception) => {
      expect(interception.response.statusCode).to.eq(201);
      expect(interception.response.body.data.sale.paymentMethod).to.eq('upi');
    });

    cy.get('[data-testid="invoice-modal"]').should('be.visible');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-SPLIT-004: Split payment payload contains correct payments array', () => {
    /**
     * NOTE: The current UI is a single-method selector.
     * This test verifies that when the backend receives payments[] via API,
     * the sale is stored correctly. We test this via a direct API call
     * which simulates what a future split-payment UI would send.
     *
     * When you build the split payment UI, replace cy.apiRequest with UI steps.
     */
    cy.apiRequest('GET', '/shops').then((shopRes) => {
      const sid = shopRes.body.data[0]?._id;

      // POST a sale with a split payments[] array via direct API
      cy.apiRequest('POST', '/sales', {
        shopId: sid,
        items: [{ productId, quantity: 1 }],
        payments: [
          { method: 'cash', amount: 500 },
          { method: 'upi',  amount: 300 },
        ],
      }).then((res) => {
        expect(res.status).to.eq(201);
        const sale = res.body.data.sale;

        // Verify the payments array is stored
        expect(sale.payments).to.have.length(2);
        expect(sale.payments[0].method).to.eq('cash');
        expect(sale.payments[0].amount).to.eq(500);
        expect(sale.payments[1].method).to.eq('upi');
        expect(sale.payments[1].amount).to.eq(300);

        // paymentMethod should be 'cash' (largest tender)
        expect(sale.paymentMethod).to.eq('cash');

        // Total should equal product price
        expect(sale.totalAmount).to.be.closeTo(PRODUCT_PRICE, 1);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-SPLIT-005: Card payment method works end-to-end', () => {
    cy.get('[data-testid="payment-card"]').click();

    cy.get('[data-testid="payment-card"]')
      .should('have.attr', 'aria-pressed', 'true');

    cy.intercept('POST', '**/sales').as('createSale');
    cy.get('[data-testid="pay-button"]').click();

    cy.wait('@createSale').then((interception) => {
      expect(interception.response.body.data.sale.paymentMethod).to.eq('card');
    });

    cy.get('[data-testid="invoice-modal"]').should('be.visible');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-SPLIT-006: Credit payment shows CreditFlow component', () => {
    cy.get('[data-testid="payment-credit"]').click();

    // CreditFlow input should appear
    cy.get('[data-testid="credit-due-input"]')
      .should('be.visible');

    // Enter a due amount
    cy.get('[data-testid="credit-due-input"]')
      .clear()
      .type('800');

    // The "Due" label should show ₹800
    cy.contains('₹800').should('exist');
  });
});
