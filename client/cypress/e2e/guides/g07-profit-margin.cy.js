/**
 * GUIDE — Profit & Margin
 *
 * Explains the distinction on the real Inventory and Reports screens, using the
 * margin badge the product list actually renders.
 */
import { caption, beat, clearCaption } from './guidePace';

describe('Guide: Profit & Margin', () => {
  beforeEach(() => cy.login());

  it('walks through profit & margin', () => {
    cy.visit('/inventory');
    cy.contains(/inventory/i, { timeout: 20000 }).should('be.visible');
    caption('Profit per unit is the selling price after discount, minus your cost price.');
    beat(3);

    caption('Margin is that profit as a percentage of the SELLING price — the figure to compare.');
    beat(3);

    caption('Each product shows its margin here. A 50% markup on cost is only a 33% margin on the sale.');
    beat(3);

    caption('The export includes profit, margin and stock value per line, with totals.');
    cy.get('[data-testid="export-csv"]').click();
    beat(2);

    cy.visit('/reports');
    caption('Reports → Profit & Loss shows the whole-shop picture after expenses.');
    beat(3);
    caption('Watch high-turnover products on thin margins — they can earn less than they appear to.');
    beat(2);

    clearCaption();
  });
});
