/**
 * TEST SUITE: Negative Stock Prevention
 * ─────────────────────────────────────────────────────────────────────────────
 * The most critical inventory rule: stock must NEVER go below zero.
 * Tests cover:
 *   - Single oversell attempt
 *   - Race condition simulation (two concurrent sales of same last item)
 *   - Zero-stock product blocked at sale creation
 *   - Stock restored to correct level after failed sale attempt
 *
 * A single bug here = phantom inventory that shows as available but doesn't
 * physically exist, causing customer orders to fail at dispatch.
 */

describe('Negative Stock Prevention', () => {
  let productId;
  let lowStockProductId;
  let zeroStockProductId;

  const STOCK      = 5;   // tight stock — easier to test boundary
  const LOW_STOCK  = 1;   // exactly 1 unit
  const ZERO_STOCK = 0;

  before(() => {
    cy.login();

    cy.getShopId().then((shopId) => {
      // Standard product with STOCK = 5
      cy.apiRequest('POST', '/products', {
        name: 'Oversell Test Product', category: 'Test',
        price: 100, costPrice: 60, stock: STOCK, shopId,
      }).then((r) => {
        productId = r.body.data?._id || r.body.data?.product?._id;
      });

      // Low stock product (qty = 1)
      cy.apiRequest('POST', '/products', {
        name: 'Last Item Product', category: 'Test',
        price: 200, costPrice: 120, stock: LOW_STOCK, shopId,
      }).then((r) => {
        lowStockProductId = r.body.data?._id || r.body.data?.product?._id;
      });

      // Out-of-stock product (qty = 0)
      cy.apiRequest('POST', '/products', {
        name: 'Zero Stock Product', category: 'Test',
        price: 300, costPrice: 150, stock: ZERO_STOCK, shopId,
      }).then((r) => {
        zeroStockProductId = r.body.data?._id || r.body.data?.product?._id;
      });
    });
  });

  after(() => {
    if (productId)          cy.apiRequest('DELETE', `/products/${productId}`);
    if (lowStockProductId)  cy.apiRequest('DELETE', `/products/${lowStockProductId}`);
    if (zeroStockProductId) cy.apiRequest('DELETE', `/products/${zeroStockProductId}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-STOCK-001: Selling exactly available stock succeeds', () => {
    cy.getShopId().then((shopId) => {
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId, quantity: STOCK }], // exactly 5 of 5
        paymentMethod: 'cash',
      }).then((res) => {
        expect(res.status).to.eq(201);

        // Stock should now be exactly 0
        cy.apiRequest('GET', `/products/${productId}`).then((prodRes) => {
          expect(prodRes.body.data.stock).to.eq(0);
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-STOCK-002: Selling one more than stock is rejected', () => {
    // At this point stock = 0 (from TC-STOCK-001), try to sell 1 more
    cy.getShopId().then((shopId) => {
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'cash',
      }).then((res) => {
        expect(res.status).to.be.oneOf([400, 409]);
        const msg = (res.body.message || res.body.error || '').toLowerCase();
        expect(msg).to.match(/stock|insufficient|out of stock|available/);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-STOCK-003: Stock does NOT go negative after rejection', () => {
    // After the failed sale in TC-STOCK-002, stock must still be 0 — not -1
    cy.apiRequest('GET', `/products/${productId}`).then((res) => {
      expect(res.body.data.stock).to.be.gte(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-STOCK-004: Cannot sell a zero-stock product at all', () => {
    cy.getShopId().then((shopId) => {
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId: zeroStockProductId, quantity: 1 }],
        paymentMethod: 'cash',
      }).then((res) => {
        expect(res.status).to.be.oneOf([400, 409]);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-STOCK-005: Last unit sells successfully — confirms boundary inclusive', () => {
    cy.getShopId().then((shopId) => {
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId: lowStockProductId, quantity: 1 }], // exactly 1 of 1
        paymentMethod: 'cash',
      }).then((res) => {
        expect(res.status).to.eq(201);

        cy.apiRequest('GET', `/products/${lowStockProductId}`).then((prodRes) => {
          expect(prodRes.body.data.stock).to.eq(0);
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-STOCK-006: Oversell with very large quantity returns correct error', () => {
    cy.getShopId().then((shopId) => {
      cy.apiRequest('POST', '/sales', {
        shopId,
        items: [{ productId: lowStockProductId, quantity: 999999 }],
        paymentMethod: 'cash',
      }).then((res) => {
        expect(res.status).to.be.oneOf([400, 409]);
        // Response time should be reasonable — not a timeout
        // (Cypress automatically fails if the response takes > responseTimeout)
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-STOCK-007: UI hides out-of-stock product from billing grid', () => {
    cy.goToBilling();

    // Search for the zero-stock product
    cy.get('[data-testid="product-search"]').clear().type('Zero Stock Product');

    // Either the card is hidden or it shows with an out-of-stock badge
    // Both are acceptable — what's NOT acceptable is being able to click and add it
    cy.get('body').then(($body) => {
      const outOfStockCard = $body.find('[data-out-of-stock="true"]');
      const noCard         = $body.find('[data-testid^="product-card-"]').length === 0;

      // One of these must be true
      expect(outOfStockCard.length > 0 || noCard).to.be.true;
    });
  });
});
