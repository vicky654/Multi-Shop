import { useState } from 'react';
import { User, Plus, X, Award, Flame, UserCheck, ShieldAlert, Coins } from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash (F4)' },
  { id: 'card', label: 'Card (F5)' },
  { id: 'upi', label: 'UPI (F6)' },
  { id: 'upi_qr', label: 'UPI QR (F8)', upiOnly: true },
  { id: 'credit', label: 'Credit (F7)' },
];

export default function CustomerSection({
  customerSearch,
  setCustomerSearch,
  customerId,
  setCustomerId,
  customers,
  onQuickAdd,
  isAddingCustomer,
  customerTags,
  paymentMethod,
  setPaymentMethod,
  upiEnabled = false,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedCustomer = customers.find((c) => c._id === customerId);

  const handleQuickAddSubmit = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onQuickAdd({ name: newName, phone: newPhone }, () => {
      setNewName('');
      setNewPhone('');
      setShowAddForm(false);
    });
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
  );

  return (
    <div className="space-y-4">
      {/* Customer Search & Select Header */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Customer Info</span>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-blue-600 hover:text-blue-800 transition p-1 hover:bg-blue-50 rounded-lg flex items-center gap-0.5 text-xs font-semibold"
            title="Add New Customer"
          >
            <Plus className="w-3.5 h-3.5" /> Quick Add
          </button>
        </div>

        {/* Inline Customer Add Form (No Popup Modal!) */}
        {showAddForm && (
          <form onSubmit={handleQuickAddSubmit} className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-blue-700 uppercase">New Customer</span>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-blue-400 hover:text-blue-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (Required)"
              className="w-full h-8 text-xs px-2 border border-blue-200 rounded bg-white outline-none focus:border-blue-400"
            />
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone (Optional)"
              className="w-full h-8 text-xs px-2 border border-blue-200 rounded bg-white outline-none focus:border-blue-400"
            />
            <button
              type="submit"
              disabled={isAddingCustomer}
              className="w-full h-7 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isAddingCustomer ? 'Adding...' : 'Save & Select'}
            </button>
          </form>
        )}

        {/* Customer Select / Input */}
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="customer-search-input"
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setCustomerId('');
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="Search Customer (F2)..."
            className="ui-input h-10 pl-9 pr-8 text-sm"
          />
          {customerId && (
            <button
              onClick={() => {
                setCustomerSearch('');
                setCustomerId('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Search Dropdown */}
          {showDropdown && customerSearch && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto scrollbar-thin text-xs">
              {filteredCustomers.length === 0 ? (
                <p className="p-3 text-gray-400 text-center">No customers found</p>
              ) : (
                filteredCustomers.map((c) => (
                  <button
                    key={c._id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCustomerId(c._id);
                      setCustomerSearch(`${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span>{c.name}</span>
                    <span className="text-gray-400">{c.phone || 'No phone'}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selected Customer Credit / Summary */}
      {selectedCustomer && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs space-y-2.5">
          <div className="flex justify-between items-center pb-1.5 border-b border-gray-200">
            <span className="font-bold text-gray-700">{selectedCustomer.name}</span>
            <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 font-bold uppercase">
              Selected
            </span>
          </div>

          <div className="flex justify-between items-center text-gray-600">
            <span className="flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-500" /> Credit Balance:
            </span>
            <span className={`font-bold tabular-nums ${selectedCustomer.creditBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
              ₹{selectedCustomer.creditBalance}
            </span>
          </div>

          {selectedCustomer.purchaseHistory?.length > 0 ? (
            <div>
              <p className="text-gray-400 font-medium mb-1">Last Purchase Summary:</p>
              <div className="bg-white border border-gray-100 rounded-lg p-2 flex justify-between text-[11px] font-semibold text-gray-600">
                <span>{new Date(selectedCustomer.purchaseHistory[selectedCustomer.purchaseHistory.length - 1].date).toLocaleDateString()}</span>
                <span className="text-gray-800">₹{selectedCustomer.purchaseHistory[selectedCustomer.purchaseHistory.length - 1].amount}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 italic">No purchase history available</p>
          )}
        </div>
      )}

      {/* Customer Quick Tags */}
      <div>
        <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Quick Tags</span>
        <div className="flex flex-wrap gap-1 text-[11px]">
          {customerTags.vip.map((c) => (
            <button
              key={c._id}
              onClick={() => {
                setCustomerId(c._id);
                setCustomerSearch(`${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
              }}
              className="bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-700 px-2 py-0.5 rounded flex items-center gap-0.5 font-semibold"
            >
              <Award className="w-2.5 h-2.5" /> VIP: {c.name}
            </button>
          ))}
          {customerTags.regular.map((c) => (
            <button
              key={c._id}
              onClick={() => {
                setCustomerId(c._id);
                setCustomerSearch(`${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
              }}
              className="bg-green-50 hover:bg-green-100 border border-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-0.5 font-semibold"
            >
              <Flame className="w-2.5 h-2.5" /> Reg: {c.name}
            </button>
          ))}
          {customerTags.credit.map((c) => (
            <button
              key={c._id}
              onClick={() => {
                setCustomerId(c._id);
                setCustomerSearch(`${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
              }}
              className="bg-red-50 hover:bg-red-100 border border-red-100 text-red-700 px-2 py-0.5 rounded flex items-center gap-0.5 font-semibold"
            >
              <ShieldAlert className="w-2.5 h-2.5" /> Due: {c.name}
            </button>
          ))}
          {customerTags.recent.map((c) => (
            <button
              key={c._id}
              onClick={() => {
                setCustomerId(c._id);
                setCustomerSearch(`${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
              }}
              className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded flex items-center gap-0.5 font-semibold"
            >
              <UserCheck className="w-2.5 h-2.5" /> {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Type Selector (Fixed left layout section) */}
      <div className="border-t border-gray-100 pt-3">
        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Payment Method</span>
        <div className="grid grid-cols-2 gap-1.5">
          {PAYMENT_METHODS
            // UPI QR only appears once a VPA is configured in Settings → Payments
            .filter((m) => !m.upiOnly || upiEnabled)
            .map((m) => (
              <button
                key={m.id}
                onClick={() => setPaymentMethod(m.id)}
                className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                  paymentMethod === m.id
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {m.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
