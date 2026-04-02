/**
 * TEST SUITE: Partial Refund Flow
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the partial refund system end-to-end:
 *   1. Create a sale with 2 items via API (reliable starting point)
 *   2. Partially refund one item (qty 2 of 5)
 *   3. Verify refundedQty updated on the item
 *   4. Verify stock restored for refunded qty only
 *   5. Verify sale status stays 'completed' (not fully refunded)
 *   6. Refund remaining items → status auto-sets to 'refunded'
 *   7. Edge cases: refund > qty, refund already-refunded sale
 *
 * Financial accuracy is critical here — wrong refund amounts = real money.
 */

describe('Partial Refund Flow', () => {
  let shopId;
  let productAId;
  let productBId;
  let saleId;

  const PRODUCT_A       = { name: 'Refund Test Notebook', price: 50,  costPrice: 30, stock: 20 };
  const PRODUCT_B       = { name: 'Refund Test Pen',      price: 20,  costPrice: 10, stock: 30 };
  const SALE_QTY_A      = 5;
  const SALE_QTY_B      = 3;
  const PARTIAL_REFUND_A = 2; // refund 2 of 5 notebooks

  // ── Setup: seed products + create a sale ──────────────────────────────────
  before(() => {
    cy.login();

    cy.apiRequest('GET', '/shops').then((res) => {
      shopId = res.body.data[0]._id;

      // Create product A
      cy.apiRequest('POST', '/products', { ...PRODUCT_A, shopId })
        .then((r) => {
          productAId = r.body.data?._id || r.body.data?.product?._id;
        });

      // Create product B
      cy.apiRequest('POST', '/products', { ...PRODUCT_B, shopId })
        .then((r) => {
          productBId = r.body.data?._id || r.body.data?.product?._id;
        });
    });
  });

  // ── Create the sale before each relevant test (use .then chaining) ────────
  beforeEach(() => {
    // Reset by creating a fresh sale
    cy.apiRequest('GET', '/shops').then((res) => {
      const sid = res.body.data[0]._id;

      cy.apiRequest('POST', '/sales', {
        shopId: sid,
        items: [
          { productId: productAId, quantity: SALE_QTY_A },
          { productId: productBId, quantity: SALE_QTY_B },
        ],
        paymentMethod: 'cash',
      }).then((saleRes) => {
        expect(saleRes.status).to.eq(201);
        saleId = saleRes.body.data.sale._id;
      });
    });
  });

  after(() => {
    if (productAId) cy.apiRequest('DELETE', `/products/${productAId}`);
    if (productBId) cy.apiRequest('DELETE', `/products/${productBId}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-REFUND-001: Partial refund updates refundedQty and restores stock', () => {
    // Record stock before refund
    let stockBeforeA;

    cy.apiRequest('GET', `/products/${productAId}`).then((res) => {
      // After the sale, stock = PRODUCT_A.stock - SALE_QTY_A
      stockBeforeA = res.body.data.stock;
      expect(stockBeforeA).to.eq(PRODUCT_A.stock - SALE_QTY_A);

      // Execute partial refund: 2 of 5 notebooks
      cy.apiRequest('PATCH', `/sales/${saleId}/partial-refund`, {
        refundItems: [{ productId: productAId, quantity: PARTIAL_REFUND_A }],
      }).then((refundRes) => {
        expect(refundRes.status).to.eq(200);

        const { sale, refundAmount, fullyRefunded } = refundRes.body.data;

        // Sale status should still be 'completed' (not fully refunded)
        expect(sale.status).to.eq('completed');
        expect(fullyRefunded).to.eq(false);

        // refundedQty on product A's item should be PARTIAL_REFUND_A
        const itemA = sale.items.find((i) => i.product.toString() === productAId);
        expect(itemA.refundedQty).to.eq(PARTIAL_REFUND_A);

        // refundAmount should equal (price per unit) × refunded qty
        // Notebook price = 50, refunded 2 → ₹100
        expect(refundAmount).to.be.closeTo(PRODUCT_A.price * PARTIAL_REFUND_A, 1);

        // Verify stock restored
        cy.apiRequest('GET', `/products/${productAId}`).then((prodRes) => {
          const stockAfter = prodRes.body.data.stock;
          expect(stockAfter).to.eq(stockBeforeA + PARTIAL_REFUND_A);
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-REFUND-002: Refunding remaining items sets status to refunded', () => {
    // First partial: refund 2 of 5 A
    cy.apiRequest('PATCH', `/sales/${saleId}/partial-refund`, {
      refundItems: [{ productId: productAId, quantity: PARTIAL_REFUND_A }],
    });

    // Second partial: refund remaining 3 A + all 3 B
    cy.apiRequest('PATCH', `/sales/${saleId}/partial-refund`, {
      refundItems: [
        { productId: productAId, quantity: SALE_QTY_A - PARTIAL_REFUND_A }, // remaining 3
        { productId: productBId, quantity: SALE_QTY_B },                    // all 3
      ],
    }).then((res) => {
      expect(res.status).to.eq(200);
      // All items fully refunded → status must auto-update to 'refunded'
      expect(res.body.data.fullyRefunded).to.eq(true);
      expect(res.body.data.sale.status).to.eq('refunded');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-REFUND-003: Cannot refund more than sold quantity', () => {
    cy.apiRequest('PATCH', `/sales/${saleId}/partial-refund`, {
      refundItems: [{ productId: productAId, quantity: SALE_QTY_A + 99 }], // 99 > 5
    }).then((res) => {
      expect(res.status).to.eq(400);
      expect(res.body.message || res.body.error)
        .to.match(/cannot refund/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-REFUND-004: Cannot re-refund an already fully refunded sale', () => {
    // Fully refund the sale first
    cy.apiRequest('PATCH', `/sales/${saleId}/refund`);

    // Attempt to refund again
    cy.apiRequest('PATCH', `/sales/${saleId}/refund`).then((res) => {
      expect(res.status).to.eq(400);
      expect(res.body.message || res.body.error)
        .to.match(/already refunded/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-REFUND-005: Stock fully restored after full refund', () => {
    // Get stock before
    cy.apiRequest('GET', `/products/${productAId}`).then((beforeRes) => {
      const stockBefore = beforeRes.body.data.stock;

      // Full refund
      cy.apiRequest('PATCH', `/sales/${saleId}/refund`).then((refundRes) => {
        expect(refundRes.status).to.eq(200);

        // Verify stock is back to pre-sale level
        cy.apiRequest('GET', `/products/${productAId}`).then((afterRes) => {
          expect(afterRes.body.data.stock).to.eq(stockBefore + SALE_QTY_A);
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-REFUND-006: Empty refundItems array returns 400', () => {
    cy.apiRequest('PATCH', `/sales/${saleId}/partial-refund`, {
      refundItems: [],
    }).then((res) => {
      expect(res.status).to.be.oneOf([400, 422]);
    });
  });
});
