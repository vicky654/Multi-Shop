/**
 * GUIDE 2 — Adding Products, through the real 5-step wizard.
 *
 * Creates a genuine product in the test database (the wizard is the real one), so
 * the recording proves the flow end to end rather than miming it.
 */
import { caption, beat, clearCaption } from './guidePace';

describe('Guide: Adding Products', () => {
  beforeEach(() => cy.login());

  it('creates a product with cost, price and stock', () => {
    cy.visit('/inventory');
    cy.contains('button', /add product/i, { timeout: 20000 }).should('be.visible');
    caption('Inventory → Add Product opens a five-step wizard.');
    cy.contains('button', /add product/i).click();
    beat();

    const name = `Guide Sneaker ${Date.now().toString().slice(-5)}`;
    caption('Step 1 — the name, category and brand.');
    cy.get('[data-testid="wizard-name"]').type(name);
    cy.get('[data-testid="wizard-brand"]').type('StepUp');
    // Target the combobox by test id. Locating it via the label's parent matched
    // the NAME input instead, so "Footwear" was appended to the product name and
    // the category stayed empty — which is why Next was correctly disabled.
    cy.get('[data-testid="wizard-category"]').type('Footwear');
    beat(2);

    // Advance through the wizard using its real Next control.
    const next = () => cy.contains('button', /next|continue/i).click();

    // NOTE ON STEP COUNT: the Variants step exists only for variant products, so
    // a simple product has FOUR steps (Basic → Pricing → Details → Review), not
    // five. Assuming it is always present put the pricing values on the wrong
    // step, and Next then sat correctly disabled on "Cost price is required".
    next(); beat();
    caption('Colours and sizes get their own step when a product has variants — this one does not.');
    beat();

    caption('Pricing — cost and selling price. Profit and margin are calculated as you type.');
    cy.get('[data-testid="wizard-costPrice"]').clear().type('780');
    cy.get('[data-testid="wizard-price"]').clear().type('1299');
    beat(2);
    caption('Cost price is what makes the profit and tax reports meaningful — never leave it blank.');
    beat(2);

    next(); beat();
    caption('Details — optional GST rate, barcode, unit and reorder level.');
    beat(2);

    next(); beat();
    caption('Review the summary, then save.');
    beat();
    cy.contains('button', /save|create|finish/i).click();

    // Assert the real product was created. `should('exist')`, not 'be.visible':
    // the product-card title uses `truncate` (overflow:hidden), which Cypress
    // treats as clipped and therefore not visible. Existence is the real check.
    cy.contains(name, { timeout: 20000 }).should('exist');
    caption('Saved. It is now sellable at the counter.');

    clearCaption();
  });
});
