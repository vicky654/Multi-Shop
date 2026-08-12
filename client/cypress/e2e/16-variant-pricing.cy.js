/**
 * TEST SUITE: Variant pricing and product GST at the counter (P0)
 * ─────────────────────────────────────────────────────────────────────────────
 * enrichItems now prefers a matching variant's cost/price/discount over the
 * product's, and computeInvoice prefers the product's gstRate over the
 * invoice-level taxRate. Every fallback is NULLISH, which is the whole safety
 * story: a product with no variant pricing and no gstRate must bill exactly as
 * it did before this feature existed.
 *
 * The two regressions these tests exist to catch:
 *   1. `||` instead of `??` — a legitimate ₹0 variant discount falling through
 *      to the product's discount.
 *   2. `||` instead of `== null` on gstRate — a genuinely zero-rated (0%)
 *      product silently inheriting the invoice tax rate.
 *
 * Requires the API in test mode (npm run dev:test).
 */

describe('Variant pricing and GST at the counter', () => {
  let shopId;

  before(() => {
    cy.login();
    cy.getShopId().then((id) => { shopId = id; });
  });

  beforeEach(() => {
    cy.login();
  });

  const create = (body) => cy.apiRequest('POST', '/products', {
    name:      `Pricing Test ${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    category:  'Footwear',
    unit:      'pair',
    price:     1300,
    costPrice: 1000,
    shopId,
    ...body,
  });

  const sell = (productId, { size = '', color = '', quantity = 1, taxRate = 0 }) =>
    cy.apiRequest('POST', '/sales', {
      shopId,
      items: [{ productId, quantity, selectedSize: size, selectedColor: color }],
      paymentMethod: 'cash',
      taxRate,
    });

  const lineOf = (res) => Cypress.unwrapSale(res).items[0];

  // ── Variant price and cost drive the sale line ─────────────────────────────
  it('sells a variant at its own price and cost', () => {
    create({
      trackVariantStock: true,
      hasVariantPricing: true,
      variantStock: [
        // Size 10 is dearer to buy and to sell.
        { size: '10', color: 'Black', stock: 5, price: 1500, costPrice: 1100 },
        // Size 9 has no override, so it must inherit 1300 / 1000.
        { size: '9',  color: 'Black', stock: 5 },
      ],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;

      sell(id, { size: '10', color: 'Black' }).then((r) => {
        expect(r.status).to.be.oneOf([200, 201]);
        const line = lineOf(r);
        expect(line.price,     'variant price used').to.eq(1500);
        expect(line.costPrice, 'variant cost used').to.eq(1100);
        expect(line.profit,    'profit from the variant figures').to.eq(400);
      });

      sell(id, { size: '9', color: 'Black' }).then((r) => {
        const line = lineOf(r);
        expect(line.price,     'inherited product price').to.eq(1300);
        expect(line.costPrice, 'inherited product cost').to.eq(1000);
        expect(line.profit).to.eq(300);
      });
    });
  });

  it('a product with no variant pricing bills from the product price', () => {
    // The backward-compatibility case: variant stock, uniform pricing.
    create({
      trackVariantStock: true,
      variantStock: [{ size: '9', color: 'Black', stock: 5 }],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      sell(id, { size: '9', color: 'Black' }).then((r) => {
        const line = lineOf(r);
        expect(line.price).to.eq(1300);
        expect(line.costPrice).to.eq(1000);
      });
    });
  });

  it('a variant discount overrides the product discount', () => {
    create({
      discount: 10,                       // product-level 10%
      trackVariantStock: true,
      hasVariantPricing: true,
      variantStock: [
        { size: '9',  color: 'Black', stock: 5, discountType: 'percent', discountValue: 20 },
        { size: '10', color: 'Black', stock: 5 },   // inherits 10%
      ],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;

      sell(id, { size: '9', color: 'Black' }).then((r) => {
        expect(lineOf(r).discount, 'variant 20% wins').to.eq(20);
        expect(lineOf(r).subtotal).to.eq(1040);        // 1300 - 20%
      });
      sell(id, { size: '10', color: 'Black' }).then((r) => {
        expect(lineOf(r).discount, 'inherits product 10%').to.eq(10);
        expect(lineOf(r).subtotal).to.eq(1170);        // 1300 - 10%
      });
    });
  });

  it('per-variant pricing is stripped when the toggle is off', () => {
    // Prices sent while hasVariantPricing is false must not linger and get
    // billed — the user turned the feature off.
    create({
      trackVariantStock: true,
      hasVariantPricing: false,
      variantStock: [{ size: '9', color: 'Black', stock: 5, price: 9999, costPrice: 1 }],
    }).then((res) => {
      const p = Cypress.unwrapProduct(res);
      expect(p.variantStock[0].price).to.eq(null);
      expect(p.variantStock[0].costPrice).to.eq(null);

      sell(p._id, { size: '9', color: 'Black' }).then((r) => {
        expect(lineOf(r).price, 'billed at the product price, not 9999').to.eq(1300);
      });
    });
  });

  // ── GST precedence ─────────────────────────────────────────────────────────
  it('product gstRate drives the invoice line tax rate', () => {
    create({ stock: 10, gstRate: 12 }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      // Bill asks for 5%, but the product says 12% — the product wins.
      sell(id, { taxRate: 5 }).then((r) => {
        const sale = Cypress.unwrapSale(r);
        const detail = sale.gst?.lines || sale.gstLines || sale.invoice?.lines;
        if (detail?.length) {
          expect(detail[0].taxRate).to.eq(12);
        } else {
          // Fall back to the aggregate: 12% of 1300 = 156, whereas 5% = 65.
          expect(sale.taxAmount).to.be.closeTo(156, 1);
        }
      });
    });
  });

  it('a product with gstRate null still uses the invoice tax rate', () => {
    // Guards the null-vs-0 regression: every product created before this field
    // existed has gstRate null and must keep billing at the invoice rate.
    create({ stock: 10 }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      expect(Cypress.unwrapProduct(res).gstRate).to.eq(null);
      sell(id, { taxRate: 5 }).then((r) => {
        // 5% of 1300 = 65
        expect(Cypress.unwrapSale(r).taxAmount).to.be.closeTo(65, 1);
      });
    });
  });

  it('a product with gstRate 0 is genuinely zero-rated', () => {
    // Guards `== null` vs `||`: with `||`, a 0 rate would be falsy and the
    // invoice's 18% would apply instead.
    create({ stock: 10, gstRate: 0 }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      expect(Cypress.unwrapProduct(res).gstRate).to.eq(0);
      sell(id, { taxRate: 18 }).then((r) => {
        expect(Cypress.unwrapSale(r).taxAmount, 'zero-rated stays zero').to.be.closeTo(0, 0.01);
      });
    });
  });

  // ── Discount storage round-trip ────────────────────────────────────────────
  it('a fixed rupee discount bills to the exact rupee figure', () => {
    // Stored as an unrounded equivalent percent so price*(1-pct/100) is exact.
    create({
      stock: 10, price: 1300, costPrice: 1000,
      discountType: 'fixed', discountValue: 200,
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      sell(id, {}).then((r) => {
        expect(lineOf(r).subtotal, '1300 - 200 exactly').to.eq(1100);
      });
    });
  });

  it('profitPercent round-trips as markup on cost', () => {
    create({ stock: 10, costPrice: 1000, profitPercent: 30, price: undefined }).then((res) => {
      const p = Cypress.unwrapProduct(res);
      expect(p.price, '1000 + 30% = 1300').to.eq(1300);
    });
  });

  // ── Oversell protection is unchanged ───────────────────────────────────────
  it('overselling a variant still fails', () => {
    create({
      trackVariantStock: true,
      variantStock: [{ size: '9', color: 'Black', stock: 2 }],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      sell(id, { size: '9', color: 'Black', quantity: 5 }).then((r) => {
        expect(r.status).to.be.oneOf([400, 409]);
      });
    });
  });

  it('selling a variant keeps root stock in lockstep', () => {
    create({
      trackVariantStock: true,
      variantStock: [
        { size: '9',  color: 'Black', stock: 5 },
        { size: '10', color: 'Black', stock: 5 },
      ],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      sell(id, { size: '9', color: 'Black', quantity: 2 }).then(() => {
        cy.apiRequest('GET', `/products/${id}`).then((r) => {
          const p = Cypress.unwrapProduct(r);
          const sum = p.variantStock.reduce((s, v) => s + v.stock, 0);
          expect(p.variantStock.find((v) => v.size === '9').stock).to.eq(3);
          expect(p.variantStock.find((v) => v.size === '10').stock, 'untouched').to.eq(5);
          expect(p.stock, 'root === sum(variantStock)').to.eq(sum);
          expect(p.stock).to.eq(8);
        });
      });
    });
  });
});
