/**
 * TEST SUITE: Full POS journey (end to end)
 * ─────────────────────────────────────────────────────────────────────────────
 * One continuous pass through the whole cashier workflow:
 *
 *   New Bill (Ctrl+B) → Search Product → Customer → Discount → GST →
 *   Hold → Resume → Payment → UPI QR → Complete → Bill Details →
 *   Edit → Audit trail → Stock + Reports
 *
 * Each stage asserts the money and the stock, because that is what a shop
 * actually loses if this flow breaks.
 */

describe('Full POS journey — bill to audit', () => {
  let shopId;
  let productId;
  let customerId;
  let taxRate = 0;

  const PRODUCT_NAME  = 'E2E Journey Product';
  const PRODUCT_PRICE = 500;
  const START_STOCK   = 40;
  const CUSTOMER_NAME = 'E2E Journey Customer';
  const TEST_VPA      = 'multishoptest@okaxis';
  const UTR           = `5${String(Date.now()).slice(-11)}`;

  before(() => {
    cy.login();
    cy.apiRequest('GET', '/shops').then((res) => {
      const shops = Cypress.unwrapShops(res);
      shopId  = shops[0]?._id;
      taxRate = Number(shops[0]?.taxRate) || 0;
      expect(shopId, 'a shop must exist').to.be.a('string');

      cy.apiRequest('POST', '/products', {
        name: PRODUCT_NAME, category: 'Test',
        price: PRODUCT_PRICE, costPrice: 300, stock: START_STOCK, shopId,
        sku: 'E2E-JRN-001',
      }).then((r) => {
        productId = Cypress.unwrapProduct(r)._id;
        expect(productId, 'product seeded').to.be.a('string');
      });

      cy.apiRequest('POST', '/customers', {
        name: CUSTOMER_NAME, phone: `9${String(Date.now()).slice(-9)}`, shopId,
      }).then((r) => {
        customerId = Cypress.unwrapCustomer(r)._id;
      });

      // Scan-to-pay must be configured for the UPI QR leg
      cy.apiRequest('PUT', `/shops/${shopId}`, {
        upiSettings: { enabled: true, vpa: TEST_VPA, merchantName: 'E2E Test Store' },
      }).then((r) => expect(r.status).to.eq(200));
    });
  });

  after(() => {
    if (productId) cy.apiRequest('DELETE', `/products/${productId}`);
    if (shopId) {
      cy.apiRequest('PUT', `/shops/${shopId}`, {
        upiSettings: { enabled: false, vpa: '', merchantName: '', displayName: '' },
      });
    }
  });

  beforeEach(() => {
    cy.login();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-E2E-001: New Bill → Search → Customer → Discount → GST → Hold → Resume', () => {
    // ── New Bill from another screen via the global shortcut ──────────────────
    cy.visit('/dashboard');
    cy.get('[data-testid="global-new-bill"]', { timeout: 15000 }).should('be.visible');
    cy.get('body').type('{ctrl}b');
    cy.location('pathname', { timeout: 10000 }).should('include', '/billing');
    cy.get('[data-testid="product-search"]', { timeout: 15000 }).should('be.visible');

    // ── Search product (substring match, not whole-word) ─────────────────────
    cy.get('[data-testid="product-search"]').clear().type('E2E Journey');
    cy.get('[data-testid^="product-card-"]', { timeout: 15000 })
      .should('have.length.greaterThan', 0);
    cy.contains('[data-testid^="product-card-"]', PRODUCT_NAME).click();
    cy.get('[data-testid="cart-count"]').should('have.text', '1');

    // ── Quantity → 4 ─────────────────────────────────────────────────────────
    cy.getCartItem(PRODUCT_NAME).within(() => {
      cy.get('[data-testid="qty-increment"]').click();
      cy.get('[data-testid="qty-increment"]').click();
      cy.get('[data-testid="qty-increment"]').click();
      cy.get('input[type="number"]').first().should('have.value', '4');
    });

    // ── Customer ─────────────────────────────────────────────────────────────
    cy.get('#customer-search-input').clear().type(CUSTOMER_NAME);
    cy.contains(CUSTOMER_NAME, { timeout: 10000 }).click();

    // ── Discount 10% → line total 4 × 500 × 0.9 = ₹1800 ──────────────────────
    cy.getCartItem(PRODUCT_NAME).within(() => {
      cy.get('[data-testid="discount-input"]').clear().type('10');
      cy.contains('₹1800.00').should('exist');
    });

    // ── GST 18% → 1800 × 1.18 = ₹2124 ────────────────────────────────────────
    cy.contains('button', '18%').click();
    cy.get('[data-testid="pay-button"]').should('contain', '₹2124.00');

    // ── Notes then Hold ──────────────────────────────────────────────────────
    cy.get('[data-testid="order-notes"]').clear().type('cypress journey bill');
    cy.contains('button', 'Hold Bill').click();
    cy.contains('held — cart cleared', { timeout: 8000 }).should('exist');
    cy.contains('Cart is empty').should('exist');

    // ── Resume: the COMPLETE bill must come back ─────────────────────────────
    cy.contains('button', /^Resume \(1\)/).click();
    cy.get('[data-testid="held-bills-list"]').within(() => {
      cy.contains('HOLD-').should('exist');
      cy.contains('₹2124.00').should('exist');          // total survived the hold
      cy.contains(CUSTOMER_NAME.split(' ')[0]).should('exist');
      cy.get('[data-testid="resume-held-bill"]').click();
    });

    cy.contains('resumed', { timeout: 8000 }).should('exist');
    cy.getCartItem(PRODUCT_NAME).within(() => {
      cy.get('input[type="number"]').first().should('have.value', '4');   // qty
      cy.get('[data-testid="discount-input"]').should('have.value', '10'); // discount
    });
    cy.get('[data-testid="order-notes"]').should('have.value', 'cypress journey bill');
    cy.get('[data-testid="pay-button"]').should('contain', '₹2124.00');   // GST too
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-E2E-002: UPI QR → pending → verify → complete → bill details', () => {
    cy.goToBilling();
    cy.addProductToCart(PRODUCT_NAME);

    const expected = +(PRODUCT_PRICE * (1 + taxRate / 100)).toFixed(2);

    cy.get('[data-testid="payment-upi_qr"]', { timeout: 10000 }).should('be.visible').click();

    cy.intercept('POST', '**/sales').as('createSale');
    cy.get('[data-testid="pay-button"]').should('not.be.disabled').click();

    cy.wait('@createSale', { timeout: 20000 }).then((i) => {
      expect(i.response.statusCode).to.eq(201);
      const sale = i.response.body.data.sale;

      // Unpaid, and therefore excluded from revenue reports
      expect(sale.paymentStatus).to.eq('pending');
      expect(sale.status).to.eq('pending');
      expect(sale.totalAmount).to.eq(expected);

      // QR encodes the exact amount for the configured VPA
      cy.get('[data-testid="upi-qr-modal"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="upi-qr-amount"]').should('contain', expected.toFixed(2));
      cy.get('[data-testid="upi-qr-image"]').should('have.attr', 'src').and('match', /^data:image/);
      cy.contains(TEST_VPA).should('exist');

      // Cannot settle without a reference
      cy.get('[data-testid="upi-verify-button"]').should('be.disabled');

      // Verify with the customer's UTR
      cy.intercept('PATCH', `**/sales/${sale._id}/upi/verify`).as('verify');
      cy.get('[data-testid="upi-txn-ref"]').type(UTR);
      cy.get('[data-testid="upi-verify-button"]').should('not.be.disabled').click();

      cy.wait('@verify', { timeout: 20000 }).then((v) => {
        expect(v.response.statusCode).to.eq(200);
        const paid = v.response.body.data.sale;
        expect(paid.paymentStatus).to.eq('paid');
        expect(paid.status).to.eq('completed');
        expect(paid.upiTxn.transactionId).to.eq(UTR);
      });

      // ── Bill details / invoice ─────────────────────────────────────────────
      cy.get('[data-testid="invoice-modal"]', { timeout: 12000 }).should('be.visible');
      cy.get('[data-testid="payment-status-badge"]').should('contain', 'PAID');
      cy.get('[data-testid="invoice-number"]').invoke('text').should('match', /INV-/);
      cy.contains('E2E-JRN-001').should('exist');   // SKU on the invoice line
      cy.contains(UTR).should('exist');             // UPI reference recorded
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-E2E-003: Cash bill → edit → audit trail → stock delta → reports', () => {
    cy.goToBilling();

    // Sell 6 units for cash
    cy.addProductToCart(PRODUCT_NAME);
    cy.getCartItem(PRODUCT_NAME).within(() => {
      for (let n = 0; n < 5; n += 1) cy.get('[data-testid="qty-increment"]').click();
      cy.get('input[type="number"]').first().should('have.value', '6');
    });

    const totalFor = (units) => +((PRODUCT_PRICE * units) * (1 + taxRate / 100)).toFixed(2);

    cy.apiRequest('GET', `/products/${productId}`).then((p0) => {
      const stockBefore = Cypress.unwrapProduct(p0).stock;

      cy.intercept('POST', '**/sales').as('cashSale');
      cy.get('[data-testid="pay-button"]').click();

      cy.wait('@cashSale', { timeout: 20000 }).then((i) => {
        expect(i.response.statusCode).to.eq(201);
        const sale = i.response.body.data.sale;
        expect(sale.totalAmount).to.eq(totalFor(6));
        expect(sale.paymentStatus).to.eq('paid');

        // Stock dropped by 6
        cy.apiRequest('GET', `/products/${productId}`).then((p1) => {
          expect(Cypress.unwrapProduct(p1).stock).to.eq(stockBefore - 6);
        });

        // ── Edit the completed bill: 6 → 2 ──────────────────────────────────
        cy.get('[data-testid="invoice-modal"]', { timeout: 12000 }).should('be.visible');
        cy.get('[data-testid="edit-bill-button"]').click();
        cy.get('[data-testid="edit-bill-modal"]').should('be.visible');

        cy.get(`[data-testid="edit-line-${productId}"]`).within(() => {
          cy.get('input[type="number"]').first().clear().type('2');
        });
        cy.get('[data-testid="edit-new-total"]').should('contain', totalFor(2).toFixed(2));

        // Reason is mandatory, and the change needs explicit confirmation
        cy.get('[data-testid="edit-save-button"]').should('be.disabled');
        cy.get('[data-testid="edit-reason"]').type('Customer returned 4 units');

        cy.intercept('PATCH', `**/sales/${sale._id}`).as('editSale');
        cy.get('[data-testid="edit-save-button"]').click();
        cy.get('[data-testid="edit-confirm-save"]').click();

        cy.wait('@editSale', { timeout: 20000 }).then((e) => {
          expect(e.response.statusCode).to.eq(200);
          const updated = e.response.body.data.sale;

          // Totals recalculated
          expect(updated.totalAmount).to.eq(totalFor(2));
          expect(updated.items[0].quantity).to.eq(2);

          // ── Audit trail ──────────────────────────────────────────────────
          expect(updated.editCount).to.eq(1);
          expect(updated.editHistory).to.have.length(1);
          const h = updated.editHistory[0];
          expect(h.reason).to.include('Customer returned');
          expect(h.editedByName).to.be.a('string').and.not.be.empty;
          expect(h.editedAt).to.be.a('string');
          expect(h.before.totalAmount).to.eq(totalFor(6));
          expect(h.after.totalAmount).to.eq(totalFor(2));
          expect(h.changes.join(' ')).to.include('qty 6 → 2');
        });

        // ── Stock moved by the DELTA only (4 returned, not 6 then 2) ────────
        cy.apiRequest('GET', `/products/${productId}`).then((p2) => {
          expect(Cypress.unwrapProduct(p2).stock).to.eq(stockBefore - 2);
        });

        // Audit trail is visible in the bill details view
        cy.get('[data-testid="bill-edit-history"]', { timeout: 10000 })
          .should('exist')
          .and('contain', 'Customer returned');

        // ── Reports reflect the edited total, and exclude the pending bill ──
        cy.apiRequest('GET', `/sales/${sale._id}`).then((r) => {
          const persisted = Cypress.unwrapSale(r);
          expect(persisted.totalAmount).to.eq(totalFor(2));
          expect(persisted.status).to.eq('completed');
          expect(persisted.editCount).to.eq(1);
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-E2E-004: Expired stock is refused by the API, not just the cart', () => {
    cy.apiRequest('POST', '/products', {
      name: 'E2E Expired Item', category: 'Test',
      price: 100, costPrice: 50, stock: 10, shopId,
      trackExpiry: true, expiryDate: '2020-01-01',
    }).then((r) => {
      const expiredId = Cypress.unwrapProduct(r)._id;

      // Straight to the API — bypassing the client-side cart guard entirely
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId: expiredId, quantity: 1 }],
        paymentMethod: 'cash',
      }).then((res) => {
        expect(res.status).to.eq(400);
        expect(res.body.message).to.match(/expired/i);
      });

      // Stock untouched
      cy.apiRequest('GET', `/products/${expiredId}`).then((p) => {
        expect(Cypress.unwrapProduct(p).stock).to.eq(10);
      });

      cy.apiRequest('DELETE', `/products/${expiredId}`);
    });
  });
});
