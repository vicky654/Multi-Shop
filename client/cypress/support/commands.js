// ─────────────────────────────────────────────────────────────────────────────
// Custom Cypress Commands — MultiShop POS
// Backend: http://localhost:5001/api
// Frontend: http://localhost:4000
// ─────────────────────────────────────────────────────────────────────────────

// ── cy.login() ────────────────────────────────────────────────────────────────
//
// WHY this works (and the previous version didn't):
//
//   The broken version did:
//     window.localStorage.setItem('ms_token', token)
//   `window` inside cy.session callbacks is the CYPRESS RUNNER window, not the
//   app window at http://localhost:4000. So cy.session saved empty localStorage
//   and the token was never restored on subsequent specs.
//
//   The fix:
//   1. Call the login API to get the token
//   2. cy.visit('/') to load the app and establish the http://localhost:4000 origin
//   3. cy.window() NOW refers to the APP window → set ms_token there
//   4. cy.session captures the app's localStorage and restores it on future specs
//
Cypress.Commands.add('login', (
  email    = Cypress.env('ownerEmail'),
  password = Cypress.env('ownerPassword'),
) => {
  cy.session(
    [email, password],
    () => {
      // Step 1: get the JWT via API (faster + more reliable than UI login)
      cy.request({
        method:           'POST',
        url:              `${Cypress.env('apiUrl')}/auth/login`,
        body:             { email, password },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(
          200,
          `Login failed (${res.status}) — check ownerEmail/ownerPassword in cypress.env.json`,
        );

        const { token, user } = res.body.data;
        expect(token).to.be.a('string', 'Login response did not include a token');

        // Step 2: visit the app to establish the http://localhost:4000 origin
        cy.visit('/');

        // Step 3: set localStorage IN THE APP WINDOW (not the Cypress runner window)
        cy.window().then((win) => {
          win.localStorage.setItem('ms_token', token);
          if (user) win.localStorage.setItem('user', JSON.stringify(user));
        });

        // Step 4: wait for the app to react to the token and redirect to dashboard
        cy.url({ timeout: 15000 }).should('include', '/dashboard');
      });
    },
    {
      cacheAcrossSpecs: true,

      // validate() runs before using a cached session.
      // If the token is gone (e.g. after cy.clearLocalStorage), re-login.
      validate() {
        cy.getAllLocalStorage().then((storage) => {
          const token = (storage['http://localhost:4000'] || {}).ms_token;
          expect(token).to.be.a('string', 'Cached session token missing — re-logging in');
        });
      },
    },
  );
});

// ── cy.apiRequest() ───────────────────────────────────────────────────────────
//
// WHY cy.getAllLocalStorage() instead of cy.window():
//
//   cy.window() requires a page to be currently loaded in the browser.
//   In before() hooks (before any cy.visit()), there is no page → cy.window()
//   returns the Cypress runner window which has no ms_token.
//
//   cy.getAllLocalStorage() reads from Cypress's internal session store.
//   After cy.login() (or session restoration), the app's localStorage is
//   available even before a page is visited in the current spec.
//   It does NOT require any page to be open.
//
Cypress.Commands.add('apiRequest', (method, path, body = null) => {
  return cy.getAllLocalStorage().then((storage) => {
    // Key is the app origin — must match baseUrl exactly
    const appStorage = storage['http://localhost:4000'] || {};
    const token      = appStorage.ms_token;

    return cy.request({
      method,
      url:              `${Cypress.env('apiUrl')}${path}`,
      body:             body || undefined,
      failOnStatusCode: false,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
    });
  });
});

// ── cy.getShopId() ────────────────────────────────────────────────────────────
Cypress.Commands.add('getShopId', () => {
  return cy.apiRequest('GET', '/shops').then((res) => {
    expect(res.status).to.eq(
      200,
      `GET /shops failed with ${res.status} — is the backend running on port 5001?`,
    );
    const id = res.body.data?.[0]?._id;
    expect(id).to.be.a(
      'string',
      'No shops in the database — create at least one shop via the app before running tests',
    );
    return id;
  });
});

// ── cy.seedProduct() ─────────────────────────────────────────────────────────
// Creates a product, yields { productId, shopId }. Pass overrides for any field.
Cypress.Commands.add('seedProduct', (overrides = {}) => {
  return cy.getShopId().then((shopId) => {
    const payload = {
      name:      `Test Product ${Date.now()}`,
      category:  'Test',
      price:     100,
      costPrice: 60,
      stock:     50,
      shopId,
      ...overrides,
    };
    return cy.apiRequest('POST', '/products', payload).then((res) => {
      expect(res.status).to.be.oneOf([200, 201]);
      const productId = res.body.data?._id || res.body.data?.product?._id;
      expect(productId).to.be.a('string', 'Product creation did not return an _id');
      return { productId, shopId };
    });
  });
});

// ── cy.goToBilling() ─────────────────────────────────────────────────────────
Cypress.Commands.add('goToBilling', () => {
  cy.visit('/billing');
  cy.get('[data-testid="product-search"]', { timeout: 12000 }).should('be.visible');
});

// ── cy.waitForProducts() ─────────────────────────────────────────────────────
Cypress.Commands.add('waitForProducts', () => {
  cy.get('[data-testid^="product-card-"]', { timeout: 15000 })
    .should('have.length.greaterThan', 0);
});

// ── cy.addProductToCart() ────────────────────────────────────────────────────
Cypress.Commands.add('addProductToCart', (searchTerm) => {
  cy.get('[data-testid="product-search"]').clear().type(searchTerm);
  cy.get('[data-testid^="product-card-"]', { timeout: 10000 })
    .filter(':not([data-out-of-stock="true"])')
    .first()
    .click();
});

// ── cy.getCartItem() ─────────────────────────────────────────────────────────
Cypress.Commands.add('getCartItem', (productName) => {
  return cy.contains('[data-testid^="cart-item-"]', productName);
});

// ── cy.selectPayment() ───────────────────────────────────────────────────────
Cypress.Commands.add('selectPayment', (method) => {
  cy.get(`[data-testid="payment-${method}"]`).click();
});

// ── cy.checkout() ────────────────────────────────────────────────────────────
Cypress.Commands.add('checkout', () => {
  cy.get('[data-testid="pay-button"]').should('not.be.disabled').click();
  cy.get('[data-testid="invoice-modal"]', { timeout: 15000 }).should('be.visible');
});

// ── cy.closeInvoice() ────────────────────────────────────────────────────────
Cypress.Commands.add('closeInvoice', () => {
  cy.get('[data-testid="invoice-modal"]').within(() => {
    cy.get('button').last().click();
  });
  cy.get('[data-testid="invoice-modal"]').should('not.exist');
});

// ── cy.selectShop() ──────────────────────────────────────────────────────────
Cypress.Commands.add('selectShop', (shopName) => {
  cy.contains('button', shopName, { timeout: 6000 }).click();
});
