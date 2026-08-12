# Product Add/Edit Wizard with Variant Matrix — Design

**Date:** 2026-08-12
**Status:** Approved

## Problem

Adding inventory for variant-heavy products is impractical today. A shop receives 100 pairs of
running shoes that must be split across 3 colors × 5 sizes. The current product form
([client/src/components/ProductForm.jsx](../../../client/src/components/ProductForm.jsx)) captures
`sizes[]` and `colors[]` as **tags only** — there is no way to say "10 pairs of Black/9". The user
must either create 15 separate products or give up on the breakdown entirely.

## Key insight: the backend already supports this

`trackVariantStock` and `variantStock[{size,color,stock}]` already exist in
[product.model.js](../../../server/src/modules/products/product.model.js) and are **fully wired into
billing**: [sale.service.js](../../../server/src/modules/sales/sale.service.js) atomically moves the
variant cell and root `stock` in one update, guards against overselling, and keeps refunds
symmetric. A Cypress suite (`05-variant-stock.cy.js`) covers it.

Nothing in the UI ever writes these fields. **This feature is primarily a UI that finally writes
them**, plus the server-side guards that keep the model's invariant true once it becomes reachable.

This is explicitly *not* a parallel product system.

## The invariant

> `product.stock === sum(product.variantStock[].stock)` for every variant-tracked product.

`buildStockMovementOps` depends on it — it decrements the matching variant *and* root stock together
so root never drifts. Everything below exists to protect this.

### Landmine: three paths violate it today

