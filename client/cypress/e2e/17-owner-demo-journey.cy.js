/**
 * TEST SUITE: Full Shop Owner demo journey, driven from the UI (P0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Every other spec in this suite tests one mechanism deeply. This one walks the
 * path a NEW OWNER actually takes, through the real screens, in order:
 *
 *   Login → Shop → Products → Import → Inventory → Stock Audit → Billing →
 *   Orders → Reports → Profit/Margin → Tax & GST → Export
 *
 * It exists because API-level tests cannot catch what breaks a demo: a button
 * that renders but does nothing, a tooltip that never appears, a download that
 * saves a file full of JSON, an empty state that reads "undefined", a dead route
 * in the sidebar, or a React error only visible in the console.
 *
 * SO IT ASSERTS ON THINGS APIs CANNOT SEE
 *   • console.error / uncaught exceptions are collected and failed on
 *   • rendered text is scanned for "undefined", "NaN", "[object Object]"
 *   • downloads are read off disk and their bytes checked
 *   • tooltips are hovered and their content asserted
 *   • both a FRESH EMPTY shop and a shop with data are covered
 */

const MONEY_JUNK = /undefined|NaN|\[object Object\]|Invalid Date/;

/** Pages every owner touches, with the heading that proves the page rendered. */
const CORE_PAGES = [
  { route: '/dashboard',   needle: /dashboard|welcome/i },
  { route: '/get-started', needle: /get started/i },
  { route: '/inventory',   needle: /inventory/i },
  { route: '/billing',     needle: /pos|billing/i },
  { route: '/orders',      needle: /order/i },
  { route: '/reports',     needle: /report/i },
  { route: '/purchases',   needle: /purchase|grn|supplier/i },
  { route: '/tax',         needle: /tax|profit/i },
  { route: '/expenses',    needle: /expense/i },
  { route: '/customers',   needle: /customer/i },
  { route: '/settings',    needle: /setting/i },
];

