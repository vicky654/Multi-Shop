/**
 * MobileLayout — adds app-like page transition animations and
 * mobile UX polish to any page component.
 *
 * Usage in routes or page-level wrappers:
 *   <MobileLayout>
 *     <PageComponent />
 *   </MobileLayout>
 *
 * Or use the higher-order helper for lazy routes:
 *   withMobileLayout(PageComponent)
 */
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const variants = {
  initial:  { opacity: 0, y: 10 },
  animate:  { opacity: 1, y: 0  },
  exit:     { opacity: 0, y: -6 },
};

const transition = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] };

export default function MobileLayout({ children }) {
  const { pathname } = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition}
        className="min-h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// HOC variant — wrap a lazy-loaded page component
export function withMobileLayout(Component) {
  return function WrappedPage(props) {
    return (
      <MobileLayout>
        <Component {...props} />
      </MobileLayout>
    );
  };
}

// ── Global mobile UX helpers (CSS-in-JS utilities) ────────────────────────────
// Import these class strings in components for consistent touch feedback.
export const mobileBtn = [
  'min-h-[48px] active:scale-95 transition-transform touch-manipulation',
  'select-none cursor-pointer',
].join(' ');

export const mobileCard = [
  'rounded-2xl bg-white shadow-sm border border-gray-100',
  'active:shadow-none transition-shadow touch-manipulation',
].join(' ');
