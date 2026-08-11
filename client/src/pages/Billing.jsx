import { useEffect, useCallback, useMemo, useState } from 'react';
import { ShoppingCart, Calendar, User } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Custom Hooks ─────────────────────────────────────────────────────────────
import { useCart } from '../hooks/useCart';
import { usePayment } from '../hooks/usePayment';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useBilling } from '../hooks/useBilling';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useHeldBills } from '../hooks/useHeldBills';
import { usePermissions } from '../hooks/usePermissions';
import useShopStore from '../store/shopStore';
import useAuthStore from '../store/authStore';

// ── Components ───────────────────────────────────────────────────────────────
import ProductSearch from '../components/billing/ProductSearch';
import CustomerSection from '../components/billing/CustomerSection';
import CartTable from '../components/billing/CartTable';
import PaymentPanel from '../components/billing/PaymentPanel';
import TotalSummary from '../components/billing/TotalSummary';
import QuickActions from '../components/billing/QuickActions';
import BillingFooter from '../components/billing/BillingFooter';
import InvoiceModal from '../components/InvoiceModal';
import DailyClosingModal from '../components/billing/DailyClosingModal';
import UpiQrModal from '../components/billing/UpiQrModal';
import { isUpiReady } from '../utils/upi';

export default function Billing() {
  const { activeShop } = useShopStore();
  const currentUser = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const shopId = activeShop?._id;
  const shopTaxRate = activeShop?.taxRate || 0;

  // ── 1. Initialize Custom hooks ──
  const cartHook = useCart(shopTaxRate, activeShop?.invoiceRoundOff !== false);
  const {
    cart, discountMode, setDiscountMode, taxPreset, setTaxPreset,
    customTaxVal, setCustomTaxVal, taxRate, addToCart, incrementQty,
    decrementQty, updateQty, updatePrice, updateDiscount, removeFromCart,
    duplicateItem, clearCart, setCart, totals, taxAmount, grandTotal,
  } = cartHook;

  const paymentHook = usePayment();
  const {
    paymentMethod, receivedAmount, dueAmount, setPaymentMethod,
    setReceivedAmount, setDueAmount, validatePayment, resetPayment,
  } = paymentHook;

  const { isOnline, pendingCount, failedCount, checkoutPending, saveOffline } = useOfflineSync(shopId);

  const billingHook = useBilling(shopId, isOnline);
  const {
    search, setSearch, customerId, setCustomerId, customerSearch, setCustomerSearch,
    notes, setNotes, isPrivate, setIsPrivate, showInvoice, setShowInvoice,
    lastSale, setLastSale, showDailyClose, setShowDailyClose, showHeldBills,
    setShowHeldBills, products, customers, productsLoading, createSaleMut,
    createCustomerMut, customerTags, productTags, clearForm,
  } = billingHook;

  const { heldBills, holdBill, resumeBill, completeResume, deleteBill } = useHeldBills();
  const [selectedCartItemId, setSelectedCartItemId] = useState(null);

  // Pending UPI QR bill awaiting payment verification
  const [pendingUpiSale, setPendingUpiSale] = useState(null);
  const upiEnabled = isUpiReady(activeShop);

  // ── 2. Handle Checkout Flow ──
  const handleCheckout = useCallback(() => {
    if (!shopId) return toast.error('Select a shop first');
    if (!cart.length) return toast.error('Cart is empty');
    if (!can('billing', 'create')) return toast.error("You don't have permission to create sales");

    const isValid = validatePayment(grandTotal, customerId);
    if (!isValid) return;

    const normalizedItems = cart.map((item) => {
      let discPct = item.discount;
      if (discountMode === 'flat') {
        const rawTotal = item.price * item.quantity;
        discPct = rawTotal > 0 ? Math.min(100, (item.discount / rawTotal) * 100) : 0;
      }
      return {
        // Must be `productId` — both the POST /sales validator and
        // enrichItems() read item.productId. Sending `product` here made every
        // checkout fail validation with a 422.
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        discount: +discPct.toFixed(4),
        subtotal: item.price * item.quantity * (1 - discPct / 100),
        selectedSize:  item.selectedSize  || '',
        selectedColor: item.selectedColor || '',
      };
    });

    // 'upi_qr' is a client-side tender that maps to a UPI sale flagged for the
    // scan-to-pay flow — the server creates it as pending until verified.
    const isUpiQr = paymentMethod === 'upi_qr';

    if (isUpiQr && !upiEnabled) {
      return toast.error('UPI QR is not configured — set it up in Settings → Payments');
    }
    if (isUpiQr && !isOnline) {
      return toast.error('UPI QR needs a connection. Take cash or card while offline.');
    }

    const payload = {
      shopId,
      items: normalizedItems,
      customerId: customerId || undefined,
      paymentMethod: isUpiQr ? 'upi' : paymentMethod,
      ...(isUpiQr ? { upiQr: true } : {}),
      taxRate,
      notes,
      isPrivate,
      ...(paymentMethod === 'credit' && dueAmount ? { dueAmount: parseFloat(dueAmount) } : {}),
    };

    if (!isOnline) {
      saveOffline(payload, grandTotal)
        .then(() => {
          clearCart();
          resetPayment();
          clearForm();
          toast.success('Sale saved offline — will sync when connected', { icon: '📴' });
        })
        .catch(() => toast.error('Failed to save sale locally.'));
      return;
    }

    createSaleMut.mutate(payload, {
      onSuccess: (res) => {
        const sale = res.data.sale;

        // UPI QR: show the QR instead of a receipt. The cart is still cleared —
        // the bill exists server-side as pending and is settled from the modal
        // (or later from Orders), so the counter is free for the next customer.
        if (isUpiQr) {
          setPendingUpiSale(sale);
          setShowInvoice(false);
        } else {
          setLastSale(sale);
          setShowInvoice(true);
        }

        clearCart();
        resetPayment();
        clearForm();
      },
    });
  }, [
    shopId, cart, customerId, paymentMethod, taxRate, notes, isPrivate, dueAmount,
    grandTotal, discountMode, isOnline, can, validatePayment, saveOffline, upiEnabled,
    clearCart, resetPayment, clearForm, createSaleMut, setLastSale, setShowInvoice,
  ]);

  // ── 3. Hold and Resume ──
  // The snapshot captures the COMPLETE bill: line items with their prices,
  // quantities and discounts, the customer, tax selection, notes, private flag
  // and the in-progress payment state — plus the computed totals so the held
  // list can show an amount without recalculating.
  const handleHold = useCallback(() => {
    if (!cart.length) return toast.error('Cart is empty — nothing to hold');
    const label = customerSearch
      ? `${customerSearch.split(' — ')[0]}`
      : `Bill ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    holdBill(label, {
      cart,
      customerId,
      customerSearch,
      paymentMethod,
      receivedAmount,
      dueAmount,
      notes,
      isPrivate,
      discountMode,
      taxPreset,
      customTaxVal,
      // Snapshot of the money for display in the held-bills list
      taxRate,
      subtotal: totals.subtotal,
      discountTotal: totals.discount,
      taxAmount,
      grandTotal,
    });
    clearCart();
    clearForm();
    resetPayment();
    toast.success(`"${label}" held — cart cleared`);
  }, [
    cart, customerId, customerSearch, paymentMethod, receivedAmount, dueAmount,
    notes, isPrivate, discountMode, taxPreset, customTaxVal, taxRate, totals,
    taxAmount, grandTotal, holdBill, clearCart, clearForm, resetPayment,
  ]);

  const handleResume = useCallback((id) => {
    const bill = resumeBill(id);
    if (!bill) return toast.error('That held bill is no longer available');

    // Restore first, then drop the held copy — if anything above throws, the
    // bill is still parked rather than silently lost.
    setCart(bill.cart || []);
    setCustomerId(bill.customerId || '');
    setCustomerSearch(bill.customerSearch || '');
    setPaymentMethod(bill.paymentMethod || 'cash');
    setReceivedAmount(bill.receivedAmount || '');
    setDueAmount(bill.dueAmount || '');
    setNotes(bill.notes || '');
    setIsPrivate(!!bill.isPrivate);
    setDiscountMode(bill.discountMode || 'pct');
    setTaxPreset(bill.taxPreset ?? 'shop');
    setCustomTaxVal(bill.customTaxVal || '');

    completeResume(id);
    setShowHeldBills(false);
    toast.success(`"${bill.label}" resumed — ${bill.cart?.length || 0} item(s) restored`);
  }, [
    resumeBill, completeResume, setCart, setCustomerId, setCustomerSearch,
    setPaymentMethod, setReceivedAmount, setDueAmount, setNotes, setIsPrivate,
    setDiscountMode, setTaxPreset, setCustomTaxVal, setShowHeldBills,
  ]);

  // ── 4. Barcode Scanning ──
  const handleBarcode = useCallback((code) => {
    if (!shopId) return;
    const match = products.find((p) => p.barcode === code || p.sku === code);
    if (match) {
      addToCart(match);
      toast.success(`Scanned: ${match.name}`, { duration: 1500 });
    }
  }, [shopId, products, addToCart]);

  useBarcodeScanner(handleBarcode);

  // ── 5. Keyboard shortcuts mapping ──
  const keyboardActions = useMemo(() => ({
    onSearchProduct: () => document.getElementById('product-search-input')?.focus(),
    onSearchCustomer: () => document.getElementById('customer-search-input')?.focus(),
    onApplyDiscount: () => document.getElementById('discount-input-active')?.focus(),
    onSelectCash: () => setPaymentMethod('cash'),
    onSelectCard: () => setPaymentMethod('card'),
    onSelectUpi: () => setPaymentMethod('upi'),
    onSelectCredit: () => setPaymentMethod('credit'),
    onSelectUpiQr: () => {
      if (!upiEnabled) return toast.error('UPI QR is not configured — Settings → Payments');
      setPaymentMethod('upi_qr');
    },
    onCheckout: handleCheckout,
    onDeleteItem: () => selectedCartItemId && removeFromCart(selectedCartItemId),
    onPrintInvoice: () => lastSale && window.print(),
    onCancelBill: () => {
      clearCart();
      resetPayment();
      clearForm();
      toast('POS cleared', { icon: '🧹' });
    },
  }), [handleCheckout, selectedCartItemId, removeFromCart, lastSale, setPaymentMethod, clearCart, resetPayment, clearForm, upiEnabled]);

  useKeyboardShortcuts(keyboardActions);

  // Load repeat order from Orders page on mount
  useEffect(() => {
    const raw = sessionStorage.getItem('ms_repeat_order');
    if (!raw) return;
    sessionStorage.removeItem('ms_repeat_order');
    try {
      const items = JSON.parse(raw);
      if (Array.isArray(items) && items.length > 0) {
        setCart(items.map((it) => ({ ...it, cartItemId: crypto.randomUUID() })));
        toast.success(`${items.length} items loaded from previous order`);
      }
    } catch { /* ignore */ }
  }, [setCart]);

  const cartMap = useMemo(() => new Map(cart.map((i) => [i.productId, i])), [cart]);

  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-5">
          <ShoppingCart className="w-10 h-10 opacity-40" />
        </div>
        <p className="text-gray-500 text-lg">Select a shop to start billing</p>
        <p className="text-sm text-gray-400 mt-1 font-semibold">Choose your active shop from the top bar dropdown</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-[calc(100vh-4.5rem)] -mx-4 -mt-4 sm:-mx-6 lg:-mx-8 overflow-hidden bg-[#f8fafc] flex-col">
        {/* Top Navbar */}
        <div className="shrink-0 flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">POS Billing System</span>
            <span className="text-gray-300 select-none">|</span>
            <span className="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">{activeShop?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDailyClose(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 rounded-xl text-xs hover:bg-gray-50 font-bold transition"
            >
              <Calendar className="w-3.5 h-3.5" /> Close Day
            </button>
            {currentUser && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 font-bold">
                <User className="w-3.5 h-3.5 text-slate-400" /> {currentUser.name}
              </div>
            )}
          </div>
        </div>

        {/* 3-Column Layout Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT PANEL (20%) - Customer & Billing info */}
          <div className="w-1/5 shrink-0 bg-white border-r border-gray-200 p-4 overflow-y-auto scrollbar-thin select-none">
            <CustomerSection
              customerSearch={customerSearch}
              setCustomerSearch={setCustomerSearch}
              customerId={customerId}
              setCustomerId={setCustomerId}
              customers={customers}
              onQuickAdd={(d, cb) => createCustomerMut.mutate({ ...d, shopId }, { onSuccess: cb })}
              isAddingCustomer={createCustomerMut.isPending}
              customerTags={customerTags}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              upiEnabled={upiEnabled}
            />

            {/* Bill notes — persisted with the sale and printed on the invoice */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                Bill Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="order-notes"
                placeholder="Optional note for this bill…"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400 transition resize-none"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  data-testid="private-bill"
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <span className="text-[11px] font-semibold text-gray-500">
                  Private bill — hide from reports &amp; exports
                </span>
              </label>
            </div>
          </div>

          {/* CENTER PANEL (55%) - Main Product & Cart area */}
          <div className="w-[55%] flex-1 flex flex-col p-4 overflow-hidden gap-3.5">
            {/* Top Search bar */}
            <div className="shrink-0">
              <ProductSearch
                search={search}
                setSearch={setSearch}
                products={products}
                isLoading={productsLoading}
                onAddToCart={addToCart}
                cartMap={cartMap}
                productTags={productTags}
              />
            </div>

            {/* Cart Table */}
            <div className="flex-1 min-h-0">
              <CartTable
                cart={cart}
                discountMode={discountMode}
                taxRate={taxRate}
                onIncrementQty={incrementQty}
                onDecrementQty={decrementQty}
                onUpdateQty={updateQty}
                onUpdatePrice={updatePrice}
                onUpdateDiscount={updateDiscount}
                onRemoveFromCart={removeFromCart}
                onDuplicateItem={duplicateItem}
                selectedCartItemId={selectedCartItemId}
                setSelectedCartItemId={setSelectedCartItemId}
              />
            </div>

            {/* Quick Actions Panel */}
            <div className="shrink-0 select-none">
              <QuickActions
                cart={cart}
                customerSearch={customerSearch}
                onHoldBill={handleHold}
                heldBills={heldBills}
                onResumeBill={handleResume}
                onDeleteHeldBill={deleteBill}
                showHeldBills={showHeldBills}
                setShowHeldBills={setShowHeldBills}
                onCloseDay={() => setShowDailyClose(true)}
                onResetBill={keyboardActions.onCancelBill}
              />
            </div>
          </div>

          {/* RIGHT PANEL (25%) - Checkout Summary (Always Visible) */}
          <div className="w-1/4 shrink-0 bg-white border-l border-gray-200 p-4 flex flex-col gap-4 overflow-y-auto scrollbar-thin select-none">
            <TotalSummary
              totals={totals}
              taxPreset={taxPreset}
              shopTaxRate={shopTaxRate}
              customTaxVal={customTaxVal}
              onTaxPresetChange={setTaxPreset}
              onCustomTaxValChange={setCustomTaxVal}
              taxAmount={taxAmount}
              grandTotal={grandTotal}
            />

            <PaymentPanel
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              receivedAmount={receivedAmount}
              setReceivedAmount={setReceivedAmount}
              dueAmount={dueAmount}
              setDueAmount={setDueAmount}
              grandTotal={grandTotal}
              onCheckout={handleCheckout}
              checkoutPending={createSaleMut.isPending}
              isCartEmpty={cart.length === 0}
              upiEnabled={upiEnabled}
            />
          </div>
        </div>

        {/* Shortkeys Cheat Sheet Footer */}
        <BillingFooter isOnline={isOnline} />
      </div>

      {/* Invoice / Bill Details Overlay — also hosts the audited Edit Bill flow */}
      {showInvoice && lastSale && (
        <InvoiceModal
          sale={lastSale}
          onClose={() => setShowInvoice(false)}
          onUpdated={(updated) => setLastSale(updated)}
        />
      )}

      {/* UPI QR — scan to pay, then verify with the transaction reference */}
      {pendingUpiSale && (
        <UpiQrModal
          sale={pendingUpiSale}
          shop={activeShop}
          onPaid={(verified) => {
            setPendingUpiSale(null);
            setLastSale(verified);
            setShowInvoice(true);
          }}
          onVoided={() => setPendingUpiSale(null)}
          onClose={() => setPendingUpiSale(null)}
        />
      )}

      {/* Close Day Register Modal */}
      {showDailyClose && (
        <DailyClosingModal open={showDailyClose} onClose={() => setShowDailyClose(false)} shopId={shopId} />
      )}
    </>
  );
}