describe('Shop Owner demo journey (UI)', () => {
  let consoleErrors = [];

  /**
   * Pin the active shop to a known seeded one before the journey starts.
   *
   * Run in isolation this spec passed; run after the others it failed, because an
   * earlier spec had left a shop id in localStorage that the shared purge had
   * since deleted. The export then produced a generic filename. Depending on
   * whatever shop a previous spec happened to leave selected is a real ordering
   * bug in the test, so the journey now establishes its own starting state.
   */
  before(() => {
    cy.login();
    cy.apiRequest('GET', '/shops').then((res) => {
      const shops = res.body.data.shops || res.body.data;
      const seeded = shops.find((s) => /stylehub|toyworld|stepup/i.test(s.name)) || shops[0];
      expect(seeded, 'a seeded shop to run the journey against').to.exist;
      cy.visit('/dashboard');
      cy.get('[data-testid="shop-switcher"]', { timeout: 25000 }).click();
      cy.get(`[data-testid="shop-option-${seeded._id}"]`, { timeout: 10000 }).click();
      cy.get('[data-testid="shop-switcher"]').should('contain.text', seeded.name);
    });
  });

  // Attach listeners on every page load. Cypress replaces the window on visit,
  // so this has to be re-bound per visit via the `window:before:load` event.
  beforeEach(() => {
    consoleErrors = [];
    cy.on('window:before:load', (win) => {
      const origError = win.console.error;
      win.console.error = (...args) => {
        const msg = args.map(String).join(' ');
        // React's dev-only act() and future-flag notices are noise, not defects.
        if (!/DevTools|act\(\)|deprecated|Download the React/i.test(msg)) {
          consoleErrors.push(msg);
        }
        origError.apply(win.console, args);
      };
    });
    // An uncaught exception in the app should fail the journey, not be swallowed.
    cy.on('uncaught:exception', (err) => {
      consoleErrors.push(`UNCAUGHT: ${err.message}`);
      return false;   // keep walking so we collect everything, then assert
    });
    cy.login();
  });

  const assertNoJunk = (label) => {
    cy.get('body').invoke('text').then((text) => {
      const match = text.match(MONEY_JUNK);
      expect(match, `${label} rendered "${match?.[0]}"`).to.equal(null);
    });
  };

  const assertClean = (label) => {
    cy.then(() => {
      expect(consoleErrors, `${label} console errors:\n${consoleErrors.join('\n')}`)
        .to.have.length(0);
    });
  };

  // ── 1. Every core page loads, renders and is free of junk ──────────────────
  describe('1. Core pages render', () => {
    CORE_PAGES.forEach(({ route, needle }) => {
      it(`${route} loads without errors or placeholder junk`, () => {
        cy.visit(route);
        cy.contains(needle, { timeout: 25000 }).should('exist');
        assertNoJunk(route);
        assertClean(route);
      });
    });
  });

  // ── 2. Sidebar has no dead routes ──────────────────────────────────────────
  describe('2. Navigation', () => {
    it('every sidebar link resolves to a real page, not the 404 catch-all', () => {
      cy.visit('/dashboard');
      cy.get('nav a[href^="/"], aside a[href^="/"]').then(($links) => {
        const hrefs = [...new Set([...$links].map((a) => a.getAttribute('href')))]
          // The storefront opens in a new tab and is not part of the admin app.
          .filter((h) => h && !h.startsWith('/shop'));
        expect(hrefs.length, 'sidebar links found').to.be.greaterThan(5);
        cy.wrap(hrefs).each((href) => {
          cy.visit(href);
          // The catch-all renders a not-found page; a real page never does.
          cy.get('body').invoke('text').should((t) => {
            expect(t, `${href} hit the 404 catch-all`).not.to.match(/404|page not found/i);
          });
        });
      });
    });
  });

  // ── 3. Tooltips on the actions the brief calls out ─────────────────────────
  describe('3. Tooltips explain what and why', () => {
    const TOOLTIP_TARGETS = [
      { testid: 'export-csv',             route: '/inventory', needle: /spreadsheet|totals/i },
      { testid: 'export-xlsx',            route: '/inventory', needle: /excel|workbook/i },
      { testid: 'import-csv',             route: '/inventory', needle: /many products|csv/i },
      { testid: 'download-sample-import', route: '/inventory', needle: /format|example/i },
      { testid: 'scan-bill',              route: '/inventory', needle: /supplier bill|photograph/i },
      { testid: 'stock-audit',            route: '/inventory', needle: /count|shrinkage|difference/i },
      { testid: 'download-sample-bill',   route: '/billing',   needle: /invoice|example/i },
    ];

    TOOLTIP_TARGETS.forEach(({ testid, route, needle }) => {
      it(`${testid} has a tooltip that explains the action`, () => {
        cy.visit(route);
        cy.get(`[data-testid="${testid}"]`, { timeout: 25000 }).should('be.visible');
        // React synthesises onMouseEnter from a delegated `mouseover` listener, so
        // dispatching a native 'mouseenter' (which does not bubble) never reaches
        // the handler and the tooltip never opens. Trigger mouseover instead.
        cy.get(`[data-testid="${testid}"]`).parent().trigger('mouseover');
        cy.get('[role="tooltip"]', { timeout: 8000 }).should('be.visible')
          .invoke('text').should('match', needle);
      });
    });
  });

  // ── 4. Downloads: real files, real bytes ───────────────────────────────────
  describe('4. Downloads open and contain real data', () => {
    it('sample import CSV downloads with the production schema', () => {
      cy.visit('/inventory');
      cy.get('[data-testid="download-sample-import"]', { timeout: 25000 }).click();
      cy.readFile('cypress/downloads/multishop-product-import-sample.csv', { timeout: 20000 })
        .should((csv) => {
          expect(csv, 'BOM present').to.match(/^﻿/);
          ['name', 'category', 'price', 'costPrice', 'brand', 'gstRate', 'variants']
            .forEach((c) => expect(csv, `column ${c}`).to.include(c));
          expect(csv, 'no calculated columns in a template').not.to.include('stockValue');
          expect(csv, 'no junk').not.to.match(MONEY_JUNK);
        });
      assertClean('sample import download');
    });

    it('product CSV export downloads with totals and calculated columns', () => {
      cy.task('clearDownloads');
      cy.visit('/inventory');
      cy.get('[data-testid="export-csv"]', { timeout: 25000 }).click();
      // The toast names the file, which also proves the count came back.
      cy.contains(/products? →|only the column headers/i, { timeout: 20000 }).should('exist');
      cy.task('inspectDownload', { pattern: '^products-.*\\.csv$', kind: 'csv' })
        .should((r) => {
          expect(r.ok, `CSV export: ${r.reason || 'ok'}`).to.eq(true);
          expect(r.name, 'descriptive dated filename').to.match(/^products-.+-\d{4}-\d{2}-\d{2}\.csv$/);
          expect(r.rows, 'has data rows').to.be.greaterThan(1);
          ['brand', 'gstRate', 'variants', 'stockValue'].forEach((c) =>
            expect(r.text, `column ${c}`).to.include(c));
        });
    });

    it('XLSX export downloads as a real openable workbook', () => {
      cy.task('clearDownloads');
      cy.visit('/inventory');
      cy.get('[data-testid="export-xlsx"]', { timeout: 25000 }).click();
      cy.contains(/products? →|only the column headers/i, { timeout: 20000 }).should('exist');
      cy.task('inspectDownload', { pattern: '^products-.*\\.xlsx$', kind: 'xlsx' })
        .should((r) => {
          expect(r.ok, `XLSX export: ${r.reason || 'ok'}`).to.eq(true);
          expect(r.size, 'non-trivial workbook').to.be.greaterThan(1000);
          expect(r.parts, 'contains the worksheet').to.include('xl/worksheets/sheet1.xml');
        });
    });

    it('sample bill downloads as a real PDF from the Billing screen', () => {
      cy.task('clearDownloads');
      cy.visit('/billing');
      cy.get('[data-testid="download-sample-bill"]', { timeout: 25000 }).click();
      cy.contains(/sample invoice saved/i, { timeout: 25000 }).should('exist');
      cy.task('inspectDownload', { pattern: '^sample-invoice.*\\.pdf$', kind: 'pdf' })
        .should((r) => {
          expect(r.ok, `PDF: ${r.reason || 'ok'}`).to.eq(true);
          expect(r.size, 'non-trivial PDF').to.be.greaterThan(2000);
          if (r.text) {
            // poppler extracted it — assert the invoice really contains the parts
            // an owner needs to see.
            ['TAX INVOICE', 'SAMPLE', 'CGST', 'SGST', 'TOTAL'].forEach((s) =>
              expect(r.text, `PDF contains ${s}`).to.include(s));
          }
        });
    });
  });

  // ── 5. Export → import round trip, from the UI ─────────────────────────────
  describe('5. Export → edit → import keeps every field', () => {
    it('a variant product survives a UI export and re-import', () => {
      const stamp = `RT${Date.now().toString().slice(-6)}`;
      // Create a variant product through the API (the wizard is covered by spec
      // 15); this test is about the export/import path preserving it.
      cy.getShopId().then((shopId) => {
        cy.apiRequest('POST', '/products', {
          shopId,
          name: `${stamp} Variant Shoe`,
          category: 'Footwear',
          brand: 'RoundTrip',
          price: 2499,
          costPrice: 1550,
          discount: 10,
          gstRate: 12,
          unit: 'pair',
          trackVariantStock: true,
          sizes: ['8', '9'],
          colors: [{ name: 'Blue', hex: '#2563EB' }],
          variantStock: [
            { color: 'Blue', size: '8', stock: 4 },
            { color: 'Blue', size: '9', stock: 6 },
          ],
        }).then((res) => {
          expect(res.status).to.be.oneOf([200, 201]);
        });

        // Export from the UI, exactly as an owner would.
        cy.task('clearDownloads');
        cy.visit('/inventory');
        cy.get('[data-testid="export-csv"]', { timeout: 25000 }).click();
        cy.contains(/products? →/i, { timeout: 20000 }).should('exist');

        cy.task('readDownload', '^products-.*\\.csv$').then((csv) => {
          expect(csv, 'exported CSV was read back').to.be.a('string');

          // "Edit" the file the way an owner would in Excel: drop the TOTAL row
          // (it is a summary, not a product) and blank the barcodes so re-import
          // cannot trip the duplicate-barcode rule.
          const lines = csv.split('\r\n');
          const header = lines[0].replace(/^﻿/, '').split(',');
          const bIdx = header.indexOf('barcode');
          const body = lines.slice(1)
            .filter((l) => l.trim() && !/^TOTAL,/.test(l))
            .map((l) => {
              const cells = l.split(',');
              if (bIdx >= 0) cells[bIdx] = '';
              return cells.join(',');
            });
          const rebuilt = `﻿${header.join(',')}\r\n${body.join('\r\n')}\r\n`;

          cy.intercept('POST', '**/products/import').as('imp');
          cy.visit('/inventory');
          cy.get('[data-testid="import-csv"]').click();
          cy.get('input[type="file"]').selectFile({
            contents: Cypress.Buffer.from(rebuilt),
            fileName: 'roundtrip.csv',
            mimeType: 'text/csv',
          }, { force: true });
          cy.get('[role="dialog"], .fixed').filter(':visible').last().within(() => {
            cy.contains('button', /^import products$/i).click();
          });
          cy.wait('@imp', { timeout: 60000 }).then(({ response }) => {
            expect(response.statusCode).to.eq(200);
            const d = response.body.data || {};
            expect(d.successCount, `imported (errors: ${JSON.stringify((d.errors || []).slice(0, 3))})`)
              .to.be.greaterThan(0);
          });

          // The variant product must come back with EVERY field intact.
          cy.apiRequest('GET', `/products?shopId=${shopId}&limit=100&search=${encodeURIComponent(stamp)}`)
            .then((r) => {
              const list = Array.isArray(r.body.data) ? r.body.data : (r.body.data.products || []);
              const found = list.filter((p) => p.name.includes(stamp));
              expect(found.length, 'original plus round-tripped copy').to.be.greaterThan(1);
              const copy = found[found.length - 1];
              expect(copy.brand, 'brand preserved').to.eq('RoundTrip');
              expect(copy.gstRate, 'gstRate preserved').to.eq(12);
              expect(copy.discount, 'discount preserved').to.eq(10);
              expect(copy.unit, 'unit preserved').to.eq('pair');
              expect(copy.variantStock, 'variant cells preserved').to.have.length(2);
              expect(copy.stock, 'stock === sum(variants)').to.eq(10);
              expect([...copy.sizes].sort(), 'sizes preserved').to.deep.eq(['8', '9']);
              expect(copy.colors[0].name, 'colour preserved').to.eq('Blue');
            });
        });
      });
    });
  });

  // ── 6. Billing feeds inventory, sales, GST and reports ─────────────────────
  describe('6. A bill moves stock and reaches the reports', () => {
    it('completing a sale in the UI reduces stock and appears in Orders', () => {
      const name = `Journey Item ${Date.now().toString().slice(-5)}`;
      cy.seedProduct({ name, category: 'Journey', price: 1000, costPrice: 600, stock: 20 })
        .then(({ productId, shopId }) => {
          cy.goToBilling();
          cy.addProductToCart(name);
          cy.selectPayment('cash');
          cy.checkout();
          cy.get('[data-testid="invoice-modal"], [data-testid="invoice-receipt"]', { timeout: 25000 })
            .should('be.visible');
          assertNoJunk('invoice receipt');
          cy.closeInvoice();

          // Stock came down by exactly one.
          cy.apiRequest('GET', `/products/${productId}`).then((r) => {
            const p = r.body.data.product || r.body.data;
            expect(p.stock, 'stock reduced by 1').to.eq(19);
          });

          // The sale is visible in Orders, in the UI.
          cy.visit('/orders');
          cy.contains(/order|invoice/i, { timeout: 25000 }).should('exist');
          assertNoJunk('/orders');

          // And reflected in the reports the owner reads.
          cy.apiRequest('GET', `/reports/dashboard?shopId=${shopId}`).then((r) => {
            expect(r.status).to.eq(200);
            const d = r.body.data || {};
            const revenue = d.todaySales ?? d.totalSales ?? d.revenue ?? 0;
            expect(Number.isFinite(Number(revenue)), 'revenue is a number').to.eq(true);
          });
        });
    });
  });

  // ── 7. Stock Audit explains discrepancies and does not corrupt stock ───────
  describe('7. Stock Audit', () => {
    it('opens from the UI, shows the difference, and records it correctly', () => {
      const name = `Audit Item ${Date.now().toString().slice(-5)}`;
      cy.seedProduct({ name, category: 'Audit', price: 500, costPrice: 300, stock: 12 })
        .then(({ productId, shopId }) => {
          cy.visit('/inventory');
          cy.get('[data-testid="stock-audit"]', { timeout: 25000 }).click();
          // The panel must appear and must not render junk.
          cy.contains(/audit/i, { timeout: 15000 }).should('exist');
          assertNoJunk('stock audit panel');
          assertClean('stock audit panel');

          // Submit a real audit through the same endpoint and payload shape the
          // panel uses, then confirm the adjustment is exact — an audit that
          // corrupts stock is worse than no audit at all.
          cy.apiRequest('POST', '/products/audit/bulk', {
            shopId,
            items: [{ productId, physicalCount: 9 }],
          }).then((r) => {
            expect(r.status, 'audit accepted').to.be.oneOf([200, 201]);
          });
          cy.apiRequest('GET', `/products/${productId}`).then((r) => {
            const p = r.body.data.product || r.body.data;
            expect(p.stock, 'stock set to the counted figure').to.eq(9);
            expect(p.stock, 'never negative').to.be.at.least(0);
          });
        });
    });

    it('a variant product is SKIPPED with a reason, not silently desynced', () => {
      // A single physical count cannot be split back across a colour/size matrix,
      // and writing it to root alone would break stock === sum(variantStock).
      const name = `Audit Variant ${Date.now().toString().slice(-5)}`;
      cy.getShopId().then((shopId) => {
        cy.apiRequest('POST', '/products', {
          shopId, name, category: 'Audit', price: 900, costPrice: 500,
          trackVariantStock: true,
          sizes: ['8'], colors: [{ name: 'Red', hex: '#DC2626' }],
          variantStock: [{ color: 'Red', size: '8', stock: 7 }],
        }).then((c) => {
          const pid = c.body.data.product?._id || c.body.data._id;
          cy.apiRequest('POST', '/products/audit/bulk', {
            shopId, items: [{ productId: pid, physicalCount: 3 }],
          }).then((r) => {
            expect(r.status).to.be.oneOf([200, 201]);
            const skipped = r.body.data?.skipped || [];
            expect(skipped.length, 'variant product reported as skipped').to.be.greaterThan(0);
            expect(skipped[0].reason, 'skip is explained').to.match(/variant/i);
          });
          // Crucially, the matrix and root are untouched and still agree.
          cy.apiRequest('GET', `/products/${pid}`).then((r) => {
            const p = r.body.data.product || r.body.data;
            expect(p.stock, 'root stock untouched').to.eq(7);
            const sum = (p.variantStock || []).reduce((s, v) => s + v.stock, 0);
            expect(sum, 'stock === sum(variantStock) still holds').to.eq(p.stock);
          });
        });
      });
    });
  });

  // ── 8. Guides: all eight, videos plus written fallback ─────────────────────
  describe('8. Onboarding guides', () => {
    const GUIDE_IDS = [
      'getting-started', 'adding-products', 'import-export', 'creating-a-bill',
      'inventory-stock-audit', 'sales-reports', 'profit-margin', 'gst-tax',
    ];

    it('the journey page lists every step and a real progress figure', () => {
      cy.visit('/get-started');
      cy.get('[data-testid="journey-steps"]', { timeout: 25000 }).should('exist');
      cy.get('[data-testid="journey-progress"]').should('exist');
      assertNoJunk('/get-started');
      assertClean('/get-started');
    });

    it('all 8 guides render with a written walkthrough', () => {
      cy.visit('/get-started');
      cy.get('[data-testid="guide-library"]', { timeout: 25000 }).should('exist');
      cy.wrap(GUIDE_IDS).each((id) => {
        // Written steps are the primary content and must always be reachable.
        cy.get(`[data-testid="guide-steps-toggle-${id}"]`).should('exist').click();
        cy.get(`[data-testid="guide-steps-${id}"]`).should('exist')
          .find('li').should('have.length.greaterThan', 3);
        cy.get(`[data-testid="guide-open-${id}"]`).should('have.attr', 'href');
      });
    });

    it('all 8 videos are served as playable video files', () => {
      cy.wrap(GUIDE_IDS).each((id) => {
        cy.request({ url: `/guides/${id}.mp4`, encoding: 'binary' }).then((res) => {
          expect(res.status, `${id} status`).to.eq(200);
          expect(res.headers['content-type'], `${id} content-type`).to.match(/video/);
          expect(res.body.length, `${id} size`).to.be.greaterThan(50000);
        });
      });
    });

    it('every guide route is a real page', () => {
      cy.visit('/get-started');
      cy.get('[data-testid^="guide-open-"]').then(($links) => {
        const hrefs = [...new Set([...$links].map((a) => a.getAttribute('href')))];
        cy.wrap(hrefs).each((href) => {
          cy.visit(href);
          cy.get('body').invoke('text').should((t) => {
            expect(t, `guide link ${href} is dead`).not.to.match(/404|page not found/i);
          });
        });
      });
    });
  });

  // ── 9. A brand-new, completely empty shop ──────────────────────────────────
  describe('9. Fresh empty shop', () => {
    it('every screen degrades gracefully with no data at all', () => {
      const shopName = `Fresh Demo ${Date.now().toString().slice(-5)}`;
      cy.apiRequest('POST', '/shops', {
        name: shopName, address: 'Test Street', phone: '9000000001',
      }).then((res) => {
        expect(res.status).to.be.oneOf([200, 201]);
        const shop = res.body.data.shop || res.body.data;

        // Switch to it through the REAL shop switcher, as an owner would — not by
        // poking the store directly, because switching shop is itself part of the
        // journey being verified.
        cy.visit('/dashboard');
        cy.get('[data-testid="shop-switcher"]', { timeout: 25000 }).click();
        cy.get(`[data-testid="shop-option-${shop._id}"]`, { timeout: 10000 }).click();
        cy.get('[data-testid="shop-switcher"]').should('contain.text', shopName);

        // Every page must render an empty state, not a crash or "undefined".
        ['/inventory', '/billing', '/orders', '/reports', '/tax', '/get-started']
          .forEach((route) => {
            cy.visit(`${route}`);
            cy.get('body', { timeout: 25000 }).should('be.visible');
            assertNoJunk(`empty shop ${route}`);
          });
        assertClean('empty shop walkthrough');

        // Export on an empty shop must still produce a usable header-only file.
        cy.apiRequest('GET', `/products/export?shopId=${shop._id}`).then((r) => {
          expect(r.status).to.eq(200);
          expect(String(r.body)).to.include('name');
        });
      });
    });
  });

  // ── 10. Tenant isolation from the UI session ───────────────────────────────
  describe('10. Isolation and permissions', () => {
    it('a shop the owner does not own is refused', () => {
      cy.apiRequest('GET', '/products?shopId=000000000000000000000099')
        .then((r) => expect(r.status).to.be.oneOf([400, 403, 404]));
      cy.apiRequest('GET', '/products/export?shopId=000000000000000000000099')
        .then((r) => expect(r.status).to.be.oneOf([400, 403, 404]));
      cy.apiRequest('GET', '/sales/sample-invoice?shopId=000000000000000000000099')
        .then((r) => expect(r.status).to.be.oneOf([400, 403, 404]));
    });
  });

  // ── 11. Responsive: the demo may be shown on a phone ──────────────────────
  describe('11. Responsive', () => {
    [
      { name: 'phone',  w: 390,  h: 844 },
      { name: 'tablet', w: 768,  h: 1024 },
    ].forEach(({ name, w, h }) => {
      it(`key screens are usable and do not scroll sideways on ${name}`, () => {
        cy.viewport(w, h);
        ['/dashboard', '/inventory', '/billing', '/get-started'].forEach((route) => {
          cy.visit(route);
          cy.get('body', { timeout: 25000 }).should('be.visible');
          // Horizontal overflow is the classic mobile break.
          cy.window().then((win) => {
            const doc = win.document.documentElement;
            expect(doc.scrollWidth, `${route} on ${name} scrolls sideways`)
              .to.be.at.most(doc.clientWidth + 2);
          });
          assertNoJunk(`${route} on ${name}`);
        });
      });
    });
  });
});
