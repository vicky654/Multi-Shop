/**
 * TEST SUITE: Credit Sale → Ledger → Repayment Flow
 * ─────────────────────────────────────────────────────────────────────────────
 * Full credit cycle:
 *   1. Create customer
 *   2. Create credit sale linked to customer
 *   3. Verify credit ledger entry (type=credit, correct amount, correct balance)
 *   4. Record repayment
 *   5. Verify balance decremented
 *   6. Verify customer.creditBalance reflects final balance
 *
 * This is a critical financial flow — errors here directly impact accounts.
 */

describe('Credit Flow — Sale → Ledger → Repayment', () => {
  let shopId;
  let productId;
  let customerId;
  let saleId;

  const CUSTOMER_NAME    = 'Cypress Credit Customer';
  const CUSTOMER_PHONE   = '9988776655';
  const PRODUCT_NAME     = 'Credit Flow Widget';
  const PRODUCT_PRICE    = 1000;
  const DUE_AMOUNT       = 1000;  // full credit
  const REPAY_AMOUNT     = 400;

  // ── Setup ──────────────────────────────────────────────────────────────────
  before(() => {
    cy.login();

    // Get shop
    cy.apiRequest('GET', '/shops').then((res) => {
      shopId = Cypress.unwrapShops(res)[0]._id;

      // Create test customer
      cy.apiRequest('POST', '/customers', {
        name:   CUSTOMER_NAME,
        phone:  CUSTOMER_PHONE,
        shopId,
      }).then((custRes) => {
        expect(custRes.status).to.be.oneOf([200, 201]);
        customerId = custRes.body.data?.customer?._id || custRes.body.data?._id;
        expect(customerId).to.be.a('string');
      });

      // Create test product
      cy.apiRequest('POST', '/products', {
        name:      PRODUCT_NAME,
        category:  'Electronics',
        price:     PRODUCT_PRICE,
        costPrice: 600,
        stock:     5,
        shopId,
      }).then((prodRes) => {
        productId = prodRes.body.data?._id || prodRes.body.data?.product?._id;
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
    // Note: no hard delete of customer (soft-delete would remove purchase history)
    if (productId) cy.apiRequest('DELETE', `/products/${productId}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CREDIT-001: Create credit sale via UI', () => {
    cy.goToBilling();

    // Search and add the product
    cy.addProductToCart(PRODUCT_NAME);

    // A credit sale REQUIRES a customer — usePayment.validatePayment blocks
    // checkout without one, so no POST /sales would ever fire.
    cy.get('#customer-search-input').clear().type(CUSTOMER_NAME);
    cy.contains(CUSTOMER_NAME, { timeout: 10000 }).click();

    // Select Credit payment
    cy.get('[data-testid="payment-credit"]').click();

    // CreditFlow component should appear
    cy.get('[data-testid="credit-due-input"]').should('be.visible');

    // Enter full amount as credit (₹1000 due)
    cy.get('[data-testid="credit-due-input"]')
      .clear()
      .type(String(DUE_AMOUNT));

    // Intercept the sale creation
    cy.intercept('POST', '**/sales').as('createSale');

    cy.get('[data-testid="pay-button"]')
      .should('not.be.disabled')
      .click();

    cy.wait('@createSale', { timeout: 15000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(201);
      const sale = interception.response.body.data.sale;

      saleId = sale._id;

      // Verify sale fields
      expect(sale.paymentMethod).to.eq('credit');
      expect(sale.dueAmount).to.eq(DUE_AMOUNT);
      expect(sale.status).to.eq('completed');
    });

    // Invoice should appear
    cy.get('[data-testid="invoice-modal"]').should('be.visible');
    cy.get('[data-testid="invoice-modal"]').within(() => {
      cy.get('button').last().click();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CREDIT-002: Credit ledger entry created with correct balance', () => {
    // Verify via API that a credit ledger entry was created
    cy.apiRequest('GET', `/credit-ledger/${customerId}?shopId=${shopId}`)
      .then((res) => {
        expect(res.status).to.eq(200);
        const entries = res.body.data;

        // Should have at least one entry
        expect(entries).to.have.length.greaterThan(0);

        // Find the credit entry we just created
        const creditEntry = entries.find((e) => e.type === 'credit');
        expect(creditEntry).to.exist;
        expect(creditEntry.amount).to.eq(DUE_AMOUNT);
        expect(creditEntry.balance).to.be.greaterThan(0);
      });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CREDIT-003: Customer creditBalance updated after credit sale', () => {
    cy.apiRequest('GET', `/customers/${customerId}`).then((res) => {
      expect(res.status).to.eq(200);
      const customer = Cypress.unwrapCustomer(res);
      // creditBalance should reflect the outstanding amount
      expect(customer.creditBalance).to.be.gte(DUE_AMOUNT);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CREDIT-004: Record repayment of ₹400', () => {
    // Get current balance before repayment
    cy.apiRequest('GET', `/credit-ledger/${customerId}?shopId=${shopId}`)
      .then((res) => {
        const entries       = res.body.data;
        const lastEntry     = entries[0]; // newest first
        const balanceBefore = lastEntry.balance;

        // Record repayment
        cy.apiRequest('POST', `/credit-ledger/${customerId}/repay`, {
          shopId,
          amount: REPAY_AMOUNT,
          notes:  'Cypress test repayment',
        }).then((repayRes) => {
          expect(repayRes.status).to.eq(200);

          const { entry, previousBalance, newBalance } = repayRes.body.data;

          // Verify repayment entry
          expect(entry.type).to.eq('repay');
          expect(entry.amount).to.eq(REPAY_AMOUNT);

          // Balance should have decreased by REPAY_AMOUNT
          expect(newBalance).to.eq(+(balanceBefore - REPAY_AMOUNT).toFixed(2));
          expect(previousBalance).to.eq(balanceBefore);
        });
      });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CREDIT-005: Customer creditBalance updated after repayment', () => {
    cy.apiRequest('GET', `/customers/${customerId}`).then((res) => {
      const customer = Cypress.unwrapCustomer(res);
      // After repaying ₹400 of ₹1000 → balance should be ₹600
      expect(customer.creditBalance).to.be.closeTo(DUE_AMOUNT - REPAY_AMOUNT, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CREDIT-006: Overpayment floors balance at zero, not negative', () => {
    // Try to repay more than outstanding
    cy.apiRequest('POST', `/credit-ledger/${customerId}/repay`, {
      shopId,
      amount: 999999, // way more than any balance
      notes:  'Overpayment test',
    }).then((res) => {
      expect(res.status).to.eq(200);
      const { newBalance } = res.body.data;
      // Must never go negative
      expect(newBalance).to.eq(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-CREDIT-007: Zero-balance customer not in credit summary', () => {
    // After overpayment, creditBalance = 0 → should not appear in summary
    cy.apiRequest('GET', `/credit-ledger/summary?shopId=${shopId}`).then((res) => {
      expect(res.status).to.eq(200);
      const customers = res.body.data.customers;

      const found = customers.find((c) => c._id === customerId);
      expect(found).to.be.undefined;
    });
  });
});
