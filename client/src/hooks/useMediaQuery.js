import { useState, useEffect } from 'react';

/**
 * useMediaQuery — subscribe to a CSS media query from JS.
 *
 * WHY NOT JUST `hidden lg:flex`
 *   Rendering a desktop tree and a mobile tree and hiding one with CSS puts BOTH
 *   in the DOM. That duplicates every `data-testid` (so `cy.get` matches two
 *   elements and the E2E specs break) and gives each copy its own component
 *   state, which silently desyncs across a resize. Branching in JS renders one
 *   tree, so neither happens.
 *
 * The initial value is read synchronously so the first paint is already correct —
 * no flash of the wrong layout.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false)
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    // Re-read on mount: the query can differ from the initial value if it changed
    // between render and effect (rotation, devtools resize).
    setMatches(mql.matches);

    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

// Mirrors Tailwind's `lg` breakpoint, which is what the layouts switch on.
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
