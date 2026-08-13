/**
 * Shared pacing helpers for the guide recordings.
 *
 * A guide recorded at normal Cypress speed is unwatchable — the whole workflow
 * flashes past in two seconds. These helpers add deliberate pauses and an
 * on-screen caption so the recording reads as a walkthrough.
 *
 * The pauses exist ONLY in the guide specs. The normal e2e suite must stay fast,
 * which is why these are not in support/commands.js.
 */

/** Pause for the configured pace (default 700ms). */
export const beat = (multiplier = 1) => cy.wait(Cypress.env('guidePace') * multiplier);

/**
 * Overlay a caption on the running app, so the recording explains itself without
 * needing a voice-over.
 *
 * Injected into the real page rather than faked in a separate harness — the app
 * underneath is genuinely the product, and the caption is a positioned div on top
 * that is removed when the next one appears.
 */
export function caption(text, { hold = 1.6 } = {}) {
  cy.task('log', text);
  cy.document().then((doc) => {
    const existing = doc.getElementById('ms-guide-caption');
    if (existing) existing.remove();

    const el = doc.createElement('div');
    el.id = 'ms-guide-caption';
    el.textContent = text;
    el.setAttribute('style', [
      'position:fixed', 'left:50%', 'bottom:28px', 'transform:translateX(-50%)',
      'z-index:2147483647', 'max-width:min(880px,92vw)',
      'background:rgba(15,23,42,0.94)', 'color:#fff',
      'font:600 15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
      'padding:12px 20px', 'border-radius:12px', 'text-align:center',
      'box-shadow:0 10px 30px rgba(0,0,0,0.35)',
      'pointer-events:none',   // must never intercept a click the spec makes
    ].join(';'));
    doc.body.appendChild(el);
  });
  beat(hold);
}

/** Remove the caption — call before an assertion that screenshots the page. */
export function clearCaption() {
  cy.document().then((doc) => {
    doc.getElementById('ms-guide-caption')?.remove();
  });
}
