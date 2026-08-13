/**
 * GUIDE — Sales & Reports
 *
 * Read-only walkthrough of the real Orders and Reports screens.
 */
import { caption, beat, clearCaption } from './guidePace';

describe('Guide: Sales & Reports', () => {
  beforeEach(() => cy.login());

  it('walks through sales & reports', () => {
    cy.visit('/orders');
    cy.contains(/order|invoice|sale/i, { timeout: 20000 }).should('be.visible');
    caption('Orders lists every bill you have raised. Open one to see its lines, payment and invoice.');
    beat(3);

    cy.visit('/reports');
    cy.contains(/report/i, { timeout: 20000 }).should('be.visible');
    caption('Reports aggregates those bills. Pick a date range first — everything responds to it.');
    beat(3);

    caption('Sales trend shows revenue over time; Best sellers shows what actually moves.');
    beat(3);

    caption('Payment breakdown is what you reconcile the till against at close of day.');
    beat(2);

    caption('Profit & Loss subtracts cost of goods and expenses — the number that matters.');
    beat(3);
    caption('Revenue alone is misleading: a busy shop can lose money on a bad margin mix.');
    beat(2);

    clearCaption();
  });
});
