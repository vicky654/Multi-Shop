import { useState, useCallback } from 'react';

const STORAGE_KEY = 'multishop_has_seen_tour_v1';

export const TOUR_STEPS = [
  {
    target:  '[data-tour="nav-inventory"]',
    title:   '📦 Products & Inventory',
    content: 'Add and manage your products here. Set prices, stock levels, and variants. Bulk import via CSV in seconds.',
  },
  {
    target:  '[data-tour="nav-billing"]',
    title:   '🛍️ POS Billing',
    content: 'Create bills quickly and easily. Select products, apply discounts, accept payments, and print receipts.',
  },
  {
    target:  '[data-tour="nav-ai"]',
    title:   '⚡ AI Insights',
    content: 'Get smart suggestions to grow your business — top sellers, restock alerts, and profit tips powered by AI.',
  },
  {
    target:  '[data-tour="nav-reports"]',
    title:   '📊 Reports',
    content: 'Track your daily sales, profit margins, and payment breakdowns at a glance. Export or share via WhatsApp.',
  },
];

export function useTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [step,   setStep]   = useState(-1); // -1 = welcome modal

  const hasSeenTour = useCallback(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
    []
  );

  const startTour = useCallback(() => {
    setStep(-1);
    setIsOpen(true);
  }, []);

  const beginSteps = useCallback(() => setStep(0), []);

  const nextStep = useCallback(() => {
    setStep((s) => {
      if (s >= TOUR_STEPS.length - 1) {
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsOpen(false);
        return -1;
      }
      return s + 1;
    });
  }, []);

  const prevStep = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  const skipTour = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
    setStep(-1);
  }, []);

  return { isOpen, step, hasSeenTour, startTour, beginSteps, nextStep, prevStep, skipTour };
}
