/**
 * Demo capture — one screenshot per module, straight from the live app.
 *
 * Selectors are route-based plus data-testid / scoped headings. No pixel
 * coordinates, so a layout change moves the screenshot rather than breaking it.
 *
 * Assertions are deliberately STRICT and scoped to the main content area. An
 * earlier version used loose case-insensitive `cy.contains()` over the whole
 * document, which happily matched the login page's marketing copy
 * ("Analytics & reports", "Role-based access") and reported a successful capture
 * while actually screenshotting the login screen.
 */

// `ready` is a string that only appears once the module has PAINTED ITS DATA.
// Without it a slow screen was captured mid-load — and because hideVolatile hides
// spinners, the result was a silently blank frame that still passed the size and
// text checks. The dashboard is the worst case: it is the site's hero image and
// the demo video's poster.
const MODULES = [
  { file: 'dashboard',   route: '/dashboard',   ready: 'Sales Trend'    },
  { file: 'inventory',   route: '/inventory'    },
  { file: 'billing',     route: '/billing',     testid: 'product-search' },
  { file: 'orders',      route: '/orders'       },
  { file: 'customers',   route: '/customers'    },
  { file: 'expenses',    route: '/expenses'     },
  { file: 'reports',     route: '/reports'      },
  { file: 'ai-insights', route: '/ai-insights'  },
  { file: 'campaigns',   route: '/campaigns'    },
  { file: 'automations', route: '/automations'  },
  { file: 'roles',       route: '/roles'        },
  { file: 'staff',       route: '/users'        },
  { file: 'settings',    route: '/settings'     },
];

// A rendered module has substantially more text than an empty shell. A blank
// frame measures ~0–40 chars; the sparsest REAL screen is Automations at 143
// (a legitimate "no automations found" empty state), so 100 separates the two
// without rejecting valid empty states.
const MIN_CONTENT_CHARS = 100;

describe('Demo assets — module screenshots', () => {
  before(() => {
    cy.demoLogin();
  });

  MODULES.forEach(({ file, route, testid, ready }) => {
    it(`captures ${file}`, () => {
      cy.gotoModule(route);

      // Proof we are on the real authenticated screen, not a redirect
      cy.location('pathname').should('eq', route);
      // The app shell only renders inside ProtectedRoute
      cy.get('aside, nav, header').should('exist');

      if (testid) {
        cy.get(`[data-testid="${testid}"]`, { timeout: 20000 }).should('be.visible');
      }
      if (ready) {
        // Data has actually landed, not just the shell
        cy.get('main', { timeout: 30000 }).should('contain.text', ready);
      }

      // Main content must have rendered something substantial — catches the
      // blank-frame case that slipped through as a valid-looking PNG.
      cy.get('main').should('be.visible').invoke('text')
        .should((text) => expect(text.trim().length, `${file} main content`)
          .to.be.greaterThan(MIN_CONTENT_CHARS));

      // Applied last, immediately before the capture, so anything React
      // re-rendered during the settle is still suppressed in the final frame.
      cy.settle(700);
      cy.hideVolatile();
      cy.screenshot(file, { capture: 'viewport', overwrite: true });
      cy.task('log', `captured ${file}.png`);
    });
  });
});
