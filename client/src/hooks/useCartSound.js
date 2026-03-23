import { useCallback } from 'react';

/**
 * Generates a short beep using the Web Audio API — no external library needed.
 * Falls back silently in environments that don't support AudioContext.
 */
export function useCartSound() {
  const beep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx  = new AudioCtx();
      const gain = ctx.createGain();
      const osc  = ctx.createOscillator();

      osc.type            = 'sine';
      osc.frequency.value = 880; // A5 — bright, snappy

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);

      osc.onended = () => ctx.close();
    } catch {
      // Ignore — audio is non-critical
    }
  }, []);

  return beep;
}
