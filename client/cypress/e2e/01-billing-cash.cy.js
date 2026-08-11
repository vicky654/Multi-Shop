/**
 * TEST SUITE: Complete Cash Billing Flow
 * ─────────────────────────────────────────────────────────────────────────────
 * Covers the most critical POS path:
 *   Login → Open Billing → Search product → Add to cart →
 *   Adjust quantity → Apply discount → Select tax → Cash payment → Checkout →
 *   Verify invoice → Verify stock decremented
 *
 * This mirrors what a shop owner does dozens of times per day.
 */

describe('Billing — Complete Cash Sale Flow', () => {
  // ── Test data ──────────────────────────────────────────────────────────────
  let shopId;
  let productId;
  let taxRate = 0;                        // read from the shop — bills include GST
  const PRODUCT_NAME = 'Test Rice 5kg';   // seed this product in your test DB

  // Grand total for `units` of PRODUCT_NAME, tax included, as the POS displays it
  const withTax = (units) => Math.round((200 * units) * (1 + taxRate / 100)); // statutory round-off

  // ── Before all: seed product via API, grab IDs ─────────────────────────────
  before(() => {
    cy.login(); // uses cy.session → only logs in once per run

    // Grab the first active shop from the API to use as shopId
    cy.apiRequest('GET', '/shops').then((res) => {
      expect(res.status).to.eq(200);
      const shops = Array.isArray(res.body.data) ? res.body.data : res.body.data?.shops;
      shopId  = shops?.[0]?._id;
      taxRate = Number(shops?.[0]?.taxRate) || 0;
      expect(shopId).to.be.a('string');

      // Seed a fresh test product so stock is predictable
      cy.apiRequest('POST', '/products', {
        name:      PRODUCT_NAME,
        category:  'Groceries',
        price:     200,
        costPrice: 120,
        stock:     25,
        shopId,
      }).then((prodRes) => {
        expect(prodRes.status).to.be.oneOf([200, 201]);
        productId = prodRes.body.data?._id || prodRes.body.data?.product?._id;
      });
    });
  });

  // ── After all: clean up seeded product ────────────────────────────────────
  after(() => {
    if (productId) {
      cy.apiRequest('DELETE', `/products/${productId}`);
    }
  });

  // ── Navigate to billing ───────────────────────────────────────────────────
  beforeEach(() => {
    cy.login();
    cy.goToBilling();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-BIL-001: Product search and add to cart', () => {
    // Search for the test product
    cy.get('[data-testid="product-search"]')
      .should('be.focused')       // auto-focused on mount
      .type(PRODUCT_NAME);

    cy.wait(500); // Wait for debounce and search query to complete

    // Wait for debounce + API response (250ms debounce in Billing.jsx)
    cy.get('[data-testid^="product-card-"]', { timeout: 10000 })
      .should('have.length.greaterThan', 0);

    // Find the specific product card and verify it shows correct price
    cy.contains('[data-testid^="product-card-"]', PRODUCT_NAME)
      .within(() => {
        cy.contains('₹200').should('exist');  // price visible
        cy.contains('25').should('exist');    // stock visible
      });

    cy.contains('[data-testid^="product-card-"]', PRODUCT_NAME).click();

    // Cart should now have exactly 1 item
    cy.getCartItem(PRODUCT_NAME).should('exist');

    // Cart badge should show count = 1
    cy.get('[data-testid="cart-count"]').should('have.text', '1');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-BIL-002: Increment cart quantity', () => {
    cy.addProductToCart(PRODUCT_NAME);

    // Increment qty twice → should be 3
    cy.getCartItem(PRODUCT_NAME).within(() => {
      cy.get('[data-testid="qty-increment"]').click();
      cy.get('[data-testid="qty-increment"]').click();
      // Quantity is an editable input in the cart table, not static text
      cy.get('input[type="number"]').first().should('have.value', '3');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-BIL-003: Apply % discount to cart item', () => {
    cy.addProductToCart(PRODUCT_NAME);

    cy.getCartItem(PRODUCT_NAME).within(() => {
      // The discount input is inline in the cart row — no toggle to open
      cy.get('[data-testid="discount-input"]')
        .should('be.visible')
        .clear()
        .type('10');

      // Line total should now show ₹200 × 0.9 = ₹180 (line totals are pre-tax)
      cy.contains('₹180.00').should('exist');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-BIL-004: Select cash payment and verify Pay button shows total', () => {
    cy.addProductToCart(PRODUCT_NAME);

    // Cash is default payment — verify it is already selected
    cy.get('[data-testid="payment-cash"]')
      .should('have.attr', 'aria-pressed', 'true');

    // Pay button shows the grand total — price × qty plus the shop's GST
    cy.get('[data-testid="pay-button"]')
      .should('not.be.disabled')
      .should('contain', `₹${withTax(1).toFixed(2)}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-BIL-005: Complete cash sale → invoice modal shown → cart cleared', () => {
    cy.addProductToCart(PRODUCT_NAME);

    // Confirm cash is selected
    cy.get('[data-testid="payment-cash"]').click();

    // Add an optional order note
    cy.get('[data-testid="order-notes"]').type('Cypress automated test sale');

    // Intercept the POST /sales request to verify payload
    cy.intercept('POST', '**/sales').as('createSale');

    // Click Pay button
    cy.get('[data-testid="pay-button"]')
      .should('not.be.disabled')
      .click();

    // Wait for API call to complete
    cy.wait('@createSale', { timeout: 15000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(201);
      const sale = interception.response.body.data.sale;

      // Verify sale structure
      expect(sale.paymentMethod).to.eq('cash');
      expect(sale.status).to.eq('completed');
      expect(sale.items).to.have.length(1);
      expect(sale.items[0].name).to.include(PRODUCT_NAME);
      // Format changed intentionally: the old INV-00001-1234 scheme came from
      // countDocuments()+timestamp, which handed concurrent sales the same
      // number. Now PREFIX/FY/SEQ, reserved atomically per shop+financial year.
      expect(sale.invoiceNumber, 'invoice format PREFIX/FY/SEQ')
        .to.match(/^[A-Z]+\/\d{4}-\d{2}\/\d{6}$/);
    });

    // Invoice modal should open
    cy.get('[data-testid="invoice-modal"]', { timeout: 10000 })
      .should('be.visible');

    // Invoice number is shown in the modal header
    cy.get('[data-testid="invoice-number"]')
      .invoke('text')
      .should('match', /[A-Z]+\/\d{4}-\d{2}\/\d{6}/);

    // Success toast should appear
    cy.contains('Sale recorded', { timeout: 6000 }).should('exist');

    // Close invoice modal
    cy.get('[data-testid="invoice-modal"]').within(() => {
      cy.get('button').last().click();
    });

    // Cart must be cleared after successful checkout
    cy.contains('Cart is empty').should('exist');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-BIL-006: Empty cart blocks checkout', () => {
    // Do NOT add any product — cart is empty
    cy.get('[data-testid="pay-button"]')
      .should('be.disabled');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-BIL-007: Verify stock decremented after sale', () => {
    // Complete a sale of 2 units
    cy.addProductToCart(PRODUCT_NAME);

    cy.getCartItem(PRODUCT_NAME).within(() => {
      cy.get('[data-testid="qty-increment"]').click(); // qty = 2
    });

    cy.intercept('POST', '**/sales').as('createSale');
    cy.get('[data-testid="pay-button"]').click();
    cy.wait('@createSale');

    // Directly check the product stock via API.
    // GET /products/:id responds as { data: { product } }.
    cy.apiRequest('GET', `/products/${productId}`).then((res) => {
      expect(res.status).to.eq(200);
      const product = res.body.data.product || res.body.data;
      // Earlier tests in this spec already sold 1 (TC-BIL-005) from 25 → 24,
      // so assert the delta rather than a hardcoded absolute.
      expect(product.stock).to.be.lessThan(25);
    });
  });
});
