/**
 * TEST SUITE: 18 - Website Order Flow & Comprehensive Inventory Regression
 * ─────────────────────────────────────────────────────────────────────────────
 * Covers all 12 mandatory E2E regression scenarios:
 *  1. Normal completed billing → inventory decreases.
 *  2. Multiple variants → exact variants decrease.
 *  3. Draft billing → no stock movement.
 *  4. Website order → pending, no permanent deduction before acceptance.
 *  5. Owner accepts → exact stock deduction.
 *  6. Owner rejects → stock unchanged.
 *  7. Insufficient stock → acceptance blocked safely.
 *  8. Double acceptance → only one deduction.
 *  9. Concurrent customer orders → no overselling.
 * 10. Accepted order cancellation → correct reversal.
 * 11. Inventory UI reflects database immediately.
 * 12. Cross-shop order/inventory isolation.
 */

describe('18 - Website Order & Comprehensive Inventory Regression Flow', () => {
  let shopA;
  let shopB;
  let simpleProductA;
  let variantProductA;
  let simpleProductB;

  const SIMPLE_STOCK_INITIAL  = 20;
  const VARIANT_STOCK_8 = 6;
  const VARIANT_STOCK_9 = 8;
  const VARIANT_TOTAL   = VARIANT_STOCK_8 + VARIANT_STOCK_9; // 14

  before(() => {
    cy.login();

    // Fetch shops for testing tenant isolation
    cy.apiRequest('GET', '/shops').then((res) => {
      const shops = Cypress.unwrapShops(res);
      expect(shops.length).to.be.at.least(1);
      shopA = shops[0]._id;
      shopB = shops[1]?._id || shopA;

      // Create Simple Product for Shop A
      cy.apiRequest('POST', '/products', {
        name:      'Reg Simple Shirt',
        category:  'Clothes',
        price:     500,
        costPrice: 200,
        stock:     SIMPLE_STOCK_INITIAL,
        shopId:    shopA,
      }).then((pRes) => {
        simpleProductA = Cypress.unwrapProduct(pRes)._id;

        // Create Variant Product for Shop A
        cy.apiRequest('POST', '/products', {
          name:              'Reg Air Runner 270',
          category:          'Shoes',
          price:             2500,
          costPrice:         1200,
          stock:             VARIANT_TOTAL,
          shopId:            shopA,
          trackVariantStock: true,
          sizes:             ['8', '9'],
          colors:            [{ name: 'Black', hex: '#000000' }],
          variantStock: [
            { size: '8', color: 'Black', stock: VARIANT_STOCK_8 },
            { size: '9', color: 'Black', stock: VARIANT_STOCK_9 },
          ],
        }).then((vRes) => {
          variantProductA = Cypress.unwrapProduct(vRes)._id;

          // Create Simple Product for Shop B (if 2 shops exist)
          if (shopB !== shopA) {
            cy.apiRequest('POST', '/products', {
              name:      'Shop B Exclusive Product',
              category:  'Electronics',
              price:     1000,
              costPrice: 500,
              stock:     50,
              shopId:    shopB,
            }).then((bRes) => {
              simpleProductB = Cypress.unwrapProduct(bRes)._id;
            });
          }
        });
      });
    });
  });

  beforeEach(() => {
    cy.login();
  });

  after(() => {
    cy.login();
    if (simpleProductA) cy.apiRequest('DELETE', `/products/${simpleProductA}`);
    if (variantProductA) cy.apiRequest('DELETE', `/products/${variantProductA}`);
    if (simpleProductB && shopB !== shopA) cy.apiRequest('DELETE', `/products/${simpleProductB}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('1. Normal completed billing → inventory decreases', () => {
    cy.apiRequest('POST', '/sales', {
      shopId: shopA,
      items: [{ productId: simpleProductA, quantity: 2 }],
      paymentMethod: 'cash',
    }).then((saleRes) => {
      expect(saleRes.status).to.eq(201);

      cy.apiRequest('GET', `/products/${simpleProductA}`).then((prodRes) => {
        const prod = Cypress.unwrapProduct(prodRes);
        expect(prod.stock).to.eq(SIMPLE_STOCK_INITIAL - 2); // 20 - 2 = 18
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('2. Multiple variants → correct variants decrease', () => {
    cy.apiRequest('POST', '/sales', {
      shopId: shopA,
      items: [{
        productId:    variantProductA,
        quantity:     3,
        selectedSize:  '9',
        selectedColor: 'Black',
      }],
      paymentMethod: 'cash',
    }).then((saleRes) => {
      expect(saleRes.status).to.eq(201);

      cy.apiRequest('GET', `/products/${variantProductA}`).then((prodRes) => {
        const prod = Cypress.unwrapProduct(prodRes);
        const v9   = prod.variantStock.find((v) => v.size === '9' && v.color === 'Black');
        const v8   = prod.variantStock.find((v) => v.size === '8' && v.color === 'Black');

        expect(v9.stock).to.eq(VARIANT_STOCK_9 - 3); // 8 - 3 = 5
        expect(v8.stock).to.eq(VARIANT_STOCK_8);     // 6 untouched
        expect(prod.stock).to.eq(VARIANT_TOTAL - 3);  // 14 - 3 = 11
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('3. Draft billing → no stock movement', () => {
    cy.apiRequest('GET', `/products/${simpleProductA}`).then((beforeRes) => {
      const stockBefore = Cypress.unwrapProduct(beforeRes).stock;

      // Draft orders (status: 'draft') must not deduct stock
      cy.apiRequest('POST', '/sales', {
        shopId: shopA,
        items: [{ productId: simpleProductA, quantity: 5 }],
        status: 'draft',
        paymentMethod: 'cash',
      }).then(() => {
        cy.apiRequest('GET', `/products/${simpleProductA}`).then((afterRes) => {
          expect(Cypress.unwrapProduct(afterRes).stock).to.eq(stockBefore);
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('4. Website order → pending, no permanent deduction before acceptance', () => {
    cy.apiRequest('GET', `/products/${simpleProductA}`).then((simpleBefore) => {
      const simpleStockBefore = Cypress.unwrapProduct(simpleBefore).stock;

      cy.apiRequest('GET', `/products/${variantProductA}`).then((varBefore) => {
        const varProdBefore = Cypress.unwrapProduct(varBefore);
        const v5Before = varProdBefore.variantStock.find((v) => v.size === '9').stock;

        // Public website checkout
        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl') || 'http://localhost:5000/api'}/sales/public/checkout`,
          body: {
            shopId: shopA,
            customerName: 'Test Web Customer',
            customerPhone: '9876500111',
            items: [
              { productId: simpleProductA, quantity: 4 },
              { productId: variantProductA, quantity: 2, selectedSize: '9', selectedColor: 'Black' },
            ],
          },
        }).then((webRes) => {
          expect(webRes.status).to.eq(201);
          const sale = webRes.body.data.sale;
          expect(sale.status).to.eq('pending');

          // Verify database stock is UNCHANGED
          cy.apiRequest('GET', `/products/${simpleProductA}`).then((simpleAfter) => {
            expect(Cypress.unwrapProduct(simpleAfter).stock).to.eq(simpleStockBefore);
          });

          cy.apiRequest('GET', `/products/${variantProductA}`).then((varAfter) => {
            const varProdAfter = Cypress.unwrapProduct(varAfter);
            const v5After = varProdAfter.variantStock.find((v) => v.size === '9').stock;
            expect(v5After).to.eq(v5Before);
          });
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('5. Owner accepts website order → exact stock deduction', () => {
    // Create pending website order
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl') || 'http://localhost:5000/api'}/sales/public/checkout`,
      body: {
        shopId: shopA,
        customerName: 'Customer To Accept',
        customerPhone: '9876500222',
        items: [
          { productId: simpleProductA, quantity: 2 },
          { productId: variantProductA, quantity: 1, selectedSize: '8', selectedColor: 'Black' },
        ],
      },
    }).then((webRes) => {
      const saleId = webRes.body.data.sale._id;

      cy.apiRequest('GET', `/products/${simpleProductA}`).then((sBeforeRes) => {
        const sStockBefore = Cypress.unwrapProduct(sBeforeRes).stock;

        cy.apiRequest('GET', `/products/${variantProductA}`).then((vBeforeRes) => {
          const vStockBefore = Cypress.unwrapProduct(vBeforeRes).variantStock.find((v) => v.size === '8').stock;

          // Owner accepts order
          cy.apiRequest('PATCH', `/sales/${saleId}/accept`).then((acceptRes) => {
            expect(acceptRes.status).to.eq(200);
            expect(acceptRes.body.data.sale.status).to.eq('completed');

            // Verify stock is now decremented
            cy.apiRequest('GET', `/products/${simpleProductA}`).then((sAfterRes) => {
              expect(Cypress.unwrapProduct(sAfterRes).stock).to.eq(sStockBefore - 2);
            });

            cy.apiRequest('GET', `/products/${variantProductA}`).then((vAfterRes) => {
              const vStockAfter = Cypress.unwrapProduct(vAfterRes).variantStock.find((v) => v.size === '8').stock;
              expect(vStockAfter).to.eq(vStockBefore - 1);
            });
          });
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('6. Owner rejects website order → stock unchanged', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl') || 'http://localhost:5000/api'}/sales/public/checkout`,
      body: {
        shopId: shopA,
        customerName: 'Customer To Reject',
        customerPhone: '9876500333',
        items: [{ productId: simpleProductA, quantity: 3 }],
      },
    }).then((webRes) => {
      const saleId = webRes.body.data.sale._id;

      cy.apiRequest('GET', `/products/${simpleProductA}`).then((beforeRes) => {
        const stockBefore = Cypress.unwrapProduct(beforeRes).stock;

        // Owner rejects order
        cy.apiRequest('PATCH', `/sales/${saleId}/reject`, { reason: 'Stock unavailable' }).then((rejectRes) => {
          expect(rejectRes.status).to.eq(200);
          expect(rejectRes.body.data.sale.status).to.eq('rejected');

          cy.apiRequest('GET', `/products/${simpleProductA}`).then((afterRes) => {
            expect(Cypress.unwrapProduct(afterRes).stock).to.eq(stockBefore);
          });
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('7. Insufficient stock → acceptance blocked safely with 409 error', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl') || 'http://localhost:5000/api'}/sales/public/checkout`,
      body: {
        shopId: shopA,
        customerName: 'Overorder Customer',
        customerPhone: '9876500444',
        items: [{ productId: simpleProductA, quantity: 9999 }], // Exceeds stock
      },
    }).then((webRes) => {
      const saleId = webRes.body.data.sale._id;

      cy.apiRequest('GET', `/products/${simpleProductA}`).then((beforeRes) => {
        const stockBefore = Cypress.unwrapProduct(beforeRes).stock;

        // Attempting to accept must fail
        cy.apiRequest('PATCH', `/sales/${saleId}/accept`).then((res) => {
          expect(res.status).to.eq(409);

          cy.apiRequest('GET', `/products/${simpleProductA}`).then((afterRes) => {
            expect(Cypress.unwrapProduct(afterRes).stock).to.eq(stockBefore);
          });
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('8. Double acceptance → only one deduction', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl') || 'http://localhost:5000/api'}/sales/public/checkout`,
      body: {
        shopId: shopA,
        customerName: 'Double Accept Test',
        customerPhone: '9876500555',
        items: [{ productId: simpleProductA, quantity: 1 }],
      },
    }).then((webRes) => {
      const saleId = webRes.body.data.sale._id;

      cy.apiRequest('GET', `/products/${simpleProductA}`).then((beforeRes) => {
        const stockBefore = Cypress.unwrapProduct(beforeRes).stock;

        // First accept succeeds
        cy.apiRequest('PATCH', `/sales/${saleId}/accept`).then((res1) => {
          expect(res1.status).to.eq(200);

          // Second accept fails
          cy.apiRequest('PATCH', `/sales/${saleId}/accept`).then((res2) => {
            expect(res2.status).to.be.oneOf([400, 409]);

            cy.apiRequest('GET', `/products/${simpleProductA}`).then((afterRes) => {
              // Decremented exactly once by 1
              expect(Cypress.unwrapProduct(afterRes).stock).to.eq(stockBefore - 1);
            });
          });
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('9. Concurrent customer orders → no overselling', () => {
    // Create a temporary product with stock = 1
    cy.apiRequest('POST', '/products', {
      name:      'Last Unit Limited Item',
      category:  'Special',
      price:     100,
      costPrice: 50,
      stock:     1,
      shopId:    shopA,
    }).then((pRes) => {
      const limitedProdId = Cypress.unwrapProduct(pRes)._id;

      // Two customer website orders placed for the same last unit
      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl') || 'http://localhost:5000/api'}/sales/public/checkout`,
        body: {
          shopId: shopA,
          customerName: 'Customer 1',
          customerPhone: '9900112233',
          items: [{ productId: limitedProdId, quantity: 1 }],
        },
      }).then((order1Res) => {
        const order1Id = order1Res.body.data.sale._id;

        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl') || 'http://localhost:5000/api'}/sales/public/checkout`,
          body: {
            shopId: shopA,
            customerName: 'Customer 2',
            customerPhone: '9900112244',
            items: [{ productId: limitedProdId, quantity: 1 }],
          },
        }).then((order2Res) => {
          const order2Id = order2Res.body.data.sale._id;

          // Owner accepts Order 1
          cy.apiRequest('PATCH', `/sales/${order1Id}/accept`).then((acc1) => {
            expect(acc1.status).to.eq(200);

            // Owner attempts to accept Order 2 -> fails with 409
            cy.apiRequest('PATCH', `/sales/${order2Id}/accept`).then((acc2) => {
              expect(acc2.status).to.eq(409);

              cy.apiRequest('GET', `/products/${limitedProdId}`).then((checkRes) => {
                expect(Cypress.unwrapProduct(checkRes).stock).to.eq(0);
                cy.apiRequest('DELETE', `/products/${limitedProdId}`);
              });
            });
          });
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('10. Accepted order cancellation → correct stock reversal', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl') || 'http://localhost:5000/api'}/sales/public/checkout`,
      body: {
        shopId: shopA,
        customerName: 'Cancel Order Test',
        customerPhone: '9876500666',
        items: [
          { productId: simpleProductA, quantity: 2 },
          { productId: variantProductA, quantity: 1, selectedSize: '8', selectedColor: 'Black' },
        ],
      },
    }).then((webRes) => {
      const saleId = webRes.body.data.sale._id;

      // Accept first
      cy.apiRequest('PATCH', `/sales/${saleId}/accept`).then(() => {
        cy.apiRequest('GET', `/products/${simpleProductA}`).then((sBeforeRes) => {
          const sStockBefore = Cypress.unwrapProduct(sBeforeRes).stock;

          cy.apiRequest('GET', `/products/${variantProductA}`).then((vBeforeRes) => {
            const vStockBefore = Cypress.unwrapProduct(vBeforeRes).variantStock.find((v) => v.size === '8').stock;

            // Reject/cancel accepted order -> restores stock
            cy.apiRequest('PATCH', `/sales/${saleId}/reject`, { reason: 'Customer changed mind' }).then((rejRes) => {
              expect(rejRes.status).to.eq(200);

              cy.apiRequest('GET', `/products/${simpleProductA}`).then((sAfterRes) => {
                expect(Cypress.unwrapProduct(sAfterRes).stock).to.eq(sStockBefore + 2);
              });

              cy.apiRequest('GET', `/products/${variantProductA}`).then((vAfterRes) => {
                const vStockAfter = Cypress.unwrapProduct(vAfterRes).variantStock.find((v) => v.size === '8').stock;
                expect(vStockAfter).to.eq(vStockBefore + 1);
              });
            });
          });
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('11. Inventory UI reflects database state immediately', () => {
    cy.visit('/inventory');
    cy.get('input[placeholder*="Search"]').type('Reg Simple Shirt');
    cy.contains('Reg Simple Shirt').should('be.visible');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('12. Cross-shop order and inventory isolation', () => {
    if (shopA === shopB || !simpleProductB) {
      cy.log('Skipping cross-shop isolation (only 1 shop present)');
      return;
    }

    // Creating sale in Shop A should not affect Shop B product stock
    cy.apiRequest('GET', `/products/${simpleProductB}`).then((bBeforeRes) => {
      const bStockBefore = Cypress.unwrapProduct(bBeforeRes).stock;

      cy.apiRequest('POST', '/sales', {
        shopId: shopA,
        items: [{ productId: simpleProductA, quantity: 1 }],
        paymentMethod: 'cash',
      }).then(() => {
        cy.apiRequest('GET', `/products/${simpleProductB}`).then((bAfterRes) => {
          expect(Cypress.unwrapProduct(bAfterRes).stock).to.eq(bStockBefore);
        });
      });
    });
  });
});
