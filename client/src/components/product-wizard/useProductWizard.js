/**
 * useProductWizard — all state and every derived value for the product wizard.
 *
 * DESIGN RULES
 *   1. NOTHING DERIVABLE IS STORED. Row/column totals, the pricing summary and
 *      the per-variant pricing table are recomputed on render. Storing them is
 *      how a matrix ends up showing a total that no longer matches its cells.
 *   2. The matrix is the source of truth for a variant product's stock. The
 *      "total received" box is a cross-check that produces a warning, never an
 *      error — the server recomputes stock from the matrix regardless.
 *   3. Price and profit % are two-way. Each setter writes only the OTHER field,
 *      never itself, so there is no feedback loop.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  computeProductPricing, sellingPriceFromMarkup, markupFromSellingPrice,
} from '../../utils/pricing';
import {
  buildMatrix, matrixTotals, fromVariantStock, toVariantStock, cellKey,
} from '../../utils/variantMatrix';

export const EMPTY_WIZARD_FORM = {
  // Step 1 — basic
  name: '', brand: '', category: '', subCategory: '', unit: 'pcs',
  sku: '', barcode: '', description: '', images: [], shopId: '',

  // Step 2 — variants
  hasVariants: false,
  variantAxis: 'both',            // 'color' | 'size' | 'both'
  sizes: [], colors: [],
  totalReceived: '',
  stock: '',                      // used only when hasVariants is false

  // Step 3 — pricing
  costPrice: '', price: '', profitPercent: '',
  discountType: 'none', discountValue: '',
  discount: 0,                    // canonical percent, derived
  hasVariantPricing: false,

  // Step 4 — GST + details
  gstRate: '', hsnCode: '', taxType: 'taxable',
  lowStockThreshold: 10, reorderPoint: 0, minStock: 0, maxStock: 0,
  trackBatch: false, batchNumber: '', trackExpiry: false, expiryDate: '',
  isFeatured: false, isNewArrival: false, isTrending: false,
  notifyCustomers: false,
};

const DRAFT_PREFIX = 'ms_product_draft';

/**
 * Rebuild wizard-only fields from a saved product.
 * `hasVariants` and `variantAxis` are not persisted — they are presentation
 * state derivable from trackVariantStock and the shape of variantStock.
 */
export function hydrateForm(product, fallbackShopId) {
  if (!product) return { ...EMPTY_WIZARD_FORM, shopId: fallbackShopId || '' };

  const matrix = fromVariantStock(product.variantStock);
  const hasColors = matrix.rows.some((r) => r !== '');
  const hasSizes  = matrix.cols.some((c) => c !== '');

  // For a variant product the AXES MUST COME FROM THE MATRIX, not from the
  // sizes[]/colors[] tag arrays. Those two can legitimately disagree — colors[]
  // is a storefront filter tag, variantStock is actual stock — and seeding the
  // selectors from the tags would make the very first axis edit rebuild the grid
  // against a different set of columns and silently drop the user's quantities.
  const matrixColors = product.trackVariantStock && hasColors
    ? matrix.rows.map((name) =>
        (product.colors || []).find((c) => c.name === name) || { name, hex: '#6b7280' })
    : (product.colors || []);
  const matrixSizes = product.trackVariantStock && hasSizes
    ? matrix.cols
    : (product.sizes || []);

  return {
    ...EMPTY_WIZARD_FORM,
    ...product,
    shopId:  product.shopId?._id || product.shopId || fallbackShopId || '',
    images:  product.images?.length ? product.images : (product.image ? [product.image] : []),
    sizes:   matrixSizes,
    colors:  matrixColors,
    hasVariants: !!product.trackVariantStock,
    variantAxis: hasColors && hasSizes ? 'both' : hasSizes ? 'size' : 'color',
    // A saved variant product already reconciles, so seed the cross-check with
    // its own total rather than leaving it blank and firing a false warning.
    totalReceived: product.trackVariantStock ? String(product.stock ?? '') : '',
    gstRate:  product.gstRate  == null ? '' : product.gstRate,
    expiryDate: product.expiryDate ? String(product.expiryDate).slice(0, 10) : '',
    discountType:  product.discountType  || 'none',
    discountValue: product.discountValue ?? '',
    profitPercent: product.profitPercent ?? '',
  };
}

