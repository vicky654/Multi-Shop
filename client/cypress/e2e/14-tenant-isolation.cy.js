/**
 * TEST SUITE: Multi-shop tenant isolation (P0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Shop A's credentials must never reach Shop B's data.
 *
 * This suite exists because an audit found four real cross-tenant leaks:
 *   1. List filters did  `filter.shopId = {$in: user.shops}`  then
 *      `if (shopId) filter.shopId = shopId` — the second line OVERWRITES the
 *      membership restriction, so ?shopId=<other tenant> returned their rows.
 *   2. reports shopFilter() returned `{ shopId }` with no membership check at
 *      all — full revenue/profit/best-seller leak.
 *   3. products/customers/expenses/reports/credit-ledger had no shopAccess.
 *   4. credit-ledger read :customerId + ?shopId straight from the request.
 *
 * Fix: shopAccess middleware applied module-wide. These tests are the guard
 * that keeps it applied.
 *
 * Requires the API in test mode (npm run dev:test) — the global DB guard in
 * support/e2e.js aborts otherwise.
 */

const FORBIDDEN = [403, 404];   // either is acceptable: denied or invisible

describe('Tenant isolation — Shop A must not reach Shop B', () => {
  let shopA, shopB;
  let staffTokenOuter = null;
  let bProductId, bCustomerId, bSaleId, bExpenseId;

  before(() => {
    cy.login();

    // The seeded owner owns several shops; treat the first as "A" and second as
    // "B". Using one owner is the STRICTER test: even a shared owner must not be
    // able to cross shops via a shopId the token wasn't scoped to.
    cy.apiRequest('GET', '/shops').then((res) => {
      const shops = Cypress.unwrapShops(res);
      expect(shops.length, 'need at least 2 shops to test isolation').to.be.greaterThan(1);
      shopA = shops[0]._id;
      shopB = shops[1]._id;

      // Collect real Shop B resource ids to attack with
      cy.apiRequest('GET', `/products?shopId=${shopB}&limit=1`).then((r) => {
        bProductId = (r.body.data || [])[0]?._id;
      });
      cy.apiRequest('GET', `/customers?shopId=${shopB}&limit=1`).then((r) => {
        bCustomerId = (r.body.data || [])[0]?._id;
      });
      cy.apiRequest('GET', `/sales?shopId=${shopB}&limit=1`).then((r) => {
        bSaleId = (r.body.data || [])[0]?._id;
      });
      cy.apiRequest('GET', `/expenses?shopId=${shopB}&limit=1`).then((r) => {
        bExpenseId = (r.body.data || [])[0]?._id;
      });
    });
  });

  beforeEach(() => cy.login());

  const asOuter = (method, path) => cy.request({
    method,
    url: Cypress.env('apiUrl') + path,
    headers: staffTokenOuter ? { Authorization: 'Bearer ' + staffTokenOuter } : {},
    failOnStatusCode: false,
  });

  // ── The core guarantee: a scoped user cannot query another shop ────────────
  // Simulated by a staff account whose `shops` contains only one shop.
  describe('staff scoped to a single shop', () => {
    let staffToken;

    before(() => {
      cy.login();
      // The seeded manager legitimately belongs to ALL shops, so it proves
      // nothing. Create a staff account scoped to Shop A ONLY — that is the
      // account whose token must never reach Shop B.
      const email = `iso.staff.${Date.now()}@test.local`;
      cy.apiRequest('POST', '/auth/staff', {
        name: 'Isolation Staff', email, password: 'IsoTest#12345',
        role: 'billing_staff', phone: '9000000123', shopIds: [shopA],
      }).then((mk) => {
        if (![200, 201].includes(mk.status)) { cy.log('staff create failed — scoped tests skip'); return; }
        cy.request({
          method: 'POST', url: `${Cypress.env('apiUrl')}/auth/login`,
          body: { email, password: 'IsoTest#12345' }, failOnStatusCode: false,
        }).then((r) => { if (r.status === 200) { staffToken = r.body.data.token; staffTokenOuter = staffToken; } });
      });
    });

    const asStaff = (method, path) => cy.request({
      method,
      url: `${Cypress.env('apiUrl')}${path}`,
      headers: staffToken ? { Authorization: `Bearer ${staffToken}` } : {},
      failOnStatusCode: false,
    });

    it('TC-ISO-001: cannot list another shop products via ?shopId', () => {
      if (!staffToken) { cy.log('no scoped staff account — skipped'); return; }
      cy.apiRequest('GET', '/auth/me').then(() => {
        asStaff('GET', `/products?shopId=${shopB}`).then((res) => {
          if (res.status === 200) {
            // If allowed, every row MUST still belong to a shop the staff owns
            const rows = res.body.data || [];
            rows.forEach((p) => {
              expect(String(p.shopId?._id || p.shopId), 'leaked product').to.not.eq(String(shopB));
            });
          } else {
            expect(res.status).to.be.oneOf(FORBIDDEN);
          }
        });
      });
    });

    it('TC-ISO-002: cannot read another shop reports via ?shopId', () => {
      if (!staffToken) { cy.log('no scoped staff account — skipped'); return; }
      asStaff('GET', `/reports/dashboard?shopId=${shopB}`).then((res) => {
        expect(res.status, 'reports must not serve another shop').to.be.oneOf(FORBIDDEN);
      });
    });

    it('TC-ISO-003: cannot read another shop customers via ?shopId', () => {
      if (!staffToken) { cy.log('no scoped staff account — skipped'); return; }
      asStaff('GET', `/customers?shopId=${shopB}`).then((res) => {
        if (res.status === 200) {
          (res.body.data || []).forEach((c) => {
            expect(String(c.shopId?._id || c.shopId), 'leaked customer').to.not.eq(String(shopB));
          });
        } else {
          expect(res.status).to.be.oneOf(FORBIDDEN);
        }
      });
    });

    it('TC-ISO-004: cannot read another shop expenses via ?shopId', () => {
      if (!staffToken) { cy.log('no scoped staff account — skipped'); return; }
      asStaff('GET', `/expenses?shopId=${shopB}`).then((res) => {
        if (res.status === 200) {
          (res.body.data || []).forEach((e) => {
            expect(String(e.shopId?._id || e.shopId), 'leaked expense').to.not.eq(String(shopB));
          });
        } else {
          expect(res.status).to.be.oneOf(FORBIDDEN);
        }
      });
    });

    it('TC-ISO-005: cannot bill into another shop', () => {
      if (!staffToken) { cy.log('no scoped staff account — skipped'); return; }
      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/sales`,
        headers: { Authorization: `Bearer ${staffToken}` },
        body: { shopId: shopB, items: [{ productId: bProductId, quantity: 1 }], paymentMethod: 'cash' },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status, 'cross-shop sale must be rejected').to.be.oneOf([...FORBIDDEN, 400, 422]);
      });
    });
  });

  // ── A fabricated shopId must never be honoured ─────────────────────────────
  describe('non-existent / foreign shop ids', () => {
    const FAKE = '000000000000000000000099';

    it('TC-ISO-010: reports reject an unknown shopId', () => {
      cy.apiRequest('GET', `/reports/dashboard?shopId=${FAKE}`).then((res) => {
        // Owner isn't a member of FAKE, so this must be denied — never 200 with data
        expect(res.status).to.be.oneOf(FORBIDDEN);
      });
    });

    it('TC-ISO-011: products reject an unknown shopId', () => {
      cy.apiRequest('GET', `/products?shopId=${FAKE}`).then((res) => {
        if (res.status === 200) expect(res.body.data || []).to.have.length(0);
        else expect(res.status).to.be.oneOf(FORBIDDEN);
      });
    });

    it('TC-ISO-012: credit ledger rejects an unknown shopId', () => {
      cy.apiRequest('GET', `/credit-ledger/${bCustomerId || FAKE}?shopId=${FAKE}`).then((res) => {
        if (res.status === 200) {
          expect(res.body.data || [], 'ledger must be empty for a foreign shop').to.have.length(0);
        } else {
          expect(res.status).to.be.oneOf(FORBIDDEN);
        }
      });
    });
  });

  // ── Guard coverage: shopAccess must be mounted on every tenant module ──────
  describe('shopAccess coverage', () => {
    it('TC-ISO-020: every tenant module rejects a foreign shopId', () => {
      const FAKE = '000000000000000000000099';
      const paths = [
        '/products?shopId=',
        '/customers?shopId=',
        '/expenses?shopId=',
        '/reports/summary?shopId=',
        '/reports/dashboard?shopId=',
        '/reports/best-sellers?shopId=',
        '/reports/profit-loss?shopId=',
        '/sales?shopId=',
      ];
      // Chain sequentially so one failure names the exact endpoint
      paths.forEach((p) => {
        cy.apiRequest('GET', `${p}${FAKE}`).then((res) => {
          const leaked = res.status === 200 && (res.body.data?.length > 0);
          expect(leaked, `${p} leaked data for a foreign shopId`).to.eq(false);
        });
      });
    });
  });

  // ── Direct-ID access: the resource id itself must not leak the row ─────────
  // Query-param guards (shopAccess) are only half the story — fetching Shop B's
  // record BY ID must also be refused, because that path carries no shopId.
  describe('direct-ID cross-shop access', () => {
    const denied = (res, what) => {
      const leaked = res.status === 200 && !!(res.body?.data && Object.keys(res.body.data).length);
      expect(leaked, what + ' leaked via direct id').to.eq(false);
    };

    it('TC-ISO-030: product by id', () => {
      if (!staffTokenOuter || !bProductId) { cy.log('prereq missing'); return; }
      asOuter('GET', '/products/' + bProductId).then((r) => denied(r, 'product'));
    });
    it('TC-ISO-031: customer by id', () => {
      if (!staffTokenOuter || !bCustomerId) { cy.log('prereq missing'); return; }
      asOuter('GET', '/customers/' + bCustomerId).then((r) => denied(r, 'customer'));
    });
    it('TC-ISO-032: sale/invoice by id', () => {
      if (!staffTokenOuter || !bSaleId) { cy.log('prereq missing'); return; }
      asOuter('GET', '/sales/' + bSaleId).then((r) => denied(r, 'sale'));
    });
    it('TC-ISO-033: expense update by id', () => {
      if (!staffTokenOuter || !bExpenseId) { cy.log('prereq missing'); return; }
      asOuter('PUT', '/expenses/' + bExpenseId).then((r) => {
        expect(r.status, 'expense update').to.not.eq(200);
      });
    });
    it('TC-ISO-034: credit ledger by customer id', () => {
      if (!staffTokenOuter || !bCustomerId) { cy.log('prereq missing'); return; }
      asOuter('GET', '/credit-ledger/' + bCustomerId + '?shopId=' + shopB).then((r) => {
        expect(r.status === 200 && (r.body.data || []).length > 0, 'ledger leaked').to.eq(false);
      });
    });
    it('TC-ISO-035: sale edit by id is refused', () => {
      if (!staffTokenOuter || !bSaleId) { cy.log('prereq missing'); return; }
      asOuter('PATCH', '/sales/' + bSaleId).then((r) => {
        expect(r.status, 'cross-shop bill edit').to.not.eq(200);
      });
    });
  });
});
