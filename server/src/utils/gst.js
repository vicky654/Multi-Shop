/**
 * GST engine — deterministic, server-side Indian tax computation.
 *
 * WHY THIS EXISTS
 *   Billing previously applied a single flat `taxRate` and computed totals in the
 *   browser. That cannot produce a compliant invoice: it has no GSTIN, no
 *   CGST/SGST vs IGST split, no inclusive-pricing support and no round-off.
 *
 * DESIGN RULES
 *   1. All arithmetic is in INTEGER PAISE. Floating-point rupees drift (0.1 + 0.2)
 *      and tax lines must reconcile to the last paisa.
 *   2. Rounding happens once per line (half-up), then once at invoice level for
 *      the statutory round-off. Never re-round an already-rounded figure.
 *   3. The function is pure: same inputs → same outputs. No clock, no randomness,
 *      no DB. That is what makes it testable and auditable.
 *
 * SCOPE / LIMITS — read before relying on this for filing:
 *   - Implements the common intra-state (CGST+SGST) and inter-state (IGST) split
 *     for goods, driven by place of supply.
 *   - Does NOT implement: cess, reverse charge, composition scheme, e-invoicing
 *     (IRN/QR), e-way bills, TCS/TDS, SEZ or export/LUT handling.
 *   - Correct GST treatment depends on your registration and jurisdiction. Have a
 *     CA validate the configuration before filing against these invoices.
 */

// ── Money helpers (integer paise) ────────────────────────────────────────────
const toPaise   = (rupees) => Math.round(Number(rupees) * 100);
const toRupees  = (paise)  => +(paise / 100).toFixed(2);
/** Half-up rounding, applied to a paise value scaled by `scale`. */
const roundPaise = (v) => Math.round(v);

// ── GSTIN ────────────────────────────────────────────────────────────────────
const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 2-digit state code + 10-char PAN + entity digit + 'Z' + checksum. */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Verify the GSTIN check digit (mod-36 weighted scheme used by GSTN).
 * Format alone is not enough — a typo usually still matches the regex, and an
 * invalid GSTIN on an invoice is a compliance problem, so the checksum is
 * validated too.
 */
function gstinChecksumValid(gstin) {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const value  = GSTIN_CHARSET.indexOf(gstin[i]);
    if (value < 0) return false;
    const factor = i % 2 === 0 ? 1 : 2;
    let product  = value * factor;
    product = Math.floor(product / 36) + (product % 36);
    sum += product;
  }
  const expected = GSTIN_CHARSET[(36 - (sum % 36)) % 36];
  return expected === gstin[14];
}

const isValidGstin = (gstin) => {
  if (typeof gstin !== 'string') return false;
  const g = gstin.trim().toUpperCase();
  return GSTIN_REGEX.test(g) && gstinChecksumValid(g);
};

/** The first two digits of a GSTIN are the state code. */
const stateCodeOf = (gstin) =>
  isValidGstin(gstin) ? gstin.trim().slice(0, 2) : null;

// State codes as published by GSTN. Used to resolve place of supply when the
// shop stores a state name rather than a code.
const STATE_CODES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', 10: 'Bihar', 11: 'Sikkim',
  12: 'Arunachal Pradesh', 13: 'Nagaland', 14: 'Manipur', 15: 'Mizoram',
  16: 'Tripura', 17: 'Meghalaya', 18: 'Assam', 19: 'West Bengal',
  20: 'Jharkhand', 21: 'Odisha', 22: 'Chhattisgarh', 23: 'Madhya Pradesh',
  24: 'Gujarat', 26: 'Dadra and Nagar Haveli and Daman and Diu',
  27: 'Maharashtra', 29: 'Karnataka', 30: 'Goa', 31: 'Lakshadweep',
  32: 'Kerala', 33: 'Tamil Nadu', 34: 'Puducherry', 35: 'Andaman and Nicobar Islands',
  36: 'Telangana', 37: 'Andhra Pradesh', 38: 'Ladakh', 97: 'Other Territory',
};

const stateNameOf = (code) => STATE_CODES[String(code).padStart(2, '0')] || null;

// ── Tax computation ──────────────────────────────────────────────────────────
/**
 * Compute one invoice, deterministically.
 *
 * @param {object}  input
 * @param {Array}   input.lines          [{ price, quantity, discountPct, taxRate, name, hsnCode }]
 * @param {string}  input.gstMode        'exclusive' (price excludes GST) | 'inclusive'
 * @param {string}  input.sellerStateCode 2-digit code of the shop's GSTIN/state
 * @param {string}  [input.placeOfSupplyCode] defaults to sellerStateCode (walk-in)
 * @param {boolean} [input.roundOff=true] apply statutory invoice round-off
 *
 * @returns {object} breakdown with every figure in RUPEES (2dp), plus per-line detail
 */
