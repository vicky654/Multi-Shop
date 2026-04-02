/**
 * TEST SUITE: Credit Over-Limit Scenario
 * ─────────────────────────────────────────────────────────────────────────────
 * Business rule: if a customer has a creditLimit set, they should not be
 * allowed to accumulate more credit than that limit.
 *
 * Also tests:
 *   - creditBalance tracks correctly across multiple sales
 *   - Repayment brings balance back under limit, enabling new credit
 *   - Customer with no creditLimit set (unlimited) can always buy on credit
 *
 * Financial accuracy is non-negotiable — silent over-limit = bad debt risk.
 */

describe('Credit Over-Limit Scenario', () => {
  let shopId;
  let productId;
  let customerId;
  let unlimitedCustomerId;

  const CREDIT_LIMIT    = 1000;
  const PRODUCT_PRICE   = 600;   // two purchases = ₹1200 > limit

  before(() => {
    cy.login();

    cy.getShopId().then((sid) => {
      shopId = sid;

      // Create a test product
      cy.apiRequest('POST', '/products', {
        name: 'Credit Limit Test Item', category: 'Test',
        price: PRODUCT_PRICE, costPrice: 350, stock: 50, shopId,
      }).then((r) => {
        productId = r.body.data?._id || r.body.data?.product?._id;
      });

      // Customer WITH a credit limit
      cy.apiRequest('POST', '/customers', {
        name:        'Limited Credit Customer',
        phone:       '9111222333',
        shopId,
        creditLimit: CREDIT_LIMIT,
      }).then((r) => {
        expect(r.status).to.be.oneOf([200, 201]);
        customerId = r.body.data?.customer?._id || r.body.data?._id;
      });

      // Customer WITHOUT a credit limit (unlimited)
      cy.apiRequest('POST', '/customers', {
        name:  'Unlimited Credit Customer',
        phone: '9444555666',
        shopId,
      }).then((r) => {
        unlimitedCustomerId = r.body.data?.customer?._id || r.body.data?._id;
      });
    });
  });

  after(() => {
    if (productId) cy.apiRequest('DELETE', `/products/${productId}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CLIMIT-001: First credit sale within limit succeeds', () => {
    // ₹600 < ₹1000 limit ✓
    cy.apiRequest('POST', '/sales', {
      shopId,
      customerId,
      items:         [{ productId, quantity: 1 }],
      paymentMethod: 'credit',
      dueAmount:     PRODUCT_PRICE,
    }).then((res) => {
      expect(res.status).to.eq(201);

      // Customer balance should now be ₹600
      cy.apiRequest('GET', `/customers/${customerId}`).then((custRes) => {
        expect(custRes.body.data.creditBalance).to.be.closeTo(PRODUCT_PRICE, 1);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CLIMIT-002: Second credit sale that pushes balance over limit is rejected', () => {
    // Current balance = ₹600. Buying another ₹600 → ₹1200 > ₹1000 limit
    cy.apiRequest('POST', '/sales', {
      shopId,
      customerId,
      items:         [{ productId, quantity: 1 }],
      paymentMethod: 'credit',
      dueAmount:     PRODUCT_PRICE,
    }).then((res) => {
      // Must be rejected — either 400 (validation) or 402 (payment required)
      expect(res.status).to.be.oneOf([400, 402, 422]);
      const msg = (res.body.message || res.body.error || '').toLowerCase();
      expect(msg).to.match(/credit|limit|exceeded|balance/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CLIMIT-003: Balance unchanged after rejected over-limit sale', () => {
    // Balance should still be ₹600 — not ₹1200
    cy.apiRequest('GET', `/customers/${customerId}`).then((res) => {
      expect(res.body.data.creditBalance).to.be.closeTo(PRODUCT_PRICE, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CLIMIT-004: Partial repayment creates headroom for new credit', () => {
    // Repay ₹400 → balance = ₹200 → can buy ₹600 again? No (200+600=800 < 1000 ✓)
    cy.apiRequest('POST', `/credit-ledger/${customerId}/repay`, {
      shopId,
      amount: 400,
      notes:  'Partial repayment',
    }).then((repayRes) => {
      expect(repayRes.status).to.eq(200);
      expect(repayRes.body.data.newBalance).to.be.closeTo(200, 1);

      // Now a ₹600 credit sale should succeed (200 + 600 = 800 < 1000)
      cy.apiRequest('POST', '/sales', {
        shopId,
        customerId,
        items:         [{ productId, quantity: 1 }],
        paymentMethod: 'credit',
        dueAmount:     PRODUCT_PRICE,
      }).then((saleRes) => {
        expect(saleRes.status).to.eq(201);

        cy.apiRequest('GET', `/customers/${customerId}`).then((custRes) => {
          expect(custRes.body.data.creditBalance).to.be.closeTo(800, 2);
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CLIMIT-005: Customer without credit limit can exceed ₹1000', () => {
    // Unlimited customer — no creditLimit field — can always buy on credit
    const bigAmount = 5000;

    cy.apiRequest('POST', '/products', {
      name: 'Expensive Unlimited Test Item', category: 'Test',
      price: bigAmount, costPrice: 3000, stock: 10, shopId,
    }).then((prodRes) => {
      const bigProductId = prodRes.body.data?._id || prodRes.body.data?.product?._id;

      cy.apiRequest('POST', '/sales', {
        shopId,
        customerId:    unlimitedCustomerId,
        items:         [{ productId: bigProductId, quantity: 1 }],
        paymentMethod: 'credit',
        dueAmount:     bigAmount,
      }).then((res) => {
        expect(res.status).to.eq(201);

        // Cleanup
        cy.apiRequest('DELETE', `/products/${bigProductId}`);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CLIMIT-006: Credit ledger summary excludes zero-balance customers', () => {
    // Fully repay the limited customer
    cy.apiRequest('GET', `/customers/${customerId}`).then((custRes) => {
      const outstanding = custRes.body.data.creditBalance;

      cy.apiRequest('POST', `/credit-ledger/${customerId}/repay`, {
        shopId,
        amount: outstanding + 1, // slightly over → floors at 0
        notes:  'Full repayment',
      }).then(() => {
        cy.apiRequest('GET', `/credit-ledger/summary?shopId=${shopId}`).then((res) => {
          expect(res.status).to.eq(200);
          const found = res.body.data.customers?.find((c) => c._id === customerId);
          expect(found).to.be.undefined;
        });
      });
    });
  });
});
