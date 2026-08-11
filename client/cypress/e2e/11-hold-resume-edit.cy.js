/**
 * TEST SUITE: Hold/Resume, Global Shortcut, Bill Details & Audited Edit
 * ─────────────────────────────────────────────────────────────────────────────
 * Covers the flows added alongside UPI QR:
 *   - Hold a bill then Resume it → the COMPLETE bill comes back (the old bug
 *     silently returned an empty cart)
 *   - Held bills survive a full page reload
 *   - Ctrl+B reaches Billing from any screen
 *   - Completed bill → view details → authorised edit → recalculated totals,
 *     delta-only stock adjustment and an audit entry
 */

describe('Billing — Hold/Resume, shortcut and audited bill edit', () => {
  let shopId;
  let productId;
  let taxRate = 0;
  const PRODUCT_NAME = 'Test Rice 5kg';

  // Totals the POS shows include the shop's GST
  const withTax = (units) => Math.round((200 * units) * (1 + taxRate / 100)); // statutory round-off

  before(() => {
    cy.login();
    cy.apiRequest('GET', '/shops').then((res) => {
      const shops = Array.isArray(res.body.data) ? res.body.data : res.body.data?.shops;
      shopId  = shops?.[0]?._id;
      taxRate = Number(shops?.[0]?.taxRate) || 0;
      expect(shopId).to.be.a('string');

      cy.apiRequest('POST', '/products', {
        name: PRODUCT_NAME, category: 'Groceries',
        price: 200, costPrice: 120, stock: 25, shopId,
      }).then((r) => {
        productId = r.body.data?._id || r.body.data?.product?._id;
      });
    });
  });

  after(() => {
    if (productId) cy.apiRequest('DELETE', `/products/${productId}`);
  });

  beforeEach(() => {
    cy.login();
    cy.goToBilling();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-HOLD-001: Hold a bill, then Resume restores the complete bill', () => {
    cy.addProductToCart(PRODUCT_NAME);

    // Make the bill distinctive: qty 3 + a note
    cy.getCartItem(PRODUCT_NAME).within(() => {
      cy.get('[data-testid="qty-increment"]').click();
      cy.get('[data-testid="qty-increment"]').click();
    });
    cy.get('[data-testid="order-notes"]').type('Held bill note');

    // Hold it
    cy.contains('button', 'Hold Bill').click();
    cy.contains('held — cart cleared', { timeout: 6000 }).should('exist');
    cy.contains('Cart is empty').should('exist');

    // Open the held list — must show the bill with an ID and an amount
    cy.contains('button', /^Resume \(/).click();
    cy.get('[data-testid="held-bills-list"]').within(() => {
      cy.contains('HOLD-').should('exist');
      cy.contains(`₹${withTax(3).toFixed(2)}`).should('exist');   // 200 × 3 + GST
      cy.get('[data-testid="resume-held-bill"]').first().click();
    });

    // THE REGRESSION: the cart must come back populated, not empty
    cy.contains('resumed', { timeout: 6000 }).should('exist');
    cy.contains('Cart is empty').should('not.exist');
    cy.getCartItem(PRODUCT_NAME).should('exist').within(() => {
      cy.get('input[type="number"]').first().should('have.value', '3');
    });
    cy.get('[data-testid="order-notes"]').should('have.value', 'Held bill note');

    // Resumed bill is removed from the held list
    cy.contains('button', 'Resume (0)').should('exist');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-HOLD-002: Held bills survive a page reload', () => {
    cy.addProductToCart(PRODUCT_NAME);
    cy.contains('button', 'Hold Bill').click();
    cy.contains('held — cart cleared', { timeout: 6000 }).should('exist');

    cy.reload();
    cy.get('[data-testid="product-search"]', { timeout: 12000 }).should('be.visible');

    cy.contains('button', /^Resume \(1\)/).should('exist').click();
    cy.get('[data-testid="held-bills-list"]').within(() => {
      cy.contains(`₹${withTax(1).toFixed(2)}`).should('exist');
      // clean up so later specs start from zero held bills
      cy.get('[title="Discard held bill"]').first().click();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-SHORTCUT-001: Ctrl+B opens Billing from another screen', () => {
    cy.visit('/dashboard');
    cy.get('[data-testid="global-new-bill"]', { timeout: 12000 }).should('be.visible');

    cy.get('body').type('{ctrl}b');
    cy.location('pathname', { timeout: 8000 }).should('include', '/billing');
    cy.get('[data-testid="product-search"]').should('be.visible');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-EDIT-001: Completed bill → details → edit qty → totals and stock adjust by the delta', () => {
    // Sell 4 units at ₹200 → ₹800, stock 25 → 21
    cy.addProductToCart(PRODUCT_NAME);
    cy.getCartItem(PRODUCT_NAME).within(() => {
      cy.get('[data-testid="qty-increment"]').click();
      cy.get('[data-testid="qty-increment"]').click();
      cy.get('[data-testid="qty-increment"]').click();
    });

    cy.intercept('POST', '**/sales').as('createSale');
    cy.get('[data-testid="pay-button"]').should('not.be.disabled').click();

    cy.wait('@createSale', { timeout: 15000 }).then((i) => {
      expect(i.response.statusCode).to.eq(201);
      const sale = i.response.body.data.sale;
      expect(sale.totalAmount).to.eq(withTax(4));   // 4 × ₹200 + GST
      expect(sale.paymentStatus).to.eq('paid');

      // Bill details view opens with the invoice
      cy.get('[data-testid="invoice-modal"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="payment-status-badge"]').should('contain', 'PAID');

      // Edit it: 4 → 2 units
      cy.get('[data-testid="edit-bill-button"]').click();
      cy.get('[data-testid="edit-bill-modal"]').should('be.visible');

      cy.get(`[data-testid="edit-line-${productId}"]`).within(() => {
        cy.get('input[type="number"]').first().clear().type('2');
      });

      // Totals recalculate live (tax included, same as the server)
      cy.get('[data-testid="edit-new-total"]').should('contain', withTax(2).toFixed(2));

      // Reason is mandatory
      cy.get('[data-testid="edit-save-button"]').should('be.disabled');
      cy.get('[data-testid="edit-reason"]').type('Customer returned 2 units at the counter');

      cy.intercept('PATCH', `**/sales/${sale._id}`).as('editSale');
      cy.get('[data-testid="edit-save-button"]').click();
      cy.get('[data-testid="edit-confirm-save"]').click();  // explicit confirmation

      cy.wait('@editSale', { timeout: 15000 }).then((e) => {
        expect(e.response.statusCode).to.eq(200);
        const updated = e.response.body.data.sale;

        expect(updated.totalAmount).to.eq(withTax(2));
        expect(updated.items[0].quantity).to.eq(2);
        expect(updated.editCount).to.eq(1);

        // Audit trail records who / why / before → after
        expect(updated.editHistory).to.have.length(1);
        const h = updated.editHistory[0];
        expect(h.reason).to.include('Customer returned');
        expect(h.before.totalAmount).to.eq(withTax(4));
        expect(h.after.totalAmount).to.eq(withTax(2));
        expect(h.editedByName).to.be.a('string').and.not.be.empty;
        expect(h.changes.join(' ')).to.include('qty 4 → 2');
      });

      // Stock moved by the DELTA only: 25 − 4 = 21, then +2 back → 23
      cy.apiRequest('GET', `/products/${productId}`).then((p) => {
        const product = p.body.data.product || p.body.data;
        expect(product.stock).to.eq(23);
      });

      // The audit trail is visible in the bill details view
      cy.get('[data-testid="bill-edit-history"]').should('exist')
        .and('contain', 'Customer returned');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-EDIT-002: A refunded bill cannot be edited', () => {
    cy.addProductToCart(PRODUCT_NAME);
    cy.intercept('POST', '**/sales').as('createSale');
    cy.get('[data-testid="pay-button"]').click();

    cy.wait('@createSale').then((i) => {
      const saleId = i.response.body.data.sale._id;

      // Refund it, then the edit endpoint must refuse
      cy.apiRequest('PATCH', `/sales/${saleId}/refund`).then((r) => {
        expect(r.status).to.eq(200);

        cy.apiRequest('PATCH', `/sales/${saleId}`, {
          items:  [{ productId, quantity: 1, price: 200 }],
          reason: 'should not be allowed',
        }).then((res) => {
          expect(res.status).to.eq(400);
          expect(JSON.stringify(res.body)).to.match(/completed|refunded/i);
        });
      });
    });
  });
});
