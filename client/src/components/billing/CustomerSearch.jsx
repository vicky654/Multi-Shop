import { useState } from 'react';
import { User, CheckCircle, X, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CustomerSearch({
  customers,
  customerId,
  customerSearch,
  onChange,
  onSelect,
  onDeselect,
  canAdd,
  onQuickAdd,
  isAdding,
}) {
  const [showDrop, setShowDrop] = useState(false);
  const [showAdd,  setShowAdd]  = useState(false);
  const [form,     setForm]     = useState({ name: '', phone: '' });

  const filtered = customers.filter((c) =>
    !customerSearch ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').includes(customerSearch)
  );

  const handleAdd = () => {
    if (!form.name || !form.phone) { toast.error('Name and phone required'); return; }
    onQuickAdd(form, () => {
      setShowAdd(false);
      setShowDrop(false);
      setForm({ name: '', phone: '' });
    });
  };

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={customerSearch}
          onChange={(e) => { onChange(e.target.value); setShowDrop(true); }}
          onFocus={() => setShowDrop(true)}
          placeholder="Search customer by name or phone…"
          className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Selected customer chip */}
      {customerId && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 mt-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-xs font-medium text-blue-700 truncate">{customerSearch}</span>
          </div>
          <button onClick={onDeselect}>
            <X className="w-3.5 h-3.5 text-blue-500 ml-1 shrink-0" />
          </button>
        </div>
      )}

      {/* Dropdown */}
      {showDrop && !customerId && customerSearch && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl max-h-44 overflow-y-auto">
          <button
            onClick={() => { onDeselect(); setShowDrop(false); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-b border-gray-100"
          >
            Walk-in customer
          </button>
          {filtered.map((c) => (
            <button
              key={c._id}
              onClick={() => { onSelect(c); setShowDrop(false); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-2 transition"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {c.name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900 truncate">{c.name}</span>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{c.phone}</span>
            </button>
          ))}
          {!filtered.length && (
            <p className="px-3 py-2 text-xs text-gray-400">No match — try a different name or phone</p>
          )}
          {canAdd && (
            <button
              onClick={() => { setShowAdd(true); setShowDrop(false); }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-1.5 border-t border-gray-100 transition"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add new customer
            </button>
          )}
        </div>
      )}

      {/* Quick-add form */}
      {showAdd && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2 mt-2">
          <p className="text-xs font-semibold text-blue-800 flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" /> New Customer
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name *"
              className="h-8 px-2.5 border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone *"
              className="h-8 px-2.5 border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isAdding}
              className="flex-1 h-8 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {isAdding ? 'Saving…' : 'Save & Select'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setForm({ name: '', phone: '' }); }}
              className="flex-1 h-8 bg-white border border-gray-300 text-xs text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
