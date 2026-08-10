import { useEffect } from 'react';

export function useKeyboardShortcuts(actions) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. F1 = Focus Product Search
      if (e.key === 'F1') {
        e.preventDefault();
        actions.onSearchProduct?.();
      }
      // 2. F2 = Focus Customer Search
      else if (e.key === 'F2') {
        e.preventDefault();
        actions.onSearchCustomer?.();
      }
      // 3. F3 = Apply Discount Toggle / Focus Item Discount
      else if (e.key === 'F3') {
        e.preventDefault();
        actions.onApplyDiscount?.();
      }
      // 4. F4 = Select Cash Payment
      else if (e.key === 'F4') {
        e.preventDefault();
        actions.onSelectCash?.();
      }
      // 5. F5 = Select Card Payment
      else if (e.key === 'F5') {
        e.preventDefault();
        actions.onSelectCard?.();
      }
      // 6. F6 = Select UPI Payment
      else if (e.key === 'F6') {
        e.preventDefault();
        actions.onSelectUpi?.();
      }
      // 7. F7 = Select Credit Payment
      else if (e.key === 'F7') {
        e.preventDefault();
        actions.onSelectCredit?.();
      }
      // 8. F8 = Select UPI QR (scan-to-pay)
      else if (e.key === 'F8') {
        e.preventDefault();
        actions.onSelectUpiQr?.();
      }
      // 9. Ctrl + Enter = Complete Bill
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        actions.onCheckout?.();
      }
      // 9. Ctrl + D = Delete Selected Row
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        actions.onDeleteItem?.();
      }
      // 10. Ctrl + P = Print Invoice
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        actions.onPrintInvoice?.();
      }
      // 11. Esc = Cancel / Reset Bill
      else if (e.key === 'Escape') {
        e.preventDefault();
        actions.onCancelBill?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
