/**
 * VariantMatrix — the color × size stock grid.
 *
 *              7    8    9   10   11   Total
 *   Black     10   15   20   10    5      60
 *   Brown      5    8   10    7   10      40
 *   ───────────────────────────────────────────
 *   Total     15   23   30   17   15     100
 *
 * NumberInput (not a plain <input type=number>) is deliberate: the parent clamps
 * '' to 0, and a plain controlled input snaps back to that 0 the instant the
 * field is emptied, so clearing a cell and typing "10" yields "010" or "100".
 * That component exists precisely to stop stock being silently mis-entered.
 *
 * On mobile the grid scrolls horizontally with the colour column pinned, so a
 * 3×8 shoe matrix stays readable on a phone.
 */
import { useState } from 'react';
import { Wand2, Copy, Eraser, Scale, MoreHorizontal, Check } from 'lucide-react';
import NumberInput from '../ui/NumberInput';
import { cellKey, setCell, fillAll, fillRow, distributeEvenly, copyRow, clearAll } from '../../utils/variantMatrix';
import { PRESET_COLORS, inp } from './fields';

const hexFor = (name) => PRESET_COLORS.find((c) => c.name === name)?.hex || '#cbd5e1';

/** Per-row actions — fill this row, or copy it onto every other row. */
function RowMenu({ row, matrix, setMatrix, onClose }) {
  const [qty, setQty] = useState('');
  const others = matrix.rows.filter((r) => r !== row);

  return (
    <div className="absolute right-0 top-9 z-30 w-56 p-2 bg-white border border-gray-200 rounded-xl shadow-lg space-y-1.5">
      <div className="flex gap-1.5">
        <input
          type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)}
          placeholder="Qty" className={`${inp} h-9`}
        />
        <button
          type="button"
          onClick={() => { setMatrix(fillRow(matrix, row, qty)); onClose(); }}
          className="h-9 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium shrink-0"
        >
          Fill
        </button>
      </div>
      {others.length > 0 && (
        <button
          type="button"
          onClick={() => { setMatrix(copyRow(matrix, row, others)); onClose(); }}
          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition"
        >
          <Copy className="w-3.5 h-3.5 shrink-0" />
          Copy to all {others.length} other row{others.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}

export default function VariantMatrix({ matrix, totals, setMatrix, totalReceived }) {
  const [bulkQty, setBulkQty]   = useState('');
  const [openRow, setOpenRow]   = useState(null);

  if (Object.keys(matrix.cells).length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
        Add colors and sizes above to build the stock matrix.
      </div>
    );
  }

  // '' is the placeholder for a missing axis — show it as a readable label
  // rather than an empty header cell.
  const rowLabel = (r) => r || 'All colors';
  const colLabel = (c) => c || 'Qty';

  const th = 'px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide';

  return (
    <div className="space-y-3">

      {/* ── Bulk toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
        <NumberInput
          value={bulkQty}
          onCommit={setBulkQty}
          min="0"
          placeholder="Qty"
          className={`${inp} h-9 w-20`}
        />
        <button type="button" onClick={() => setMatrix(fillAll(matrix, bulkQty))}
          className="h-9 px-3 inline-flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition">
          <Wand2 className="w-3.5 h-3.5" /> Fill All
        </button>
        <button
          type="button"
          onClick={() => setMatrix(distributeEvenly(matrix, Number(totalReceived) || 0))}
          disabled={!Number(totalReceived)}
          title={Number(totalReceived) ? undefined : 'Enter the total received first'}
          className="h-9 px-3 inline-flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-gray-700 transition"
        >
          <Scale className="w-3.5 h-3.5" /> Distribute Evenly
        </button>
        <button type="button" onClick={() => setMatrix(clearAll(matrix))}
          className="h-9 px-3 inline-flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-red-50 hover:border-red-200 hover:text-red-600 rounded-xl text-sm font-medium text-gray-700 transition">
          <Eraser className="w-3.5 h-3.5" /> Clear
        </button>

        <span className="ml-auto text-sm font-semibold text-gray-700">
          Total: <span className="text-blue-700">{totals.grandTotal}</span>
        </span>
      </div>

      {/* ── The grid ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {/* Pinned so the colour stays visible while scrolling sideways. */}
              <th className={`${th} sticky left-0 z-20 bg-white text-left min-w-[7rem]`}>
                Color
              </th>
              {matrix.cols.map((c) => (
                <th key={c} className={`${th} text-center min-w-[4.5rem]`}>{colLabel(c)}</th>
              ))}
              <th className={`${th} text-right min-w-[4rem] bg-blue-50/60 rounded-t-lg`}>Total</th>
            </tr>
          </thead>

          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row} className="group">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 transition px-2 py-1.5 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    {row && (
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: hexFor(row) }}
                      />
                    )}
                    <span className="font-medium text-gray-800 truncate">{rowLabel(row)}</span>
                    <div className="relative ml-auto">
                      <button
                        type="button"
                        onClick={() => setOpenRow(openRow === row ? null : row)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                        title="Fill or copy this row"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openRow === row && (
                        <RowMenu row={row} matrix={matrix} setMatrix={setMatrix}
                          onClose={() => setOpenRow(null)} />
                      )}
                    </div>
                  </div>
                </td>

                {matrix.cols.map((col) => {
                  const cell = matrix.cells[cellKey(row, col)];
                  return (
                    <td key={col} className="px-1 py-1.5 border-t border-gray-100">
                      <NumberInput
                        value={cell?.stock ?? 0}
                        // Clamped here as well as in the engine, so a negative
                        // cannot even be typed into the field.
                        onCommit={(v) => setMatrix(setCell(matrix, row, col, {
                          stock: Math.max(0, parseInt(v, 10) || 0),
                        }))}
                        min="0"
                        className="w-full h-10 px-2 text-center border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      />
                    </td>
                  );
                })}

                <td className="px-2 py-1.5 border-t border-gray-100 text-right font-bold text-gray-800 bg-blue-50/40">
                  {totals.rowTotals[row] ?? 0}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 bg-white px-2 py-2 border-t-2 border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total
              </td>
              {matrix.cols.map((c) => (
                <td key={c} className="px-1 py-2 border-t-2 border-gray-200 text-center font-bold text-gray-800">
                  {totals.colTotals[c] ?? 0}
                </td>
              ))}
              <td className="px-2 py-2 border-t-2 border-blue-200 text-right bg-blue-50 rounded-b-lg">
                <span className="font-black text-blue-700">{totals.grandTotal}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {Number(totalReceived) > 0 && totals.grandTotal === Number(totalReceived) && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-green-600">
          <Check className="w-3.5 h-3.5" />
          Matrix matches the {totalReceived} received.
        </p>
      )}
    </div>
  );
}
