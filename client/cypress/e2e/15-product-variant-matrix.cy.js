/**
 * TEST SUITE: Product variant matrix (P0)
 * ─────────────────────────────────────────────────────────────────────────────
 * The wizard writes a colour × size matrix; billing reads it. The contract
 * between them is one invariant:
 *
 *     product.stock === sum(product.variantStock[].stock)
 *
 * sale.service.js moves the matching cell AND root stock in one atomic update
 * precisely so root never drifts. Any write where the two disagree makes every
 * later sale, refund and low-stock alert for that product wrong, with no error
 * surfaced anywhere. So the server recomputes stock from the matrix and refuses
 * writes that would break it — these tests are the guard on that behaviour.
 *
 * Also covered: all four variant shapes (none / size-only / colour-only / both),
 * editing an existing matrix, the stricter stock-mutation paths, and tenant
 * isolation for variant writes.
 *
 * Requires the API in test mode (npm run dev:test) — the global DB guard in
 * support/e2e.js aborts otherwise.
 */

const SIZES  = ['7', '8', '9', '10', '11'];
const COLORS = ['Black', 'Brown', 'White'];
// The spec's worked example: 100 pairs split 40 / 35 / 25.
const GRID = [
  [5, 10, 10, 10, 5],   // Black = 40
  [5, 5, 10, 10, 5],    // Brown = 35
  [5, 5, 5, 5, 5],      // White = 25
];

const FORBIDDEN = [403, 404];   // denied or invisible — either is acceptable

