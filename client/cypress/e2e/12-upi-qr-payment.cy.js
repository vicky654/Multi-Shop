/**
 * TEST SUITE: UPI QR payment + Settings → Payments configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * The critical property under test: a UPI bill is NEVER marked paid just
 * because the cashier clicked a button. It stays Pending (and out of revenue
 * reports) until a transaction reference is recorded.
 */

describe('Payments — UPI QR configuration and settlement', () => {
  let shopId;
  let productId;
  let taxRate = 0;
  const PRODUCT_NAME = 'Test UPI Item';
  const TEST_VPA = 'multishoptest@okaxis';
  // Unique per run — a UTR can only ever settle one bill (enforced server-side),
  // so a hardcoded value would 409 on the second run of this spec.
  const UTR = `4${String(Date.now()).slice(-11)}`;

  // Bill total for one unit at ₹150, GST included
  // Server applies statutory round-off to the nearest rupee (utils/gst.js), and
  // the POS previews the same figure, so the expected total is the ROUNDED one.
  const oneUnitTotal = () => Math.round(150 * (1 + taxRate / 100));

  // cy.apiRequest reads the token from the restored session, so every test
  // needs cy.login() — without it the token is gone and requests 401.
  beforeEach(() => {
    cy.login();
  });

  before(() => {
    cy.login();
    cy.apiRequest('GET', '/shops').then((res) => {
      const shops = Array.isArray(res.body.data) ? res.body.data : res.body.data?.shops;
      shopId  = shops?.[0]?._id;
      taxRate = Number(shops?.[0]?.taxRate) || 0;

      cy.apiRequest('POST', '/products', {
        name: PRODUCT_NAME, category: 'Groceries',
        price: 150, costPrice: 90, stock: 20, shopId,
      }).then((r) => {
        productId = r.body.data?._id || r.body.data?.product?._id;
      });
    });
  });

  after(() => {
    if (productId) cy.apiRequest('DELETE', `/products/${productId}`);
    // Leave UPI switched off so other specs see the default POS
    if (shopId) {
      cy.apiRequest('PUT', `/shops/${shopId}`, {
        upiSettings: { enabled: false, vpa: '', merchantName: '', displayName: '' },
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-UPI-001: A malformed UPI ID is rejected', () => {
    cy.apiRequest('PUT', `/shops/${shopId}`, {
      upiSettings: { enabled: true, vpa: 'not-a-vpa', merchantName: 'Test Shop' },
    }).then((res) => {
      expect(res.status).to.eq(400);
      expect(JSON.stringify(res.body)).to.match(/UPI ID/i);
    });
  });

  it('TC-UPI-002: UPI QR cannot be enabled without a VPA', () => {
    cy.apiRequest('PUT', `/shops/${shopId}`, {
      upiSettings: { enabled: true, vpa: '', merchantName: 'Test Shop' },
    }).then((res) => {
      expect(res.status).to.eq(400);
    });
  });

  it('TC-UPI-003: Settings → Payments saves a valid UPI configuration', () => {
    cy.login();
    cy.visit('/settings');

    cy.get('[data-testid="upi-settings"]', { timeout: 12000 }).should('exist').within(() => {
      cy.get('[data-testid="upi-vpa"]').clear().type(TEST_VPA);
      cy.get('[data-testid="upi-merchant"]').clear().type('MultiShop Test Store');
      cy.get('[data-testid="upi-enabled"]').check();
      cy.get('[data-testid="upi-save"]').should('not.be.disabled').click();
    });

    cy.contains('UPI settings saved', { timeout: 8000 }).should('exist');

    cy.apiRequest('GET', `/shops/${shopId}`).then((res) => {
      const shop = res.body.data.shop;
      expect(shop.upiSettings.enabled).to.eq(true);
      expect(shop.upiSettings.vpa).to.eq(TEST_VPA);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-UPI-004: QR bill stays Pending until a reference is entered, then completes', () => {
    cy.login();
    cy.goToBilling();

    cy.addProductToCart(PRODUCT_NAME);

    // Choose scan-to-pay
    cy.get('[data-testid="payment-upi_qr"]', { timeout: 10000 }).should('be.visible').click();

    cy.intercept('POST', '**/sales').as('createSale');
    cy.get('[data-testid="pay-button"]').should('not.be.disabled').click();

    cy.wait('@createSale', { timeout: 15000 }).then((i) => {
      const sale = i.response.body.data.sale;

      // Created UNPAID and out of revenue reports
      expect(sale.paymentStatus).to.eq('pending');
      expect(sale.status).to.eq('pending');
      expect(sale.isUpiQr).to.eq(true);
      expect(sale.upiTxn.refId).to.be.a('string').and.not.be.empty;
      expect(sale.upiTxn.vpa).to.eq(TEST_VPA);

      // QR modal shows the EXACT amount and a scannable image
      cy.get('[data-testid="upi-qr-modal"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="upi-qr-amount"]').should('contain', oneUnitTotal().toFixed(2));
      cy.get('[data-testid="upi-qr-image"]').should('have.attr', 'src').and('match', /^data:image/);
      cy.contains(TEST_VPA).should('exist');

      // A click alone cannot settle it — verify stays disabled with no reference
      cy.get('[data-testid="upi-verify-button"]').should('be.disabled');

      // And the API refuses a referenceless confirmation
      cy.apiRequest('PATCH', `/sales/${sale._id}/upi/verify`, {}).then((res) => {
        expect(res.status).to.be.oneOf([400, 422]);
      });

      // Enter the customer's UTR → verified and completed
      cy.intercept('PATCH', `**/sales/${sale._id}/upi/verify`).as('verifyUpi');
      cy.get('[data-testid="upi-txn-ref"]').type(UTR);
      cy.get('[data-testid="upi-verify-button"]').should('not.be.disabled').click();

      cy.wait('@verifyUpi', { timeout: 15000 }).then((v) => {
        expect(v.response.statusCode).to.eq(200);
        const paid = v.response.body.data.sale;
        expect(paid.paymentStatus).to.eq('paid');
        expect(paid.status).to.eq('completed');
        expect(paid.upiTxn.transactionId).to.eq(UTR);
        expect(paid.upiTxn.verifiedAt).to.be.a('string');
      });

      // Receipt is generated after verification
      cy.get('[data-testid="invoice-modal"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="payment-status-badge"]').should('contain', 'PAID');
      cy.contains(UTR).should('exist');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('TC-UPI-005: The same UTR cannot settle two bills', () => {
    cy.login();
    cy.goToBilling();
    cy.addProductToCart(PRODUCT_NAME);
    cy.get('[data-testid="payment-upi_qr"]').click();

    cy.intercept('POST', '**/sales').as('createSale2');
    cy.get('[data-testid="pay-button"]').click();

    cy.wait('@createSale2', { timeout: 15000 }).then((i) => {
      const saleId = i.response.body.data.sale._id;
      // This UTR was already consumed by TC-UPI-004
      cy.apiRequest('PATCH', `/sales/${saleId}/upi/verify`, { transactionId: UTR })
        .then((res) => {
          expect(res.status).to.eq(409);
          expect(JSON.stringify(res.body)).to.match(/already recorded/i);
        });

      // Cancelling restores the reserved stock
      cy.apiRequest('GET', `/products/${productId}`).then((before) => {
        const stockWhilePending = (before.body.data.product || before.body.data).stock;

        cy.apiRequest('PATCH', `/sales/${saleId}/upi/cancel`, {
          paymentStatus: 'cancelled', reason: 'customer walked away',
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.data.sale.paymentStatus).to.eq('cancelled');
          expect(res.body.data.sale.status).to.eq('cancelled');

          cy.apiRequest('GET', `/products/${productId}`).then((after) => {
            const p = after.body.data.product || after.body.data;
            expect(p.stock).to.eq(stockWhilePending + 1);
          });
        });
      });
    });
  });
});
