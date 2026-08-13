/**
 * GUIDE — Inventory & Stock Audit
 *
 * Opens the REAL Stock Audit panel on the real Inventory screen. It enters a
 * count and shows the computed difference, then leaves without submitting, so a
 * recording never writes an adjustment into the owner's history.
 */
import { caption, beat, clearCaption } from './guidePace';

describe('Guide: Inventory & Stock Audit', () => {
  beforeEach(() => cy.login());

  it('walks through inventory & stock audit', () => {
    cy.visit('/inventory');
    cy.get('[data-testid="stock-audit"]', { timeout: 20000 }).should('be.visible');
    caption('Inventory shows stock, margin and a low-stock warning for every product.');
    beat(2);

    caption('Stock drifts through damage, theft and miscounts — so count the shelves regularly.');
    beat(2);

    caption('Stock Audit opens the counting panel.');
    cy.get('[data-testid="stock-audit"]').click();
    beat(2);

    caption('Enter what you actually counted. The difference against the system is shown before you commit.');
    cy.get('body').then(($body) => {
      const input = $body.find('[data-testid^="audit-count-"] input, input[type="number"]');
      if (input.length) cy.wrap(input.first()).clear().type('7');
    });
    beat(3);

    caption('Submitting writes each difference as a dated adjustment with a reason — auditable, not silently overwritten.');
    beat(2);
    caption('Inaccurate stock overstates your stock value, profit and taxable income.');
    beat(2);

    // Deliberately exit WITHOUT submitting.
    cy.get('[data-testid="stock-audit"]').click();

    clearCaption();
  });
});
