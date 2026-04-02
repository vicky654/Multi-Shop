/**
 * TEST SUITE: Payment Mismatch Protection
 * ─────────────────────────────────────────────────────────────────────────────
 * Business rule: the sum of all split payment amounts must equal the order
 * total. If it doesn't, the backend must reject it — otherwise the business
 * loses money silently.
 *
 * Real scenario: cashier types ₹500 cash + ₹200 UPI for a ₹800 item.
 * The ₹100 gap should NEVER be silently ignored.
 */

describe('Payment Mismatch Protection', () => {
  let productId;

  const PRODUCT_PRICE = 800;

  before(() => {
    cy.login();
    cy.seedProduct({
      name:  'Mismatch Test Product',
      price:  PRODUCT_PRICE,
      stock:  20,
    }).then(({ productId: id }) => {
      productId = id;
    });
  });

  after(() => {
    if (productId) cy.apiRequest('DELETE', `/products/${productId}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-PAY-001: Split payments under-total → rejected', () => {
    cy.getShopId().then((shopId) => {
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId, quantity: 1 }],
        payments: [
          { method: 'cash', amount: 500 },
          { method: 'upi',  amount: 200 },
          // total provided = ₹700 but item costs ₹800 → ₹100 short
        ],
      }).then((res) => {
        expect(res.status).to.be.oneOf([400, 422]);
        const msg = (res.body.message || res.body.error || '').toLowerCase();
        expect(msg).to.match(/payment|amount|mismatch|total|balance/);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-PAY-002: Split payments over-total → rejected', () => {
    cy.getShopId().then((shopId) => {
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId, quantity: 1 }],
        payments: [
          { method: 'cash', amount: 500 },
          { method: 'upi',  amount: 600 },
          // total provided = ₹1100 but item costs ₹800 → ₹300 over
        ],
      }).then((res) => {
        expect(res.status).to.be.oneOf([400, 422]);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-PAY-003: Exact split payment total → accepted', () => {
    cy.getShopId().then((shopId) => {
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId, quantity: 1 }],
        payments: [
          { method: 'cash', amount: 500 },
          { method: 'upi',  amount: 300 },
          // total = ₹800 exactly ✓
        ],
      }).then((res) => {
        expect(res.status).to.eq(201);
        const sale = res.body.data.sale;
        expect(sale.totalAmount).to.be.closeTo(PRODUCT_PRICE, 1);
        expect(sale.payments).to.have.length(2);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-PAY-004: Zero-amount payment entry is rejected', () => {
    cy.getShopId().then((shopId) => {
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId, quantity: 1 }],
        payments: [
          { method: 'cash', amount: 0 },   // ← invalid
          { method: 'upi',  amount: 800 },
        ],
      }).then((res) => {
        expect(res.status).to.be.oneOf([400, 422]);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-PAY-005: Negative payment amount is rejected', () => {
    cy.getShopId().then((shopId) => {
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId, quantity: 1 }],
        payments: [
          { method: 'cash', amount: -200 }, // ← invalid
          { method: 'upi',  amount: 1000 },
        ],
      }).then((res) => {
        expect(res.status).to.be.oneOf([400, 422]);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-PAY-006: UI Pay button disabled when split amounts do not sum to total', () => {
    /**
     * This test verifies the frontend validation layer.
     * If the split payment UI is implemented, inputs that don't sum to total
     * should keep the Pay button disabled.
     *
     * Currently the UI uses single-method selection, so this test validates
     * that the single-method Pay button DOES show the correct total.
     * Replace the steps below when the split-payment UI is built.
     */
    cy.goToBilling();
    cy.addProductToCart('Mismatch Test Product');

    // With single-method, Pay button should show ₹800 and be enabled
    cy.get('[data-testid="pay-button"]')
      .should('not.be.disabled')
      .should('contain.text', '₹800');
  });
});
