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
    [email, password, 'v2'],
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

        // Step 2: visit the app to establish the origin
        cy.visit('/');

        // Step 3: set localStorage IN THE APP WINDOW (not the Cypress runner window)
        cy.window().then((win) => {
          win.localStorage.setItem('ms_token', token);
          if (user) win.localStorage.setItem('user', JSON.stringify(user));
          
          // Disable tour guide and onboarding welcome modals during automated testing
          win.localStorage.setItem('multishop_has_seen_tour_v1', 'true');
          win.localStorage.setItem('ms-setup-v1', JSON.stringify({
            state: {
              hasProducts: true,
              hasCustomers: true,
              hasSales: true,
              modalDismissed: true,
              isDemoMode: false
            },
            version: 1
          }));
          
          cy.task('log', `[cy.login] Set ms_token in localStorage: ${token.substring(0, 15)}...`);
        });

        cy.intercept('**/auth/me').as('getMe');

        // Step 3.5: hard reload the page so the app bundle re-initializes and reads the token from localStorage
        cy.reload();

        cy.window().then((win) => {
          const storedToken = win.localStorage.getItem('ms_token');
          cy.task('log', `[cy.login] After reload, ms_token in localStorage is: ${storedToken ? storedToken.substring(0, 15) + '...' : 'null'}`);
        });

        cy.wait('@getMe', { timeout: 12000, failOnStatusCode: false }).then((interception) => {
          if (!interception) {
            cy.task('log', '[cy.login] Intercept @getMe was not triggered!');
          } else {
            cy.task('log', `[cy.login] getMe URL: ${interception.request.url}`);
            cy.task('log', `[cy.login] getMe status: ${interception.response?.statusCode}`);
            if (interception.response?.body) {
              cy.task('log', `[cy.login] getMe response body: ${JSON.stringify(interception.response.body).substring(0, 100)}`);
            }
          }
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
          const origin = Cypress.config('baseUrl');
          const token = (storage[origin] || {}).ms_token;
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
    const origin     = Cypress.config('baseUrl');
    const appStorage = storage[origin] || {};
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
    const shops = Array.isArray(res.body.data) ? res.body.data : res.body.data?.shops;
    const id = shops?.[0]?._id;
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
  cy.intercept('**/shops').as('getShops');
  cy.visit('/billing');
  cy.url().then((url) => {
    cy.task('log', `[goToBilling] Visited /billing. Current URL: ${url}`);
  });
  cy.window().then((win) => {
    const token = win.localStorage.getItem('ms_token');
    const user = win.localStorage.getItem('user');
    cy.task('log', `[goToBilling] localStorage token: ${token ? token.substring(0, 15) + '...' : 'null'}, user: ${user ? 'present' : 'null'}`);
  });

  // Do NOT hard-wait on @getShops. React Query caches the shops list, so on a
  // restored session no /shops request fires at all and cy.wait() fails the
  // whole spec in beforeEach. Wait on the thing we actually care about — the POS
  // being interactive — which is true whether shops came from cache or network.
  cy.get('[data-testid="product-search"]', { timeout: 20000 }).should('be.visible');

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
  cy.wait(500); // Wait for search query debounce and API fetch to stabilize
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
  // Click the real close control. `cy.get('button').last()` depended on the close
  // button happening to be last in the DOM, so any extra action in the modal
  // footer (share, edit bill) silently made this click something else and left
  // the modal — and its backdrop — on screen.
  cy.get('[data-testid="invoice-modal"]').within(() => {
    cy.get('[aria-label="Close invoice"]').click();
  });
  cy.get('[data-testid="invoice-modal"]').should('not.exist');
});

// ── cy.selectShop() ──────────────────────────────────────────────────────────
Cypress.Commands.add('selectShop', (shopName) => {
  cy.contains('button', shopName, { timeout: 6000 }).click();
});

// ── Response-shape unwrappers ────────────────────────────────────────────────
// The API is not uniform: list endpoints return { data: [...] } via paginated()
// while single-resource endpoints return { data: { product } } via success().
// Specs that guessed wrong read `undefined` and failed with confusing messages,
// so unwrap through these helpers instead of indexing res.body.data directly.
Cypress.unwrapShops    = (res) =>
  (Array.isArray(res.body?.data) ? res.body.data : res.body?.data?.shops) || [];
Cypress.unwrapProduct  = (res) => res.body?.data?.product  || res.body?.data || {};
Cypress.unwrapCustomer = (res) => res.body?.data?.customer || res.body?.data || {};
Cypress.unwrapSale     = (res) => res.body?.data?.sale     || res.body?.data || {};
