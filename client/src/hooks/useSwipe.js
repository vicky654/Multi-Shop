import { useRef, useCallback } from 'react';

/**
 * useSwipe — lightweight touch swipe detector.
 *
 * Usage:
 *   const handlers = useSwipe({ onSwipeDown: refetch });
 *   <div {...handlers}>…</div>
 *
 * onSwipeDown fires only when the user swipes down from the top of the
 * scrollable container (scrollTop === 0), simulating pull-to-refresh.
 */
export function useSwipe({ onSwipeDown, onSwipeUp, threshold = 72 } = {}) {
  const start = useRef(null);

  const onTouchStart = useCallback((e) => {
    start.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(
    (e) => {
      if (start.current === null) return;
      const delta = e.changedTouches[0].clientY - start.current;
      const el    = e.currentTarget;
      const atTop = !el || el.scrollTop <= 0;

      if (delta > threshold && atTop) onSwipeDown?.();
      if (delta < -threshold)        onSwipeUp?.();

      start.current = null;
    },
    [onSwipeDown, onSwipeUp, threshold],
  );

  return { onTouchStart, onTouchEnd };
}
