/**
 * Print pipeline for the invoice receipt.
 *
 * WHY A SEPARATE STYLESHEET
 *   The on-screen receipt is styled with Tailwind utility classes, and a popup
 *   window has none of that CSS. Printing the innerHTML alone therefore produced
 *   an unstyled wall of text. Rather than trying to inline Tailwind, the receipt
 *   markup carries semantic `data-print` hooks and plain class names, and this
 *   stylesheet renders them properly on paper.
 *
 *   Kept out of the component so the markup stays readable, and so both the A4
 *   and 80mm thermal layouts live in one place.
 */

// 80mm thermal rolls are what a shop counter actually prints on; A4 is for
// emailed / filed copies. Same markup, different page geometry.
const PAGE_STYLES = {
  a4: `
    @page { size: A4; margin: 14mm; }
    body { width: auto; font-size: 12px; }
    .r-name { font-size: 24px; }
    .r-wrap { max-width: 190mm; }
  `,
  thermal: `
    @page { size: 80mm auto; margin: 3mm; }
    body { width: 74mm; font-size: 11px; }
    .r-name { font-size: 15px; }
    .r-wrap { max-width: 74mm; }
    .r-meta { grid-template-columns: 1fr !important; gap: 2px !important; }
    .r-tax-cols { grid-template-columns: 1fr !important; }
    /* A roll is too narrow for a 6-column grid, so drop the low-value columns
       and let the product line wrap instead of overflowing off the paper. */
    .r-col-hide { display: none !important; }
    .r-totals { width: 100% !important; }
  `,
};

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #111827;
    -webkit-font-smoothing: antialiased;
  }
  .r-wrap { margin: 0 auto; }

  /* Money and quantities must line up column-wise or the eye cannot scan them. */
  .r-num { font-variant-numeric: tabular-nums; }

  .r-center { text-align: center; }
  .r-right  { text-align: right; }
  .r-muted  { color: #6b7280; }
  .r-small  { font-size: 0.85em; }
  .r-tiny   { font-size: 0.75em; }
  .r-bold   { font-weight: 700; }
  .r-caps   { text-transform: uppercase; letter-spacing: 0.08em; }

  .r-name { font-weight: 800; letter-spacing: -0.01em; line-height: 1.15; }
  .r-logo { max-height: 46px; margin: 0 auto 6px; display: block; object-fit: contain; }

  /* The dashed rule is the visual signature of a till receipt. */
  .r-rule   { border: none; border-top: 1px dashed #9ca3af; margin: 8px 0; }
  .r-rule-solid { border: none; border-top: 1px solid #111827; margin: 6px 0; }

  .r-title {
    display: inline-block; padding: 2px 10px; margin: 6px 0 2px;
    border: 1px solid #111827; border-radius: 2px;
    font-size: 0.8em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
  }

  .r-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin: 8px 0; }
  .r-meta div { font-size: 0.85em; }
  .r-meta span.k { color: #6b7280; }
  .r-meta span.v { font-weight: 600; }

  table.r-items { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.r-items th {
    text-align: left; padding: 4px 4px; font-size: 0.72em;
    text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280;
    border-bottom: 1px solid #d1d5db;
  }
  table.r-items td { padding: 5px 4px; vertical-align: top; font-size: 0.9em; }
  table.r-items tbody tr { border-bottom: 1px dotted #e5e7eb; }
  .r-prod { font-weight: 600; }
  .r-prod-meta { font-size: 0.78em; color: #6b7280; margin-top: 1px; }

  .r-totals { width: 62%; margin-left: auto; margin-top: 8px; }
  .r-totals .row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 0.9em; }
  .r-totals .grand {
    display: flex; justify-content: space-between; align-items: baseline;
    font-weight: 800; font-size: 1.15em;
    border-top: 2px solid #111827; border-bottom: 2px solid #111827;
    padding: 5px 0; margin-top: 4px;
  }

  .r-saved {
    margin: 8px 0; padding: 5px 8px; text-align: center;
    border: 1px dashed #15803d; border-radius: 3px;
    color: #15803d; font-weight: 700; font-size: 0.9em;
  }

  .r-box { margin-top: 8px; padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 3px; }
  .r-foot { margin-top: 12px; text-align: center; font-size: 0.78em; color: #6b7280; line-height: 1.5; }

  /* Screen-only affordances must never reach paper. */
  [data-print="hide"] { display: none !important; }
`;

/**
 * Open a print window for the given receipt markup.
 *
 * @param {string} html      innerHTML of the receipt node
 * @param {string} title     window/document title (becomes the PDF filename)
 * @param {'a4'|'thermal'} layout
 */
export function printReceipt(html, title, layout = 'a4') {
  const win = window.open('', '_blank', 'width=860,height=960');
  if (!win) {
    // Popup blockers are common; the caller surfaces this to the user rather
    // than silently doing nothing.
    return false;
  }

  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8" />`
    + `<title>${title}</title>`
    + `<style>${BASE_CSS}${PAGE_STYLES[layout] || PAGE_STYLES.a4}</style>`
    + `</head><body><div class="r-wrap">${html}</div></body></html>`
  );
  win.document.close();

  // Give the popup a tick to lay out (and decode the logo) before printing,
  // otherwise Chrome can print a blank or half-rendered first page.
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);

  return true;
}

export const PRINT_LAYOUTS = [
  { value: 'a4',      label: 'A4 / PDF' },
  { value: 'thermal', label: '80mm Roll' },
];
