/**
 * GUIDE 1 — Getting Started: the shop and its GST settings, on the real Settings
 * screen. Read-only apart from opening the GST section, so a recording can never
 * change the owner's configuration.
 */
import { caption, beat, clearCaption } from './guidePace';

describe('Guide: Getting Started', () => {
  beforeEach(() => cy.login());

  it('walks through shop and GST setup', () => {
    cy.visit('/get-started');
    cy.get('[data-testid="journey-steps"]', { timeout: 20000 }).should('be.visible');
    caption('Get Started lists the real steps, ticked from your actual data.');
    beat();

    cy.visit('/settings');
    cy.contains(/settings/i, { timeout: 20000 }).should('be.visible');
    caption('Settings is where the shop itself lives — name, address and phone print on every invoice.');
    beat(2);

    // Open the Tax/GST section if it is behind a tab.
    cy.get('body').then(($b) => {
      const tab = $b.find('button:contains("GST"), button:contains("Tax")');
      if (tab.length) cy.wrap(tab.first()).click();
    });
    beat();
    caption('Enter your GSTIN and the state code fills itself in — it is derived, not typed.');
    beat(2);
    caption('Regular charges GST and can claim input credit. Composition and Not-registered do not charge it.');
    beat(2);
    caption('Everything else — products, billing, reports, tax — hangs off this shop.');

    clearCaption();
  });
});
