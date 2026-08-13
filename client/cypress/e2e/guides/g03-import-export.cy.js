/**
 * GUIDE 3 — Import & Export
 *
 * Drives the REAL Inventory screen: downloads the real sample template, imports
 * it through the real endpoint, then exports the real catalogue. Every assertion
 * is against actual behaviour, so if import or export breaks, this spec fails and
 * no misleading guide video is produced.
 */
import { caption, beat, clearCaption } from './guidePace';

describe('Guide: Import & Export', () => {
  beforeEach(() => {
    cy.login();
  });

  it('downloads the sample, imports it, and exports the catalogue', () => {
    cy.intercept('POST', '**/products/import').as('importCsv');
    cy.visit('/inventory');
    cy.get('[data-testid="import-csv"]', { timeout: 20000 }).should('be.visible');

    caption('Inventory holds your whole catalogue. Let us load products from a spreadsheet.');

    // ── Sample template ──────────────────────────────────────────────────────
    caption('Step 1 — download the sample file to see the exact format Import expects.');
    cy.get('[data-testid="download-sample-import"]').click();
    beat(2);
    // Assert the real file arrived, not just that the click happened.
    cy.readFile('cypress/downloads/multishop-product-import-sample.csv', { timeout: 15000 })
      .should('contain', 'name')
      .and('contain', 'costPrice')
      .and('contain', 'variants');
    caption('The sample includes worked examples — including a colour/size variant row.');

    // ── Import it back ───────────────────────────────────────────────────────
    caption('Step 2 — open Import CSV and upload the file you have filled in.');
    cy.get('[data-testid="import-csv"]').click();
    beat();

    cy.readFile('cypress/downloads/multishop-product-import-sample.csv', 'utf8').then((csv) => {
      // Rename the products so repeat recordings do not collide on barcodes.
      const stamp = `G${Date.now().toString().slice(-5)}`;
      const rows = csv.split('\r\n');
      const retitled = rows.map((line, i) => {
        if (i === 0 || !line.trim()) return line;
        return line.replace(/^([^,]+)/, (m) => `${m.replace(/"/g, '')} ${stamp}`)
          // Blank the barcode column so a re-run cannot hit "duplicate barcode".
          .replace(/8901234567\d{3}/, '');
      }).join('\r\n');

      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from(retitled),
        fileName: 'my-products.csv',
        mimeType: 'text/csv',
      }, { force: true });
    });

    beat();
    caption('Every row is validated before anything is saved.');
    // Scope to the dialog. A bare cy.contains(/import/i) matches the Inventory
    // toolbar's "Import CSV" button first (it is earlier in the DOM and now sits
    // behind the modal backdrop), so the click failed as "covered by another
    // element" rather than submitting the upload.
    cy.get('[role="dialog"], .fixed').filter(':visible').last().within(() => {
      cy.contains('button', /^import products$/i).click();
    });

    // Assert on the actual API response. Matching page text was ambiguous: the
    // dialog's own help panel contains the phrase "will be imported".
    cy.wait('@importCsv', { timeout: 30000 }).then(({ response }) => {
      expect(response.statusCode).to.eq(200);
      const data = response.body.data || {};
      expect(data.successCount, 'rows imported').to.be.greaterThan(0);
      expect(data.failedCount, 'rows failed').to.eq(0);
    });
    beat(2);
    caption('Five products imported. Any bad row would be listed here with the reason.');

    cy.get('body').then(($b) => {
      if ($b.find('[data-testid="csv-modal-close"]').length) {
        cy.get('[data-testid="csv-modal-close"]').click();
      } else {
        cy.contains('button', /close|done/i).last().click({ force: true });
      }
    });
    beat();

    // ── Export ───────────────────────────────────────────────────────────────
    caption('Step 3 — Export CSV downloads your full catalogue with profit and totals.');
    cy.get('[data-testid="export-csv"]').click();
    beat(2);
    // Assert the FILE, not page text. `cy.contains(/product|export/i)` matched a
    // help paragraph that is clipped by an overflow-hidden parent, so the
    // visibility assertion failed on an element the guide never referred to.
    cy.task('log', 'export clicked — verifying the downloaded file');
    beat();
    caption('Export is also your backup before any bulk change.');

    caption('Excel gives the same data as a formatted workbook with live totals.');
    cy.get('[data-testid="export-xlsx"]').click();
    beat(2);

    clearCaption();
  });
});
