import { PauseCircle, PlayCircle, Trash2, Calendar, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function QuickActions({
  cart,
  customerSearch,
  onHoldBill,
  heldBills,
  onResumeBill,
  onDeleteHeldBill,
  showHeldBills,
  setShowHeldBills,
  onCloseDay,
  onResetBill,
}) {
  const canHold = cart.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3.5">
      <div className="flex justify-between items-center select-none pb-2 border-b border-gray-100">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">POS Utilities</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Reset Cart */}
        <button
          type="button"
          onClick={onResetBill}
          className="flex flex-col items-center justify-center py-2.5 px-2 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition text-[11px] font-bold gap-1"
        >
          <RotateCcw className="w-4 h-4 text-gray-400" />
          Reset POS (Esc)
        </button>

        {/* Hold Active Sale */}
        <button
          type="button"
          disabled={!canHold}
          onClick={onHoldBill}
          className="flex flex-col items-center justify-center py-2.5 px-2 bg-amber-50/50 border border-amber-200 rounded-xl hover:bg-amber-100/50 text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition text-[11px] font-bold gap-1"
        >
          <PauseCircle className="w-4 h-4 text-amber-500" />
          Hold Bill
        </button>

        {/* Toggle Held Bills list */}
        <button
          type="button"
          onClick={() => setShowHeldBills(!showHeldBills)}
          className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition text-[11px] font-bold gap-1 border ${
            showHeldBills
              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
              : 'bg-green-50/50 border border-green-200 text-green-700 hover:bg-green-100/50'
          }`}
        >
          <PlayCircle className={`w-4 h-4 ${showHeldBills ? 'text-white' : 'text-green-500'}`} />
          Resume ({heldBills.length})
        </button>
      </div>

      {/* Held Bills Inline List (No Popup Modals!) */}
      <AnimatePresence>
        {showHeldBills && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100 pt-3"
          >
            {heldBills.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-2">No held bills found.</p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin" data-testid="held-bills-list">
                {[...heldBills].reverse().map((bill) => {
                  const itemCount = bill.cart?.length || 0;
                  const units = (bill.cart || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0);
                  const customer = bill.customerSearch?.split(' — ')[0] || 'Walk-in';

                  return (
                    <div
                      key={bill.id}
                      data-testid={`held-bill-${bill.id}`}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs hover:border-gray-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-[10px] text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                              {bill.billNo || `#${bill.seq}`}
                            </span>
                            <p className="font-bold text-gray-800 truncate">{customer}</p>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {itemCount} item{itemCount === 1 ? '' : 's'} · {units} unit{units === 1 ? '' : 's'}
                            {' · '}
                            {new Date(bill.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-gray-900 tabular-nums text-sm">
                            ₹{Number(bill.grandTotal || 0).toFixed(2)}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase">{bill.paymentMethod || 'cash'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mt-2">
                        <button
                          type="button"
                          onClick={() => onResumeBill(bill.id)}
                          data-testid="resume-held-bill"
                          className="flex-1 px-2 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold transition flex items-center justify-center gap-1"
                        >
                          <PlayCircle className="w-3 h-3" /> Resume Bill
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteHeldBill(bill.id)}
                          title="Discard held bill"
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily Close Button */}
      <div className="pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCloseDay}
          className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
        >
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          Close Day Registers
        </button>
      </div>
    </div>
  );
}