function computeInvoice({
  lines = [],
  gstMode = 'exclusive',
  sellerStateCode,
  placeOfSupplyCode,
  roundOff = true,
} = {}) {
  if (!['exclusive', 'inclusive'].includes(gstMode)) {
    throw Object.assign(new Error(`Invalid gstMode "${gstMode}"`), { status: 400 });
  }

  const pos = placeOfSupplyCode || sellerStateCode || null;
  // Inter-state supply attracts IGST; intra-state splits into CGST + SGST.
  // With no seller state configured we cannot decide, so we fall back to
  // intra-state and flag it — the caller surfaces this as a config warning
  // rather than silently issuing a possibly-wrong invoice.
  const stateKnown = !!(sellerStateCode && pos);
  const interState = stateKnown && sellerStateCode !== pos;

  let grossP = 0, discountP = 0, taxableP = 0, cgstP = 0, sgstP = 0, igstP = 0;
  const detail = [];

  for (const raw of lines) {
    const qty   = Number(raw.quantity) || 0;
    const rate  = Math.max(0, Number(raw.taxRate) || 0);
    const disc  = Math.min(100, Math.max(0, Number(raw.discountPct) || 0));
    const unitP = toPaise(raw.price);

    // Line gross before tax treatment
    const lineGrossP = roundPaise(unitP * qty);
    const lineDiscP  = roundPaise((lineGrossP * disc) / 100);
    const afterDiscP = lineGrossP - lineDiscP;

    // Exclusive: the discounted amount IS the taxable value, tax is added.
    // Inclusive: the discounted amount ALREADY contains tax, so back it out.
    let lineTaxableP, lineTaxP;
    if (gstMode === 'inclusive') {
      lineTaxableP = roundPaise((afterDiscP * 10000) / (10000 + rate * 100));
      lineTaxP     = afterDiscP - lineTaxableP;
    } else {
      lineTaxableP = afterDiscP;
      lineTaxP     = roundPaise((lineTaxableP * rate) / 100);
    }

    // Split the line's tax. Halving CGST/SGST can leave an odd paisa: give it to
    // SGST so cgst + sgst always equals the line tax exactly.
    let lineCgstP = 0, lineSgstP = 0, lineIgstP = 0;
    if (interState) {
      lineIgstP = lineTaxP;
    } else {
      lineCgstP = Math.floor(lineTaxP / 2);
      lineSgstP = lineTaxP - lineCgstP;
    }

    grossP    += lineGrossP;
    discountP += lineDiscP;
    taxableP  += lineTaxableP;
    cgstP     += lineCgstP;
    sgstP     += lineSgstP;
    igstP     += lineIgstP;

    detail.push({
      name:     raw.name || '',
      hsnCode:  raw.hsnCode || '',
      quantity: qty,
      taxRate:  rate,
      unitPrice:     toRupees(unitP),
      grossAmount:   toRupees(lineGrossP),
      discountAmount: toRupees(lineDiscP),
      taxableAmount: toRupees(lineTaxableP),
      cgstAmount:    toRupees(lineCgstP),
      sgstAmount:    toRupees(lineSgstP),
      igstAmount:    toRupees(lineIgstP),
      lineTotal:     toRupees(lineTaxableP + lineCgstP + lineSgstP + lineIgstP),
    });
  }

  const totalTaxP  = cgstP + sgstP + igstP;
  const preRoundP  = taxableP + totalTaxP;

  // Statutory round-off to the nearest rupee, recorded separately so the invoice
  // reconciles: taxable + tax + roundOff = grandTotal.
  const roundedP   = roundOff ? Math.round(preRoundP / 100) * 100 : preRoundP;
  const roundOffP  = roundedP - preRoundP;

  return {
    gstMode,
    interState,
    stateKnown,
    sellerStateCode: sellerStateCode || null,
    placeOfSupplyCode: pos,
    placeOfSupply: stateNameOf(pos),

    grossAmount:    toRupees(grossP),
    discountAmount: toRupees(discountP),
    taxableAmount:  toRupees(taxableP),
    cgstAmount:     toRupees(cgstP),
    sgstAmount:     toRupees(sgstP),
    igstAmount:     toRupees(igstP),
    totalTax:       toRupees(totalTaxP),
    roundOff:       toRupees(roundOffP),
    grandTotal:     toRupees(roundedP),

    lines: detail,
  };
}

module.exports = {
  isValidGstin,
  gstinChecksumValid,
  stateCodeOf,
  stateNameOf,
  STATE_CODES,
  computeInvoice,
  toPaise,
  toRupees,
  GSTIN_REGEX,
};
