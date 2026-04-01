import { useEffect, useRef } from 'react';

/**
 * useBarcodeScanner — detects USB/Bluetooth barcode scanner input.
 *
 * Scanners act as a HID keyboard: they emit characters very rapidly
 * (< CHAR_GAP_MS apart) and finish with an Enter keypress.
 * Normal keyboard typing is much slower, so we can tell the difference.
 *
 * Usage:
 *   useBarcodeScanner((code) => handleBarcode(code));
 *
 * The callback receives the scanned string (barcode or QR text).
 * The hook ignores events when a text input/textarea is focused so it
 * doesn't interfere with the product search box.
 */
export function useBarcodeScanner(onScan) {
  const bufferRef     = useRef('');
  const lastTimeRef   = useRef(0);
  const onScanRef     = useRef(onScan);

  // Keep callback ref fresh without adding it to the effect dep array
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    const CHAR_GAP_MS   = 50;   // max ms between chars from a scanner
    const MIN_LENGTH    = 3;    // ignore single/double char "scans"

    const onKeyDown = (e) => {
      // Don't intercept while user is typing in an input / textarea
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const now = Date.now();
      const gap = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        if (code.length >= MIN_LENGTH) {
          e.preventDefault();
          onScanRef.current?.(code);
        }
        return;
      }

      // If the gap is too large, start a fresh buffer (user typed slowly)
      if (gap > CHAR_GAP_MS * 3 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
