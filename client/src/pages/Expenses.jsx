import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { expensesApi } from '../api/expenses.api';
import useShopStore from '../store/shopStore';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ExpenseForm, { EMPTY_EXPENSE } from '../components/expenses/ExpenseForm';
import StatCard from '../components/StatCard';

const TYPES = ['rent', 'electricity', 'salary', 'maintenance', 'supplies', 'other'];
const TYPE_ICONS = { rent: '🏠', electricity: '⚡', salary: '💰', maintenance: '🔧', supplies: '📦', other: '📝' };
const EMPTY = { ...EMPTY_EXPENSE, date: format(new Date(), 'yyyy-MM-dd') };

export default function Expenses() {
  const qc = useQueryClient();
  const { activeShop, shops } = useShopStore();
  const shopId = activeShop?._id;
  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [form, setForm] = useState({ ...EMPTY, shopId });
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', shopId],
    queryFn: () => expensesApi.getAll({ shopId }),
    staleTime: 5 * 60 * 1000,
    enabled: !!shopId,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['expense-summary', shopId],
    queryFn: () => expensesApi.getSummary({ shopId }),
    staleTime: 5 * 60 * 1000,
    enabled: !!shopId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['expense-summary'] });
  };

  const createMut = useMutation({
    mutationFn: (d) => expensesApi.create(d),
    onSuccess: () => { invalidateAll(); toast.success('Expense added'); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => expensesApi.update(id, data),
    onSuccess: () => { invalidateAll(); toast.success('Expense updated'); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => expensesApi.delete(id),
    onSuccess: () => { invalidateAll(); toast.success('Expense deleted'); },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => { setEditExpense(null); setForm({ ...EMPTY, shopId }); setShowModal(true); };
  const openEdit   = (e) => { setEditExpense(e); setForm({ ...EMPTY, ...e, date: format(new Date(e.date), 'yyyy-MM-dd'),
      invoiceDate: e.invoiceDate ? format(new Date(e.invoiceDate), 'yyyy-MM-dd') : '',
      shopId: e.shopId?._id || e.shopId }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditExpense(null); };
  const handleSubmit = (ev) => { ev.preventDefault(); editExpense ? updateMut.mutate({ id: editExpense._id, data: form }) : createMut.mutate(form); };

  const expenses = data?.data || [];
  const summary  = summaryData?.data?.summary || [];
  const totalAll = summary.reduce((a, s) => a + s.total, 0);

  const columns = [
    { key: 'type',        label: 'Type',    render: (v) => <span>{TYPE_ICONS[v]} <span className="capitalize font-medium">{v}</span></span> },
    { key: 'amount',      label: 'Amount',  render: (v) => <span className="font-semibold text-red-600">₹{Number(v).toLocaleString('en-IN')}</span> },
    { key: 'date',        label: 'Date',    render: (v) => format(new Date(v), 'dd MMM yyyy') },
    { key: 'description', label: 'Note',    render: (v) => v || '—' },
    { key: 'addedBy',     label: 'By',      render: (v) => v?.name || '—' },
    { key: '_id',         label: 'Actions', render: (_, r) => (
      <div className="flex gap-2">
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"><Edit2 className="w-4 h-4" /></button>
        <button onClick={() => { if (confirm('Delete this expense?')) deleteMut.mutate(r._id); }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500">Track all business expenses</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Receipt} label="Total Expenses" value={`₹${totalAll.toLocaleString('en-IN')}`} color="red" />
        {summary.slice(0, 3).map((s) => (
          <div key={s._id} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">{TYPE_ICONS[s._id]} {s._id}</p>
            <p className="text-xl font-bold text-gray-800 mt-1">₹{s.total.toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>

      <DataTable columns={columns} data={expenses} loading={isLoading} emptyMessage="No expenses recorded yet" />

      <Modal size="lg" open={showModal} onClose={closeModal} title={editExpense ? 'Edit Expense' : 'Add Expense'}>
        <ExpenseForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          loading={createMut.isPending || updateMut.isPending}
          shops={shops}
          shopId={shopId}
        />
      </Modal>
    </div>
  );
}
