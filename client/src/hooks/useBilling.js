import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productsApi } from '../api/products.api';
import { customersApi } from '../api/customers.api';
import { salesApi } from '../api/sales.api';
import { getCachedProducts, cacheProducts } from '../lib/offlineDB';
import useBillingSettingsStore from '../store/billingSettingsStore';
import useSetupStore from '../store/setupStore';

export function useBilling(shopId, isOnline) {
  const qc = useQueryClient();
  const { searchDebounceMs } = useBillingSettingsStore();

  // ── States ─────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [showDailyClose, setShowDailyClose] = useState(false);
  const [showHeldBills, setShowHeldBills] = useState(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), searchDebounceMs);
    return () => clearTimeout(t);
  }, [search, searchDebounceMs]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: productData, isLoading: productsLoading } = useQuery({
    queryKey: ['products-billing', shopId, debouncedSearch, isOnline],
    queryFn: async () => {
      if (!isOnline) {
        const cached = await getCachedProducts(shopId).catch(() => []);
        const q = debouncedSearch.toLowerCase();
        return {
          data: q
            ? cached.filter((p) => p.name?.toLowerCase().includes(q) || p.sku?.includes(q) || p.barcode?.includes(q))
            : cached,
        };
      }
      return productsApi.getAll({ shopId, search: debouncedSearch, limit: 40 });
    },
    enabled: !!shopId,
    staleTime: isOnline ? 2 * 60 * 1000 : Infinity,
  });

  // Automatically cache products locally on a full online load
  useEffect(() => {
    if (!isOnline || !shopId || debouncedSearch) return;
    const prods = productData?.data;
    if (Array.isArray(prods) && prods.length > 0) {
      cacheProducts(shopId, prods).catch(() => {});
    }
  }, [isOnline, shopId, productData, debouncedSearch]);

  const { data: customerData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-billing', shopId],
    queryFn: () => customersApi.getAll({ shopId, limit: 200 }),
    enabled: !!shopId,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createSaleMut = useMutation({
    mutationFn: (payload) => salesApi.create(payload),
    onSuccess: (res) => {
      const sale = res.data.sale;
      // A UPI QR bill is created unpaid — the Billing page opens the QR modal and
      // owns the receipt, so don't claim the sale is recorded or show an invoice.
      const awaitingPayment = sale.paymentStatus === 'pending';

      useSetupStore.getState().mark('hasSales');
      if (!awaitingPayment) {
        setLastSale(sale);
        setShowInvoice(true);
      }
      setCustomerId('');
      setCustomerSearch('');
      setNotes('');
      setIsPrivate(false);
      qc.invalidateQueries(['products']);
      qc.invalidateQueries(['products-billing']);
      qc.invalidateQueries(['sales']);

      toast.success(
        awaitingPayment
          ? `Awaiting UPI payment — ${sale.invoiceNumber}`
          : `Sale recorded — ${sale.invoiceNumber}`
      );
    },
    onError: (e) => toast.error(e.message || 'Failed to submit sale to server.'),
  });

  const createCustomerMut = useMutation({
    mutationFn: (data) => customersApi.create(data),
    onSuccess: (res) => {
      const c = res.data.customer;
      qc.invalidateQueries(['customers-billing']);
      setCustomerId(c._id);
      setCustomerSearch(`${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
      toast.success(`"${c.name}" added & selected`);
    },
    onError: (e) => toast.error(e.message || 'Failed to add customer.'),
  });

  // ── Derived Smart Tags ─────────────────────────────────────────────────────
  const customers = customerData?.data || [];
  const products = productData?.data || [];

  const customerTags = useMemo(() => {
    if (!customers.length) return { vip: [], regular: [], credit: [], recent: [] };
    const sortedSpent = [...customers].sort((a, b) => b.totalSpent - a.totalSpent);
    const sortedPurchases = [...customers].sort((a, b) => b.totalPurchases - a.totalPurchases);

    return {
      vip: sortedSpent.slice(0, 5).filter((c) => c.totalSpent > 5000),
      regular: sortedPurchases.slice(0, 5).filter((c) => c.totalPurchases >= 5),
      credit: customers.filter((c) => c.creditBalance > 0).slice(0, 5),
      recent: [...customers].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5),
    };
  }, [customers]);

  const productTags = useMemo(() => {
    if (!products.length) return { lowStock: [], recentlyAdded: [] };
    return {
      lowStock: products.filter((p) => p.stock <= (p.lowStockThreshold || 10)),
      recentlyAdded: [...products].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    };
  }, [products]);

  const clearForm = () => {
    setSearch('');
    setCustomerId('');
    setCustomerSearch('');
    setNotes('');
    setIsPrivate(false);
  };

  return {
    search,
    setSearch,
    debouncedSearch,
    customerId,
    setCustomerId,
    customerSearch,
    setCustomerSearch,
    notes,
    setNotes,
    isPrivate,
    setIsPrivate,
    showInvoice,
    setShowInvoice,
    lastSale,
    setLastSale,
    showDailyClose,
    setShowDailyClose,
    showHeldBills,
    setShowHeldBills,
    products,
    customers,
    productsLoading,
    customersLoading,
    createSaleMut,
    createCustomerMut,
    customerTags,
    productTags,
    clearForm,
  };
}
