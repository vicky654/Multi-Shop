/**
 * The canonical list of captured module assets.
 *
 * Single source of truth shared by publish.mjs and validate.mjs so the two can
 * never drift — a renamed module previously meant a stale PNG could sit on the
 * marketing site indefinitely with nothing flagging it.
 *
 * Keep in sync with client/cypress/demo/01-screenshots.cy.js.
 */
export const MODULE_FILES = [
  'dashboard',
  'inventory',
  'billing',
  'orders',
  'customers',
  'expenses',
  'reports',
  'ai-insights',
  'campaigns',
  'automations',
  'roles',
  'staff',
  'settings',
];

export const VIDEO_NAME = 'multishop-demo.mp4';

/**
 * Extension the marketing site actually references.
 *
 * components/home/hero.tsx and lib/product-screens.ts hardcode
 * "/images/product/<module>.webp", so publishing PNGs would leave the live site
 * serving the OLD webp files — the sync would look successful and change nothing.
 */
export const PUBLISH_EXT = 'webp';

/**
 * Files this tool is responsible for in the marketing images folder: the module
 * assets (either extension) plus any Cypress artifact (failure screenshots are
 * named "<spec> -- <test> (failed).png"). Anything else in that folder belongs to
 * the marketing site and is left untouched.
 */
export const isManagedImage = (filename) =>
  MODULE_FILES.includes(filename.replace(/\.(png|webp)$/i, '')) ||
  /\(failed\)\.png$/i.test(filename) ||
  / -- /.test(filename);
