import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, CheckSquare, Square, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { expensesApi } from '../../api/expenses.api';
import { formatINR } from '../../utils/format';

/**
 * ExpenseClassifier — clear the backlog of unclassified expenses.
 *
 * Every expense recorded before the tax module existed defaults to Review for
 * both ITC and deductibility, which is correct but means none of it reaches the
 * profit or credit figures. This is where a human decides, in bulk.
 *
 * WHAT THIS DOES NOT DO
 *   It never suggests a classification, pre-selects "eligible", or infers intent
 *   from the category. The whole value of the three-way flag is that a person
 *   made the call, and a default that leans towards claiming would destroy that.
 *   Documentation gaps are surfaced as facts ("no GSTIN on record") so the person
 *   deciding can see what they are deciding on.
 */

const inr = (n) => formatINR(n ?? 0, 2);

export default function ExpenseClassifier({ items, financialYear, onChanged }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(() => new Set());
  const [note, setNote] = useState('');

  const toggle = (id) => setSelected((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const allSelected = items.length > 0 && selected.size === items.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((i) => i._id)));

  const bulkMut = useMutation({
    mutationFn: (payload) => expensesApi.classifyBulk(payload),
    onSuccess: (res) => {
      const { updated, failed } = res.data;
      // Recalculating immediately is the point — the owner should see the profit
      // and ITC move as they classify.
      qc.invalidateQueries({ queryKey: ['tax-summary'] });
      qc.invalidateQueries({ queryKey: ['tax-review'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setSelected(new Set());
      setNote('');
      onChanged?.();
      if (failed?.length) {
        toast.error(`${updated} classified, ${failed.length} failed`);
      } else {
        toast.success(`${updated} expense${updated === 1 ? '' : 's'} classified`);
      }
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const apply = (patch) => {
    if (selected.size === 0) return toast.error('Select at least one expense');
    bulkMut.mutate({ ids: [...selected], reviewNote: note || undefined, ...patch });
  };

  const selectedTotals = useMemo(() => {
    let amount = 0, gst = 0;
    for (const e of items) {
      if (!selected.has(e._id)) continue;
      amount += Number(e.amount) || 0;
      gst    += Number(e.gstAmount) || 0;
    }
    return { amount, gst };
  }, [items, selected]);

  if (items.length === 0) {
    return (
      <div className="p-5 text-sm text-gray-500 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        Every expense in FY {financialYear} has a confirmed treatment.
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 sm:px-5 pt-4 space-y-2">
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            These are <b>excluded</b> from every profit and GST figure until classified.
            MultiShop does not suggest an answer — deciding whether a cost is deductible and
            its GST claimable is your call, and it is recorded against your name.
          </p>
        </div>
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 space-y-2.5">
        <div className="flex items-center gap-3">
          <button onClick={toggleAll}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition">
            {allSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-400" />}
            {allSelected ? 'Clear' : 'Select all'} ({items.length})
          </button>
          {selected.size > 0 && (
            <span className="text-xs text-gray-500 tabular-nums">
              {selected.size} selected · {inr(selectedTotals.amount)} cost
              {selectedTotals.gst > 0 && <> · {inr(selectedTotals.gst)} GST</>}
            </span>
          )}
        </div>

        {selected.size > 0 && (
          <>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note recorded with this decision (e.g. 'verified against invoices')"
              className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-400"
            />
            <div className="flex flex-wrap gap-2">
              <BulkBtn onClick={() => apply({ deductionStatus: 'deductible' })}
                disabled={bulkMut.isPending} tone="emerald" Icon={CheckCircle2}
                label="Deductible" />
              <BulkBtn onClick={() => apply({ deductionStatus: 'not_deductible' })}
                disabled={bulkMut.isPending} tone="gray" Icon={XCircle}
                label="Not deductible" />
              <span className="w-px bg-gray-200 mx-1" />
              <BulkBtn onClick={() => apply({ itcStatus: 'eligible' })}
                disabled={bulkMut.isPending} tone="emerald" Icon={CheckCircle2}
                label="ITC eligible" />
              <BulkBtn onClick={() => apply({ itcStatus: 'not_eligible' })}
                disabled={bulkMut.isPending} tone="gray" Icon={XCircle}
                label="ITC not eligible" />
              {bulkMut.isPending && <Loader2 className="w-4 h-4 animate-spin text-blue-600 self-center" />}
            </div>
          </>
        )}
      </div>

      {/* ── Rows ───────────────────────────────────────────────────────────── */}
      <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto scrollbar-thin">
        {items.map((e) => {
          const isSel = selected.has(e._id);
          const gstNoDoc = (Number(e.gstAmount) || 0) > 0 && (!e.vendorGstin || !e.invoiceNumber);
          return (
            <li key={e._id}
              onClick={() => toggle(e._id)}
              className={`flex items-start gap-3 px-4 sm:px-5 py-3 cursor-pointer transition ${
                isSel ? 'bg-blue-50/60' : 'hover:bg-gray-50'
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {isSel ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-300" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {e.description || e.type}
                </p>
                <p className="text-[11px] text-gray-500">
                  {new Date(e.date).toLocaleDateString('en-IN')} · {e.type}
                  {e.vendorName ? ` · ${e.vendorName}` : ''}
                </p>
                {/* Facts about the evidence, not a recommendation. */}
                {gstNoDoc && (
                  <p className="text-[11px] font-semibold text-amber-700 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    GST recorded but {!e.vendorGstin ? 'no vendor GSTIN' : ''}
                    {!e.vendorGstin && !e.invoiceNumber ? ' and ' : ''}
                    {!e.invoiceNumber ? 'no invoice number' : ''} on record
                  </p>
                )}
                {!e.businessPurpose && (
                  <p className="text-[11px] text-gray-400 mt-0.5">No business purpose recorded</p>
                )}
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900 tabular-nums">{inr(e.amount)}</p>
                {Number(e.gstAmount) > 0 && (
                  <p className="text-[11px] text-gray-500 tabular-nums">GST {inr(e.gstAmount)}</p>
                )}
              </div>

              <div className="flex flex-col gap-1 shrink-0 w-20">
                <StatusPill label="Deduct" status={e.deductionStatus} />
                <StatusPill label="ITC" status={e.itcStatus} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BulkBtn({ onClick, disabled, tone, Icon, label }) {
  const tones = {
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    gray:    'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-bold transition disabled:opacity-50 ${tones[tone]}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function StatusPill({ label, status }) {
  const map = {
    eligible:       { cls: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2 },
    deductible:     { cls: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2 },
    not_eligible:   { cls: 'bg-gray-100 text-gray-600',       Icon: XCircle },
    not_deductible: { cls: 'bg-gray-100 text-gray-600',       Icon: XCircle },
    review:         { cls: 'bg-amber-100 text-amber-800',     Icon: Clock },
  };
  const m = map[status] || map.review;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${m.cls}`}>
      <m.Icon className="w-2.5 h-2.5 shrink-0" />
      {label}
    </span>
  );
}
