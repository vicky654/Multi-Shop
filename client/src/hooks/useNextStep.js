/**
 * useNextStep — computes the next onboarding action based on real data flags.
 *
 * Returns:
 *   nextRoute  — path to navigate to
 *   nextLabel  — short action label (e.g. "Add your first product")
 *   nextDesc   — one-line context (e.g. "You have products but no customers yet")
 *   nextSection — sidebar section key (e.g. 'inventory')
 *   isAllDone  — true when all 4 steps complete
 *   steps      — raw { shop, product, customer, sale } booleans
 *   go()       — navigate to nextRoute (requires this hook to be called in a component)
 */
import { useNavigate } from 'react-router-dom';
import useShopStore  from '../store/shopStore';
import useSetupStore from '../store/setupStore';

export function useNextStep() {
  const navigate       = useNavigate();
  const { activeShop } = useShopStore();
  const getProgress    = useSetupStore((s) => s.getProgress);
  const { steps, isComplete } = getProgress(activeShop);

  let nextRoute   = '/dashboard';
  let nextLabel   = 'All done!';
  let nextDesc    = 'Your shop is fully set up.';
  let nextSection = 'dashboard';

  if (!steps.shop) {
    nextRoute   = '/settings';
    nextLabel   = 'Create your first shop';
    nextDesc    = 'Start here — give your shop a name, currency, and address.';
    nextSection = 'settings';
  } else if (!steps.product) {
    nextRoute   = '/inventory';
    nextLabel   = 'Add your first product';
    nextDesc    = 'Your shop is ready. Now add products to sell.';
    nextSection = 'inventory';
  } else if (!steps.customer) {
    nextRoute   = '/customers';
    nextLabel   = 'Add a customer';
    nextDesc    = 'You have products. Add a customer to make your first sale.';
    nextSection = 'customers';
  } else if (!steps.sale) {
    nextRoute   = '/billing';
    nextLabel   = 'Make your first sale';
    nextDesc    = 'Everything is set — head to Billing to create a transaction.';
    nextSection = 'billing';
  }

  return {
    nextRoute,
    nextLabel,
    nextDesc,
    nextSection,
    isAllDone: isComplete,
    steps,
    go: () => navigate(nextRoute),
  };
}

/**
 * Standalone (non-hook) version for use outside React components,
 * e.g. inside Zustand actions or utility functions.
 *
 * Usage:
 *   import { getNextStep } from '../hooks/useNextStep';
 *   const { nextRoute } = getNextStep(activeShop, setupState);
 */
export function getNextStep(activeShop, { hasProducts, hasCustomers, hasSales }) {
  if (!activeShop)     return { nextRoute: '/settings',  nextSection: 'settings'  };
  if (!hasProducts)    return { nextRoute: '/inventory', nextSection: 'inventory' };
  if (!hasCustomers)   return { nextRoute: '/customers', nextSection: 'customers' };
  if (!hasSales)       return { nextRoute: '/billing',   nextSection: 'billing'   };
  return               { nextRoute: '/reports',   nextSection: 'reports'   };
}
