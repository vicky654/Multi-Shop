/**
 * TEST SUITE: Variant Stock Flow
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests per-variant stock tracking end-to-end:
 *   1. Create a product with trackVariantStock=true and 3 variants (S/M/L)
 *   2. Sell 2 units of size M via API
 *   3. Verify ONLY the M variant's stock is decremented
 *   4. Verify S and L stock are untouched
 *   5. Verify the _trackVariant internal flag is NOT persisted in the sale doc
 *   6. Oversell prevention: selling more than a variant's stock → 409
 *   7. Non-existent variant: selling size XL → 400
 *   8. Root-level stock is still decremented (mirrors total units sold)
 *
 * Correctness here is critical — wrong variant deduction = inventory chaos.
 */

describe('Variant Stock Flow', () => {
  let shopId;
  let productId;

  const PRODUCT_NAME = 'Variant Stock Test T-Shirt';
  const VARIANTS = [
    { size: 'S', color: 'Red',  stock: 10 },
    { size: 'M', color: 'Blue', stock: 5  },
    { size: 'L', color: 'Red',  stock: 3  },
  ];
  const SELL_SIZE  = 'M';
  const SELL_COLOR = 'Blue';
  const SELL_QTY   = 2;

  // ── Setup: create the variant product once ────────────────────────────────
  before(() => {
    cy.login();

    cy.apiRequest('GET', '/shops').then((res) => {
      shopId = Cypress.unwrapShops(res)[0]._id;

      cy.apiRequest('POST', '/products', {
        name:               PRODUCT_NAME,
        category:           'Clothing',
        price:              499,
        costPrice:          250,
        stock:              VARIANTS.reduce((sum, v) => sum + v.stock, 0), // 18 total
        shopId,
        trackVariantStock:  true,
        variantStock:       VARIANTS,
      }).then((res) => {
        expect(res.status).to.be.oneOf([200, 201]);
        productId = res.body.data?._id || res.body.data?.product?._id;
        expect(productId).to.be.a('string');
      });
    });
  });

  // cy.apiRequest reads the JWT from the restored Cypress session, and Cypress
  // clears localStorage between tests — so every test needs cy.login() or the
  // requests go out unauthenticated and 401.
  beforeEach(() => {
    cy.login();
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────
  after(() => {
    if (productId) cy.apiRequest('DELETE', `/products/${productId}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-VAR-001: Selling a variant only decrements that variant\'s stock', () => {
    cy.apiRequest('GET', '/shops').then((shopRes) => {
      const sid = Cypress.unwrapShops(shopRes)[0]._id;

      cy.apiRequest('POST', '/sales', {
        shopId: sid,
        items: [{
          productId,
          quantity:    SELL_QTY,
          selectedSize:  SELL_SIZE,
          selectedColor: SELL_COLOR,
        }],
        paymentMethod: 'cash',
      }).then((saleRes) => {
        expect(saleRes.status).to.eq(201);

        // Now check the product's variantStock
        cy.apiRequest('GET', `/products/${productId}`).then((prodRes) => {
          expect(prodRes.status).to.eq(200);
          const { variantStock } = Cypress.unwrapProduct(prodRes);

          // Size M (Blue) should be decremented
          const varM = variantStock.find(
            (v) => v.size === SELL_SIZE && v.color === SELL_COLOR
          );
          expect(varM).to.exist;
          expect(varM.stock).to.eq(
            VARIANTS.find((v) => v.size === SELL_SIZE).stock - SELL_QTY
          ); // 5 - 2 = 3

          // Size S should be untouched
          const varS = variantStock.find((v) => v.size === 'S');
          expect(varS.stock).to.eq(VARIANTS.find((v) => v.size === 'S').stock); // 10

          // Size L should be untouched
          const varL = variantStock.find((v) => v.size === 'L');
          expect(varL.stock).to.eq(VARIANTS.find((v) => v.size === 'L').stock); // 3
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-VAR-002: _trackVariant flag is NOT persisted in sale document', () => {
    cy.apiRequest('GET', '/shops').then((shopRes) => {
      const sid = Cypress.unwrapShops(shopRes)[0]._id;

      cy.apiRequest('POST', '/sales', {
        shopId: sid,
        items: [{
          productId,
          quantity:     1,
          selectedSize:  SELL_SIZE,
          selectedColor: SELL_COLOR,
        }],
        paymentMethod: 'cash',
      }).then((saleRes) => {
        expect(saleRes.status).to.eq(201);
        const sale = saleRes.body.data.sale;

        // _trackVariant must never appear in any sale item
        sale.items.forEach((item) => {
          expect(item).not.to.have.property('_trackVariant');
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-VAR-003: Cannot oversell a variant beyond its stock', () => {
    // Size L has stock = 3 (original). After TC-VAR-001 and TC-VAR-002 it should
    // still be 3 (those tests only touched M). Try to sell 99 of L.
    cy.apiRequest('GET', '/shops').then((shopRes) => {
      const sid = Cypress.unwrapShops(shopRes)[0]._id;

      cy.apiRequest('POST', '/sales', {
        shopId: sid,
        items: [{
          productId,
          quantity:     99,
          selectedSize:  'L',
          selectedColor: 'Red',
        }],
        paymentMethod: 'cash',
      }).then((res) => {
        // 409 Conflict (insufficient stock) or 400 Bad Request
        expect(res.status).to.be.oneOf([400, 409]);
        const msg = res.body.message || res.body.error || '';
        expect(msg.toLowerCase()).to.match(/stock|insufficient|available/);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-VAR-004: Cannot sell a non-existent variant (size XL)', () => {
    cy.apiRequest('GET', '/shops').then((shopRes) => {
      const sid = Cypress.unwrapShops(shopRes)[0]._id;

      cy.apiRequest('POST', '/sales', {
        shopId: sid,
        items: [{
          productId,
          quantity:     1,
          selectedSize:  'XL',   // does not exist
          selectedColor: 'Red',
        }],
        paymentMethod: 'cash',
      }).then((res) => {
        expect(res.status).to.eq(400);
        const msg = res.body.message || res.body.error || '';
        expect(msg.toLowerCase()).to.match(/variant|not found|invalid/);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-VAR-005: Root-level stock is decremented when variant is sold', () => {
    // Get current root stock
    cy.apiRequest('GET', `/products/${productId}`).then((beforeRes) => {
      const rootStockBefore = Cypress.unwrapProduct(beforeRes).stock;

      cy.apiRequest('GET', '/shops').then((shopRes) => {
        const sid = Cypress.unwrapShops(shopRes)[0]._id;

        cy.apiRequest('POST', '/sales', {
          shopId: sid,
          items: [{
            productId,
            quantity:     1,
            selectedSize:  'S',
            selectedColor: 'Red',
          }],
          paymentMethod: 'cash',
        }).then((saleRes) => {
          expect(saleRes.status).to.eq(201);

          cy.apiRequest('GET', `/products/${productId}`).then((afterRes) => {
            // Root stock should also decrease by 1
            expect(Cypress.unwrapProduct(afterRes).stock).to.eq(rootStockBefore - 1);
          });
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-VAR-006: Fractional quantity (0.5) works for variant items', () => {
    cy.apiRequest('GET', '/shops').then((shopRes) => {
      const sid = Cypress.unwrapShops(shopRes)[0]._id;

      // S variant has stock 10 (TC-VAR-005 sold 1 → 9 remaining)
      // Selling 0.5 should be valid (fractional qty support)
      cy.apiRequest('POST', '/sales', {
        shopId: sid,
        items: [{
          productId,
          quantity:     0.5,
          selectedSize:  'S',
          selectedColor: 'Red',
        }],
        paymentMethod: 'cash',
      }).then((res) => {
        // Must succeed — fractional quantities are supported (min: 0.001)
        expect(res.status).to.eq(201);
        const soldItem = res.body.data.sale.items[0];
        expect(soldItem.quantity).to.eq(0.5);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-VAR-007: Variant sale appears correctly in sale.items[]', () => {
    cy.apiRequest('GET', '/shops').then((shopRes) => {
      const sid = Cypress.unwrapShops(shopRes)[0]._id;

      cy.apiRequest('POST', '/sales', {
        shopId: sid,
        items: [{
          productId,
          quantity:     1,
          selectedSize:  SELL_SIZE,
          selectedColor: SELL_COLOR,
        }],
        paymentMethod: 'cash',
      }).then((saleRes) => {
        expect(saleRes.status).to.eq(201);
        const item = saleRes.body.data.sale.items[0];

        // Sale item should record the variant details
        expect(item.selectedSize).to.eq(SELL_SIZE);
        expect(item.selectedColor).to.eq(SELL_COLOR);
        expect(item.quantity).to.eq(1);
        expect(item.refundedQty).to.eq(0); // default
      });
    });
  });
});
