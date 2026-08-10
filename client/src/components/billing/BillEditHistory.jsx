import { History, User, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

/**
 * BillEditHistory — audit trail for a bill that has been modified.
 *
 * Renders nothing when the bill has never been edited, so it can be dropped
 * into the invoice view unconditionally.
 */
export default function BillEditHistory({ sale }) {
  const history = sale?.editHistory || [];
  if (!history.length) return null;

  return (
    <div className="mt-5 border border-amber-200 bg-amber-50/50 rounded-xl overflow-hidden" data-testid="bill-edit-history">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100/60 border-b border-amber-200">
        <History className="w-4 h-4 text-amber-600" />
        <p className="text-xs font-black text-amber-900 uppercase tracking-wide">
          Modification history — {history.length} edit{history.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="divide-y divide-amber-200/70">
        {[...history].reverse().map((h, i) => (
          <div key={i} className="px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                <User className="w-3 h-3 text-amber-600" />
                {h.editedByName || 'Unknown user'}
                {h.editedByRole && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded capitalize">
                    {h.editedByRole.replace('_', ' ')}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-500 tabular-nums">
                {h.editedAt ? format(new Date(h.editedAt), 'dd MMM yyyy, hh:mm a') : ''}
              </p>
            </div>

            <p className="text-xs text-gray-700">
              <span className="font-bold text-gray-500">Reason: </span>{h.reason}
            </p>

            {(h.before?.totalAmount != null && h.after?.totalAmount != null) && (
              <p className="flex items-center gap-1.5 text-xs font-bold tabular-nums">
                <span className="text-gray-400 line-through">₹{Number(h.before.totalAmount).toFixed(2)}</span>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span className="text-gray-900">₹{Number(h.after.totalAmount).toFixed(2)}</span>
                {(() => {
                  const d = Number(h.after.totalAmount) - Number(h.before.totalAmount);
                  if (Math.abs(d) < 0.01) return null;
                  return (
                    <span className={d > 0 ? 'text-red-600' : 'text-green-600'}>
                      ({d > 0 ? '+' : '−'}₹{Math.abs(d).toFixed(2)})
                    </span>
                  );
                })()}
              </p>
            )}

            {!!h.changes?.length && (
              <ul className="space-y-0.5 pt-0.5">
                {h.changes.map((c, j) => (
                  <li key={j} className="text-[11px] text-gray-600 flex gap-1.5">
                    <span className="text-amber-500">•</span>{c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
