/**
 * GUIDE — GST & Tax
 *
 * Read-only walkthrough of the real Tax & Profit screen and the GST settings it
 * reads from. Changes nothing.
 */
import { caption, beat, clearCaption } from './guidePace';

describe('Guide: GST & Tax', () => {
  beforeEach(() => cy.login());

  it('walks through gst & tax', () => {
    cy.visit('/settings');
    cy.contains(/settings/i, { timeout: 20000 }).should('be.visible');
    caption('Your GSTIN, scheme, price mode and default rate live in Settings → Tax/GST.');
    beat(3);

    caption('Within your state GST splits into CGST + SGST; for another state it is IGST.');
    beat(3);
    caption('That decision comes from the state code derived from your GSTIN.');
    beat(2);

    cy.visit('/purchases');
    cy.contains(/purchase|grn|supplier/i, { timeout: 20000 }).should('be.visible');
    caption('Record purchases with their GST — that tax becomes input credit you can claim.');
    beat(3);

    cy.visit('/tax');
    cy.contains(/tax|profit/i, { timeout: 20000 }).should('be.visible');
    caption('Tax & Profit shows GST collected against eligible credit, and your taxable profit.');
    beat(3);
    caption('Most of what shops lose is credit they never recorded.');
    beat(2);
    caption('Nothing here hides a sale. It makes sure what you owe is calculated on correct figures.');
    beat(2);
    caption('Rates are configured per financial year, so they stay right as the law changes.');
    beat(2);

    clearCaption();
  });
});
