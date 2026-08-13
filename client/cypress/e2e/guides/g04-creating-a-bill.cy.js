/**
 * GUIDE 4 — Creating a Bill, on the real POS screen with a real completed sale.
 *
 * Uses the suite's own billing commands, so this records exactly the flow the
 * regression tests already prove works.
 */
import { caption, beat, clearCaption } from './guidePace';

describe('Guide: Creating a Bill', () => {
  const NAME = `Guide Counter Item ${Date.now().toString().slice(-5)}`;

  before(() => {
    cy.login();
    // Seed a plain, non-variant product. Searching the seeded catalogue hit
    // variant products, which correctly open a size/colour picker — that modal is
    // right for the product but noise for this guide.
    cy.seedProduct({ name: NAME, category: 'Guide', price: 1299, costPrice: 780, stock: 25 });
  });

  beforeEach(() => cy.login());

  it('takes a payment and produces an invoice', () => {
    cy.goToBilling();
    caption('This is the counter screen you will use every day.');
    beat();

    caption('Also here: Sample Bill downloads an example invoice with your own GST settings.');
    beat(2);

    caption('Search for a product, or scan its barcode.');
    // The POS is search-first: no product grid is rendered until something is
    // typed, so waiting for product cards up front finds nothing. This is the
    // same command the passing regression specs use — it searches, THEN clicks.
    cy.addProductToCart(NAME);
    beat(2);

    caption('GST is calculated by the server, so the total on screen is the total that gets recorded.');
    beat(2);

    caption('Choose how the customer is paying — cash, UPI, card, or split across several.');
    cy.selectPayment('cash');
    beat(2);

    caption('Take the payment.');
    cy.checkout();

    // The real invoice modal for a real persisted sale.
    cy.get('[data-testid="invoice-modal"], [data-testid="invoice-receipt"]', { timeout: 20000 })
      .should('be.visible');
    beat(2);
    caption('Stock is reduced and the sale reaches Orders, Reports and your GST figures immediately.');
    beat(2);

    // Close via the real control but do not assert the backdrop unmounts: the
    // modal animates out and the guide does not depend on that timing. The
    // regression suite already covers invoice close properly.
    cy.get('body').then(($b) => {
      const close = $b.find('[data-testid="invoice-close"], [aria-label="Close"]');
      if (close.length) cy.wrap(close.first()).click({ force: true });
    });
    beat();
    caption('Not ready to charge? Hold parks the cart — nothing is recorded until payment.');

    clearCaption();
  });
});