| Path | What it does |
|---|---|
| [product.service.js:323](../../../server/src/modules/products/product.service.js#L323) `adjustStock` | `product.stock = newStock` — root only |
| [product.service.js:363](../../../server/src/modules/products/product.service.js#L363) `bulkAuditAdjust` | `$set: { stock: physicalCount }` — root only |
| [insights.service.js:223](../../../server/src/modules/insights/insights.service.js#L223) `bulkRestockProducts` | `$inc: { stock: addQty }` — root only |

These are latent today because the UI cannot create variant products. **Shipping this wizard makes
all three reachable**, so they must be closed in the same change or the feature silently corrupts
inventory.

## Architecture

### 1. Schema (additive; every default chosen so existing rows behave identically)

`variantStockSchema` gains optional per-variant pricing, **defaulting to `null`, never `0`**:

```js
costPrice, price, discount        // null = inherit product-level
discountType, discountValue      // null = inherit product-level
```

`productSchema` gains:

```js
brand             : String,  default ''     // new — requested in Step 1, absent today
profitPercent     : Number,  default null   // markup on cost, kept for round-trip edit
discountType      : 'none' | 'percent' | 'fixed', default 'none'
discountValue     : Number,  default 0
gstRate           : Number,  default null   // null = fall back to invoice-level taxRate
hasVariantPricing : Boolean, default false
```

`null` defaults are load-bearing. `gstRate: 0` would zero out tax on every bill for every
pre-existing product; `price: 0` on a variant would sell it for free. `discount` (percent) remains
the canonical field billing reads — the new `discountType`/`discountValue` pair exists only so the
wizard can reopen showing "₹200 off" instead of "15.384%".

### 2. `utils/pricing.js` — pure pricing engine

Canonical on the server, mirrored to the client, following the existing
[gst.js](../../../server/src/utils/gst.js) convention (client mirrors for instant feedback, server
is the authority). Integer-paise arithmetic, same as `gst.js`.

- `sellingPriceFromMarkup(cost, pct)` and `markupFromSellingPrice(cost, price)` — two-way, so
  editing either profit % or selling price recalculates the other.
- **Profit % is markup on cost** (`1000 + 30% = 1300`), matching the user's example. The summary
  *also* shows margin-on-selling-price, because that is what the existing `profitMargin` virtual and
  the Inventory table display — showing only one would make the two screens look contradictory.
- **Fixed discounts are stored as the full-precision equivalent percent** (`200/1300*100`,
  unrounded). `1300 × (1 − that)` is exactly ₹1100.00 in paise math, so billing needs no change and
  rupee discounts stay paisa-exact.
- `computeProductPricing()` returns MRP, discount amount, final customer price, profit amount,
  profit % on cost, margin % on sell, tax amount, price-with-tax.

Worked example (the user's): cost ₹1000 → +30% → ₹1300 → −10% → customer pays ₹1170 → profit ₹170.

**Drift guard:** a server test evals the client mirror and asserts identical output across a
golden-vector table. The existing `gst.js` mirror only *asks* to be kept in sync; this enforces it.

### 3. `utils/variantMatrix.js` — pure matrix engine

Same canonical + mirror + drift-guard treatment.

Cell key is `${color}||${size}` with `''` for an absent axis — exactly what
[sale.service.js:59-61](../../../server/src/modules/sales/sale.service.js#L59-L61) looks up at sale
time. Four supported shapes:

| Shape | Representation |
|---|---|
| Color + Size | cell per (color, size) pair |
| Size only | single row, `color: ''` |
| Color only | single column, `size: ''` |
| No variants | `trackVariantStock: false`, `variantStock: []` |

Adding or removing an axis **preserves the quantities and prices of surviving cells**.

Operations: `buildMatrix`, `matrixTotals` (row / column / grand), `toVariantStock`,
`fromVariantStock`, `fillAll`, `distributeEvenly`, `copyRow`, `clearAll`.

### 4. `product.normalize.js` — server-side normalization and validation

Applied in **both** `createProduct` and `updateProduct`:

- When `trackVariantStock` is true, **force `stock = sum(variantStock)`**. The matrix is
  authoritative; a UI mismatch against "total received" is a warning, and the server simply makes
  the invariant true.
- Reject duplicate `(size, color)` pairs and negative quantities → 400.
- Normalize `discountType`/`discountValue` into the canonical `discount` percent, at product level
  and per variant.
- Strip per-variant pricing when `hasVariantPricing` is false.
- Clamp `gstRate` to 0–100 or `null`.
- **Partial-update safe:** only touches variant fields the payload actually mentions, merged against
  the existing document, so a `{price}`-only PUT cannot wipe a matrix.

### 5. Closing the three landmines

- `adjustStock` accepts optional `{size, color}` and moves the cell and root in lockstep. On a
  variant-tracked product with no variant given → 400 naming the available variants.
- `bulkAuditAdjust` skips variant-tracked products and reports them as `skipped` rather than
  silently writing a wrong root total.
- `bulkRestockProducts` gets the same treatment.

### 6. Billing — two surgical edits, both nullish-guarded

In `enrichItems`, resolve the matching variant and prefer its pricing:

```js
variant?.price ?? product.price        // same for costPrice and discount
```

In the `computeInvoice` line map:

```js
taxRate: i.gstRate == null ? taxRate : i.gstRate
```

Offline `preservePrice` keeps its existing precedence. Because every fallback is nullish, a product
without variant pricing or `gstRate` produces **byte-identical** results to today.

### 7. UI — `client/src/components/product-wizard/`

`ProductWizard` (stepper shell) with `StepBasic`, `StepVariants`, `VariantMatrix`, `StepPricing`,
`StepDetails`, `StepReview`, and a `useProductWizard` hook holding form state.

Replaces `ProductForm` (only `Inventory.jsx` imports it), absorbing **every** existing field —
Add-by-Photo AI, notify-staff, featured/new-arrival/trending, batch/expiry, low-stock threshold — so
nothing regresses. Shared field widgets (`SizeSelector`, `ColorSelector`, `ImageUploader`,
`CategoryCombobox`) move into the wizard directory rather than being duplicated.

**Five steps:** Basic → Variants & Stock → Pricing → GST & Details → Review & Save.

- Matrix: per-cell quantity, live row/column/grand totals, negatives blocked at the input, plus
  **Fill All**, **Distribute Evenly**, **Copy Row**, and **Clear**.
- Mismatch against "total received" shows an amber inline banner with one-tap *Use matrix total* and
  *Distribute remainder*. It warns; it never blocks.
- Inline field-level validation only — no error modals. Next is disabled with a visible reason.
- Autosave draft to `sessionStorage`, keyed by shop + product id, cleared on successful save — so it
  survives an accidental modal close, not just step navigation.
- Desktop: spacious two-column. Mobile: single column with a sticky Back/Next/Save footer; the
  matrix is `overflow-x-auto` with a sticky color column.
- Step 2 auto-skips when variants are off, so a simple product stays a fast flow.
- Edit and Duplicate open the same wizard, hydrated via `fromVariantStock`.

## Consequences accepted

1. **`stock` becomes derived for variant products.** The matrix wins; "total received" is a
   cross-check, not an input. This is the only way to keep billing's lockstep invariant safe.
2. **The three stock-mutation paths get stricter** for variant products. Slightly less convenient
   than a silent write, but the alternative is undetectable inventory drift.

## Testing

The repo has no test runner and no TypeScript. Unit tests follow the existing plain-Node `t()`
harness pattern from [gst.test.js](../../../server/src/utils/gst.test.js), wired to a new
`npm test` script in `server/package.json`. "Typecheck" is `vite build`.

**Unit:**
- `pricing.test.js` — profit calculation, percent and fixed discount, MRP, profit after discount,
  tax, the worked example, client-mirror drift guard
- `variantMatrix.test.js` — all four shapes, axis add/remove preservation, row/column/grand totals,
  Fill All / Distribute / Copy Row / Clear
- `product.normalize.test.js` — stock forced to sum, partial-update preservation, duplicate and
  negative rejection, discount round-trip, `gstRate` null-safety

**Cypress e2e** (integration and tenant isolation, matching existing suites 01–14):
- `15-product-variant-matrix.cy.js` — simple product unchanged, color-only, size-only, full matrix,
  editing existing variants, `stock === sum`
- `16-variant-pricing.cy.js` — selling Black/10 uses the variant's price and cost for the sale line
  and profit; product `gstRate` drives the invoice line's `taxRate`; negative and duplicate variants
  → 400; `adjustStock` without a variant → 400; cross-tenant variant edit → 403

## Out of scope

Per-variant SKU/barcode, per-variant images, and per-variant GST rates. Not requested, and each
would widen the schema without a driving use case.