export function useProductWizard({ form, setForm, shopId, productId, gstMode = 'exclusive' }) {
  // ── Matrix ────────────────────────────────────────────────────────────────
  const [matrix, setMatrix] = useState(() => fromVariantStock(form.variantStock));

  // Rebuild the grid whenever the axes change, carrying surviving cells across
  // so adding a size never wipes the columns already filled in.
  const axisKey = `${form.variantAxis}|${form.colors.map((c) => c.name).join(',')}|${form.sizes.join(',')}`;
  const lastAxisKey = useRef(axisKey);
  useEffect(() => {
    if (lastAxisKey.current === axisKey) return;
    lastAxisKey.current = axisKey;
    setMatrix((prev) => buildMatrix({
      colors: form.variantAxis === 'size'  ? [] : form.colors,
      sizes:  form.variantAxis === 'color' ? [] : form.sizes,
      existing: prev.cells,
    }));
  }, [axisKey, form.variantAxis, form.colors, form.sizes]);

  const totals = useMemo(() => matrixTotals(matrix), [matrix]);

  // ── Field updates ─────────────────────────────────────────────────────────
  const upd = useCallback((key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };

      // Two-way price <-> profit. Each branch writes only the OTHER field.
      if (key === 'profitPercent') {
        next.price = sellingPriceFromMarkup(f.costPrice, value);
      } else if (key === 'price') {
        next.profitPercent = markupFromSellingPrice(f.costPrice, value);
      } else if (key === 'costPrice') {
        // Cost moved: keep the markup the user asked for and re-derive the price,
        // because "30% profit" is the intent they expressed, not the ₹ figure.
        if (f.profitPercent !== '' && f.profitPercent !== null) {
          next.price = sellingPriceFromMarkup(value, f.profitPercent);
        } else if (f.price !== '') {
          next.profitPercent = markupFromSellingPrice(value, f.price);
        }
      }
      return next;
    });
  }, [setForm]);

  // ── Pricing ───────────────────────────────────────────────────────────────
  const pricing = useMemo(() => computeProductPricing({
    costPrice:     form.costPrice,
    price:         form.price,
    profitPercent: form.profitPercent,
    discountType:  form.discountType,
    discountValue: form.discountValue,
    gstRate:       form.gstRate,
    gstMode,
  }), [form.costPrice, form.price, form.profitPercent, form.discountType,
       form.discountValue, form.gstRate, gstMode]);

  /**
   * Per-cell pricing, with each null field inheriting the product level — the
   * same `??` fallback the server uses at sale time. The review step totals
   * these rather than multiplying one price by the grand total, which would be
   * wrong the moment any variant is priced differently.
   */
  const variantPricing = useMemo(() => {
    const rows = [];
    for (const color of matrix.rows) {
      for (const size of matrix.cols) {
        const cell = matrix.cells[cellKey(color, size)];
        if (!cell) continue;
        const inherits = !form.hasVariantPricing;
        const p = computeProductPricing({
          costPrice: inherits ? form.costPrice : (cell.costPrice ?? form.costPrice),
          price:     inherits ? form.price     : (cell.price     ?? form.price),
          discountType:  inherits ? form.discountType  : (cell.discountType  ?? form.discountType),
          discountValue: inherits ? form.discountValue : (cell.discountValue ?? form.discountValue),
          gstRate: form.gstRate,
          gstMode,
        });
        rows.push({ color, size, cell, pricing: p, stock: cell.stock });
      }
    }
    return rows;
  }, [matrix, form.hasVariantPricing, form.costPrice, form.price,
      form.discountType, form.discountValue, form.gstRate, gstMode]);

  /** Money roll-up for the review step. */
  const summary = useMemo(() => {
    if (!form.hasVariants) {
      const units = Number(form.stock) || 0;
      return {
        units,
        costValue:       +(units * pricing.costPrice).toFixed(2),
        expectedRevenue: +(units * pricing.finalPrice).toFixed(2),
        expectedProfit:  +(units * pricing.profitAmount).toFixed(2),
        discountGiven:   +(units * pricing.discountAmount).toFixed(2),
        taxEstimate:     +(units * pricing.taxAmount).toFixed(2),
      };
    }
    const acc = { units: 0, costValue: 0, expectedRevenue: 0, expectedProfit: 0, discountGiven: 0, taxEstimate: 0 };
    for (const r of variantPricing) {
      acc.units           += r.stock;
      acc.costValue       += r.stock * r.pricing.costPrice;
      acc.expectedRevenue += r.stock * r.pricing.finalPrice;
      acc.expectedProfit  += r.stock * r.pricing.profitAmount;
      acc.discountGiven   += r.stock * r.pricing.discountAmount;
      acc.taxEstimate     += r.stock * r.pricing.taxAmount;
    }
    for (const k of Object.keys(acc)) acc[k] = +acc[k].toFixed(2);
    return acc;
  }, [form.hasVariants, form.stock, pricing, variantPricing]);

  // ── Validation ────────────────────────────────────────────────────────────
  // Flat map of field -> message. Inline only; nothing here opens a modal.
  const errors = useMemo(() => {
    const e = {};
    if (!form.name?.trim())     e.name     = 'Product name is required';
    if (!form.category?.trim()) e.category = 'Category is required';
    if (!form.shopId)           e.shopId   = 'Select which shop this belongs to';

    if (form.hasVariants) {
      const needsColor = form.variantAxis !== 'size';
      const needsSize  = form.variantAxis !== 'color';
      if (needsColor && form.colors.length === 0) e.colors = 'Add at least one color';
      if (needsSize  && form.sizes.length  === 0) e.sizes  = 'Add at least one size';
      if (Object.keys(matrix.cells).length > 0 && totals.grandTotal === 0) {
        e.matrix = 'Enter quantities — the matrix total is 0';
      }
    } else if (form.stock !== '' && Number(form.stock) < 0) {
      e.stock = 'Stock cannot be negative';
    }

    if (form.costPrice === '' || Number.isNaN(Number(form.costPrice))) {
      e.costPrice = 'Cost price is required';
    } else if (Number(form.costPrice) < 0) {
      e.costPrice = 'Cost price cannot be negative';
    }
    if (form.price === '' || Number.isNaN(Number(form.price))) {
      e.price = 'Selling price is required';
    } else if (Number(form.price) < 0) {
      e.price = 'Selling price cannot be negative';
    }
    if (form.discountType === 'fixed' && Number(form.discountValue) > Number(form.price || 0)) {
      e.discountValue = 'Discount cannot exceed the selling price';
    }
    if (form.discountType === 'percent' && Number(form.discountValue) > 100) {
      e.discountValue = 'Percentage discount cannot exceed 100';
    }
    return e;
  }, [form, matrix.cells, totals.grandTotal]);

  const FIELDS_BY_STEP = {
    1: ['name', 'category', 'shopId'],
    2: ['colors', 'sizes', 'matrix'],
    3: ['costPrice', 'price', 'discountValue'],
    4: [],
    5: [],
  };

  const stepErrors = useMemo(() => {
    const out = {};
    for (const [step, fields] of Object.entries(FIELDS_BY_STEP)) {
      out[step] = fields.filter((f) => errors[f]).length;
    }
    return out;
  }, [errors]);

  const canAdvance = useCallback((step) => (stepErrors[step] || 0) === 0, [stepErrors]);

  /** First blocking message for a step, shown above the sticky footer. */
  const blockingReason = useCallback((step) => {
    const field = (FIELDS_BY_STEP[step] || []).find((f) => errors[f]);
    return field ? errors[field] : null;
  }, [errors]);

  // A warning, deliberately separate from `errors` — it must never block Next.
  const receivedMismatch = useMemo(() => {
    if (!form.hasVariants) return null;
    const received = Number(form.totalReceived);
    if (!received || received === totals.grandTotal) return null;
    return { received, matrixTotal: totals.grandTotal, diff: totals.grandTotal - received };
  }, [form.hasVariants, form.totalReceived, totals.grandTotal]);

  // ── Draft autosave ────────────────────────────────────────────────────────
  // Survives an accidental modal close or a refresh, not just step navigation.
  const draftKey = `${DRAFT_PREFIX}_${shopId || 'none'}_${productId || 'new'}`;
  const draftTimer = useRef(null);
  const hydratedDraft = useRef(false);

  useEffect(() => {
    if (hydratedDraft.current) return;
    hydratedDraft.current = true;
    // Only restore for a NEW product: an edit must always start from the saved
    // document, or a stale draft would silently resurrect old values.
    if (productId) return;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.form) setForm((f) => ({ ...f, ...saved.form }));
      if (saved?.matrix) setMatrix(saved.matrix);
    } catch {
      // A corrupt draft is not worth blocking the wizard over.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, productId]);

  useEffect(() => {
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({ form, matrix }));
      } catch {
        // Quota or private mode — autosave is a convenience, never a hard fail.
      }
    }, 400);
    return () => clearTimeout(draftTimer.current);
  }, [draftKey, form, matrix]);

  const clearDraft = useCallback(() => {
    try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ }
  }, [draftKey]);

  // ── Payload ───────────────────────────────────────────────────────────────
  /**
   * The exact object POSTed/PUT to /products. The server re-derives stock,
   * discount and profitPercent, but sending them keeps the request
   * self-describing and matches what the user was shown on the review step.
   */
  const toPayload = useCallback(() => {
    const {
      hasVariants, variantAxis, totalReceived, // wizard-only, never persisted
      ...rest
    } = form;

    const base = {
      ...rest,
      name:     form.name.trim(),
      brand:    (form.brand || '').trim(),
      category: form.category.trim(),
      gstRate:  form.gstRate === '' || form.gstRate === null ? null : Number(form.gstRate),
      costPrice: Number(form.costPrice) || 0,
      price:     Number(form.price)     || 0,
      discountValue: Number(form.discountValue) || 0,
      discount:  pricing.discountPercent,
      profitPercent: form.profitPercent === '' ? null : Number(form.profitPercent),
      hasVariantPricing: hasVariants ? !!form.hasVariantPricing : false,
      expiryDate: form.expiryDate || undefined,
    };

    if (!hasVariants) {
      return {
        ...base,
        trackVariantStock: false,
        variantStock: [],
        stock: Number(form.stock) || 0,
      };
    }

    return {
      ...base,
      trackVariantStock: true,
      variantStock: toVariantStock(matrix),
      // Server recomputes this from the matrix anyway; sending the same figure
      // keeps request and review screen consistent.
      stock: totals.grandTotal,
    };
  }, [form, matrix, totals.grandTotal, pricing.discountPercent]);

  return {
    matrix, setMatrix, totals,
    upd, pricing, variantPricing, summary,
    errors, stepErrors, canAdvance, blockingReason, receivedMismatch,
    toPayload, clearDraft,
  };
}