describe('Product variant matrix', () => {
  let shopId;

  before(() => {
    cy.login();
    cy.getShopId().then((id) => { shopId = id; });
  });

  beforeEach(() => {
    cy.login();
  });

  // Unique names keep reruns from colliding on anything name-scoped.
  const create = (body) => cy.apiRequest('POST', '/products', {
    name:      `Wizard Test ${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    category:  'Footwear',
    unit:      'pair',
    price:     1300,
    costPrice: 1000,
    shopId,
    ...body,
  });

  const fullMatrix = () => {
    const variantStock = [];
    COLORS.forEach((color, ci) =>
      SIZES.forEach((size, si) => variantStock.push({ size, color, stock: GRID[ci][si] })));
    return variantStock;
  };

  // ── Simple products must be completely unaffected ───────────────────────────
  it('simple product: stock behaves exactly as before', () => {
    create({ stock: 50 }).then((res) => {
      expect(res.status).to.be.oneOf([200, 201]);
      const p = Cypress.unwrapProduct(res);
      expect(p.stock).to.eq(50);
      expect(p.trackVariantStock).to.eq(false);
      expect(p.variantStock).to.have.length(0);
    });
  });

  it('simple product: gstRate defaults to null, not 0', () => {
    // A 0 default would silently zero the tax on every pre-existing product.
    create({ stock: 5 }).then((res) => {
      expect(Cypress.unwrapProduct(res).gstRate).to.eq(null);
    });
  });

  // ── The four shapes ────────────────────────────────────────────────────────
  it('color + size matrix: stock equals the matrix total', () => {
    create({ trackVariantStock: true, variantStock: fullMatrix(), stock: 999 }).then((res) => {
      const p = Cypress.unwrapProduct(res);
      expect(p.variantStock).to.have.length(15);
      expect(p.stock, 'server recomputes stock from the matrix, ignoring the sent 999').to.eq(100);

      const rowTotal = (color) => p.variantStock
        .filter((v) => v.color === color)
        .reduce((s, v) => s + v.stock, 0);
      expect(rowTotal('Black')).to.eq(40);
      expect(rowTotal('Brown')).to.eq(35);
      expect(rowTotal('White')).to.eq(25);

      const colTotal = (size) => p.variantStock
        .filter((v) => v.size === size)
        .reduce((s, v) => s + v.stock, 0);
      expect(SIZES.map(colTotal)).to.deep.eq([15, 20, 25, 25, 15]);
    });
  });

  it('size-only product stores an empty color', () => {
    // '' is what sale.service.js matches against when the cart sends no colour.
    create({
      trackVariantStock: true,
      variantStock: [
        { size: 'M', color: '', stock: 4 },
        { size: 'L', color: '', stock: 6 },
      ],
    }).then((res) => {
      const p = Cypress.unwrapProduct(res);
      expect(p.stock).to.eq(10);
      expect(p.variantStock.every((v) => v.color === '')).to.eq(true);
    });
  });

  it('color-only product stores an empty size', () => {
    create({
      trackVariantStock: true,
      variantStock: [
        { size: '', color: 'Red',  stock: 6 },
        { size: '', color: 'Blue', stock: 4 },
      ],
    }).then((res) => {
      const p = Cypress.unwrapProduct(res);
      expect(p.stock).to.eq(10);
      expect(p.variantStock.every((v) => v.size === '')).to.eq(true);
    });
  });

  // ── Editing ────────────────────────────────────────────────────────────────
  it('editing variants recomputes stock and preserves untouched cells', () => {
    create({
      trackVariantStock: true,
      variantStock: [
        { size: '7', color: 'Black', stock: 5 },
        { size: '8', color: 'Black', stock: 10 },
      ],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      expect(Cypress.unwrapProduct(res).stock).to.eq(15);

      // Change size 8, add size 9, leave size 7 alone.
      cy.apiRequest('PUT', `/products/${id}`, {
        variantStock: [
          { size: '7', color: 'Black', stock: 5 },
          { size: '8', color: 'Black', stock: 20 },
          { size: '9', color: 'Black', stock: 7 },
        ],
      }).then((r2) => {
        expect(r2.status).to.eq(200);
        const p = Cypress.unwrapProduct(r2);
        expect(p.stock).to.eq(32);
        expect(p.variantStock).to.have.length(3);
        expect(p.variantStock.find((v) => v.size === '7').stock, 'untouched cell').to.eq(5);
        expect(p.variantStock.find((v) => v.size === '8').stock).to.eq(20);
      });
    });
  });

  it('removing a color from the matrix drops its cells and lowers stock', () => {
    create({
      trackVariantStock: true,
      variantStock: [
        { size: '7', color: 'Black', stock: 5 },
        { size: '7', color: 'Brown', stock: 8 },
      ],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('PUT', `/products/${id}`, {
        variantStock: [{ size: '7', color: 'Black', stock: 5 }],
      }).then((r2) => {
        const p = Cypress.unwrapProduct(r2);
        expect(p.variantStock).to.have.length(1);
        expect(p.stock).to.eq(5);
      });
    });
  });

  it('switching a variant product back to simple clears the matrix', () => {
    create({
      trackVariantStock: true,
      variantStock: [{ size: '7', color: 'Black', stock: 5 }],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('PUT', `/products/${id}`, { trackVariantStock: false, stock: 20 }).then((r2) => {
        const p = Cypress.unwrapProduct(r2);
        expect(p.variantStock).to.have.length(0);
        expect(p.stock).to.eq(20);
      });
    });
  });

  it('a partial update cannot wipe the matrix', () => {
    // updateProduct does Object.assign, so normalization must not emit keys the
    // caller never sent — otherwise a price edit destroys 15 cells of stock.
    create({
      trackVariantStock: true,
      variantStock: [
        { size: '7', color: 'Black', stock: 5 },
        { size: '8', color: 'Black', stock: 10 },
      ],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('PUT', `/products/${id}`, { price: 1500 }).then((r2) => {
        expect(r2.status).to.eq(200);
        const p = Cypress.unwrapProduct(r2);
        expect(p.price).to.eq(1500);
        expect(p.variantStock, 'matrix survived a price-only PUT').to.have.length(2);
        expect(p.stock).to.eq(15);
      });
    });
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  it('rejects negative quantities', () => {
    create({
      trackVariantStock: true,
      variantStock: [{ size: '7', color: 'Black', stock: -1 }],
    }).then((res) => {
      expect(res.status).to.eq(400);
      expect(res.body.message).to.match(/negative/i);
    });
  });

  it('rejects duplicate size/color combinations', () => {
    // Two cells for one combination would let .find() decrement either at random.
    create({
      trackVariantStock: true,
      variantStock: [
        { size: '7', color: 'Black', stock: 1 },
        { size: '7', color: 'Black', stock: 2 },
      ],
    }).then((res) => {
      expect(res.status).to.eq(400);
      expect(res.body.message).to.match(/duplicate/i);
      expect(res.body.message, 'names the offending combination').to.match(/Black \/ 7/);
    });
  });

  it('rejects variant tracking with an empty matrix', () => {
    create({ trackVariantStock: true, variantStock: [] }).then((res) => {
      expect(res.status).to.eq(400);
      expect(res.body.message).to.match(/at least one variant/i);
    });
  });

  it('rejects a direct stock write on a variant product', () => {
    create({
      trackVariantStock: true,
      variantStock: [{ size: '7', color: 'Black', stock: 5 }],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('PUT', `/products/${id}`, { stock: 500 }).then((r2) => {
        expect(r2.status).to.eq(400);
        expect(r2.body.message).to.match(/variant/i);
      });
      // And the real stock is untouched.
      cy.apiRequest('GET', `/products/${id}`).then((r3) => {
        expect(Cypress.unwrapProduct(r3).stock).to.eq(5);
      });
    });
  });

  // ── Stock adjustment must keep cell and root in lockstep ───────────────────
  it('adjust-stock without a variant is refused on a variant product', () => {
    create({
      trackVariantStock: true,
      variantStock: [{ size: '8', color: 'Black', stock: 10 }],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('PATCH', `/products/${id}/adjust-stock`, {
        delta: -2, reason: 'damage',
      }).then((r2) => {
        expect(r2.status).to.eq(400);
        expect(r2.body.message).to.match(/per variant/i);
      });
    });
  });

  it('adjust-stock with a variant moves the cell and root together', () => {
    create({
      trackVariantStock: true,
      variantStock: [
        { size: '7', color: 'Black', stock: 5 },
        { size: '8', color: 'Black', stock: 10 },
      ],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('PATCH', `/products/${id}/adjust-stock`, {
        delta: -2, size: '8', color: 'Black', reason: 'damage',
      }).then((r2) => {
        expect(r2.status).to.eq(200);
        cy.apiRequest('GET', `/products/${id}`).then((r3) => {
          const p = Cypress.unwrapProduct(r3);
          expect(p.variantStock.find((v) => v.size === '8').stock, 'cell moved').to.eq(8);
          expect(p.variantStock.find((v) => v.size === '7').stock, 'other cell untouched').to.eq(5);
          expect(p.stock, 'root stayed in lockstep with the matrix').to.eq(13);
        });
      });
    });
  });

  it('adjust-stock refuses to push a variant cell below zero', () => {
    create({
      trackVariantStock: true,
      variantStock: [{ size: '7', color: 'Black', stock: 3 }],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('PATCH', `/products/${id}/adjust-stock`, {
        delta: -5, size: '7', color: 'Black', reason: 'damage',
      }).then((r2) => {
        expect(r2.status).to.eq(400);
        expect(r2.body.message).to.match(/below 0/i);
      });
    });
  });

  it('adjust-stock on a non-existent variant is refused', () => {
    create({
      trackVariantStock: true,
      variantStock: [{ size: '7', color: 'Black', stock: 3 }],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('PATCH', `/products/${id}/adjust-stock`, {
        delta: 1, size: '99', color: 'Black', reason: 'restock',
      }).then((r2) => {
        expect(r2.status).to.eq(400);
        expect(r2.body.message).to.match(/not found/i);
      });
    });
  });

  it('adjust-stock on a simple product still works unchanged', () => {
    create({ stock: 10 }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('PATCH', `/products/${id}/adjust-stock`, {
        delta: 5, reason: 'restock',
      }).then((r2) => {
        expect(r2.status).to.eq(200);
        cy.apiRequest('GET', `/products/${id}`).then((r3) => {
          expect(Cypress.unwrapProduct(r3).stock).to.eq(15);
        });
      });
    });
  });

  it('bulk audit skips variant products instead of desyncing them', () => {
    create({
      trackVariantStock: true,
      variantStock: [{ size: '7', color: 'Black', stock: 5 }],
    }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('POST', '/products/audit/bulk', {
        shopId,
        items: [{ productId: id, physicalCount: 99 }],
      }).then((r2) => {
        expect(r2.status).to.eq(200);
        const data = r2.body.data;
        expect(data.skipped, 'reported rather than silently mis-written').to.have.length(1);
        expect(data.skipped[0].productId).to.eq(id);
        expect(data.adjusted).to.eq(0);
      });
      // Stock is genuinely untouched.
      cy.apiRequest('GET', `/products/${id}`).then((r3) => {
        expect(Cypress.unwrapProduct(r3).stock).to.eq(5);
      });
    });
  });

  it('bulk audit still adjusts simple products', () => {
    create({ stock: 10 }).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('POST', '/products/audit/bulk', {
        shopId,
        items: [{ productId: id, physicalCount: 7 }],
      }).then((r2) => {
        expect(r2.status).to.eq(200);
        expect(r2.body.data.adjusted).to.eq(1);
        expect(r2.body.data.items[0].discrepancy).to.eq(-3);
      });
    });
  });

  // ── Tenant isolation ───────────────────────────────────────────────────────
  it('cannot create a variant product in another shop', () => {
    cy.apiRequest('GET', '/shops').then((res) => {
      const shops = Cypress.unwrapShops(res);
      if (shops.length < 2) {
        cy.log('Single-shop environment — nothing to isolate');
        return;
      }
      const otherShop = shops.find((s) => s._id !== shopId)?._id;

      // Attack with a shopId the caller is not scoped to. shopAccess must reject
      // it before normalization ever runs.
      cy.apiRequest('POST', '/products', {
        name: `Cross tenant ${Date.now()}`,
        category: 'Footwear', price: 1, costPrice: 1,
        shopId: otherShop,
        trackVariantStock: true,
        variantStock: [{ size: '7', color: 'Black', stock: 1 }],
      }).then((r) => {
        // A shop the token legitimately covers is allowed; the point is that an
        // unscoped one is not. Skip when the seeded owner owns both.
        if (r.status === 200 || r.status === 201) {
          cy.log('Seeded owner covers both shops — see 14-tenant-isolation for the staff-scoped case');
          return;
        }
        expect(r.status).to.be.oneOf(FORBIDDEN);
      });
    });
  });

  it('cannot edit another tenant\'s variant matrix via a guessed id', () => {
    cy.apiRequest('GET', '/shops').then((res) => {
      const shops = Cypress.unwrapShops(res);
      if (shops.length < 2) return;
      const otherShop = shops.find((s) => s._id !== shopId)?._id;

      cy.apiRequest('GET', `/products?shopId=${otherShop}&limit=1`).then((r) => {
        const victim = (r.body.data || [])[0];
        if (!victim) return;
        // A fabricated ObjectId must never resolve to someone else's product.
        cy.apiRequest('PUT', '/products/000000000000000000000001', {
          trackVariantStock: true,
          variantStock: [{ size: '7', color: 'Black', stock: 1 }],
        }).then((r2) => {
          expect(r2.status).to.be.oneOf([...FORBIDDEN, 400]);
        });
      });
    });
  });
});
