import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, X, ChevronDown } from 'lucide-react';
import Modal from './Modal';
import { productsApi } from '../api/products.api';
import toast from 'react-hot-toast';
// Column lists come from the shared mirror, not hardcoded here — the previous
// hardcoded list had gone stale and showed owners the wrong format. A server-side
// test asserts this mirror matches the real importer.
import { REQUIRED_COLS, OPTIONAL_COLS, COLUMN_NOTES } from '../constants/importSchema';

// Parse CSV text into array-of-objects (header row = keys)
function parseCSVPreview(text) {
  const lines  = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows    = lines.slice(1, 6).map((line) => {
    const values = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [];
    const obj    = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] || '').trim().replace(/^"|"$/g, '');
    });
    return obj;
  });
  return { headers, rows };
}

export default function CSVImportModal({ open, onClose, onSuccess, shopId }) {
  const [file,      setFile]      = useState(null);
  const [preview,   setPreview]   = useState(null);   // { headers, rows }
  const [progress,  setProgress]  = useState(0);      // 0-100
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState(null);   // { successCount, failedCount, errors }
  const [dragging,  setDragging]  = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const inputRef = useRef();

  const reset = () => {
    setFile(null); setPreview(null); setProgress(0);
    setUploading(false); setResult(null); setDragging(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const loadFile = useCallback((f) => {
    if (!f || !f.name.endsWith('.csv')) {
      toast.error('Please select a valid .csv file');
      return;
    }
    setFile(f);
    setResult(null);
    setProgress(0);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(parseCSVPreview(e.target.result));
    reader.readAsText(f);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    loadFile(f);
  }, [loadFile]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  // Same endpoint and same helper the Inventory toolbar button uses — one code
  // path, so the file an owner gets here is byte-identical.
  const [sampleBusy, setSampleBusy] = useState(false);
  const downloadSample = async () => {
    setSampleBusy(true);
    try {
      const { filename } = await productsApi.downloadImportSample('csv');
      toast.success(`Sample saved: ${filename}`);
    } catch (err) {
      toast.error(err.message || 'Could not download the sample file');
    } finally {
      setSampleBusy(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    // Target the shop the owner is viewing. Without this the server falls back to
    // the user's FIRST shop, so a multi-shop owner silently imported into the
    // wrong catalogue.
    if (shopId) fd.append('shopId', shopId);
    setUploading(true);
    setProgress(0);
    try {
      const res = await productsApi.importCSV(fd, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
      });
      const data = res.data?.data || res.data;
      setResult(data);
      setProgress(100);
      if (data.successCount > 0) {
        toast.success(`${data.successCount} product(s) imported`);
        onSuccess?.();
      }
      if (data.failedCount > 0) {
        toast.error(`${data.failedCount} row(s) failed — see details below`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Import Products from CSV" size="lg">
      <div className="space-y-5">

        {/* ── Template hint ── */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
          <p className="font-semibold mb-1">CSV Column Format</p>
          <p className="text-xs">
            <span className="font-medium text-blue-900">Required: </span>
            {REQUIRED_COLS.join(', ')}
          </p>
          <p className="text-xs mt-0.5">
            <span className="font-medium text-blue-900">Optional: </span>
            {OPTIONAL_COLS.join(', ')}
          </p>
          {/* `variants` is the one column nobody guesses correctly. */}
          <p className="text-[11px] mt-1.5 text-blue-700">
            <span className="font-medium">variants: </span>{COLUMN_NOTES.variants}
          </p>
        </div>

        {/* ── Drop zone ── */}
        {!file && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => inputRef.current.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all
              ${dragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/40'
              }`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${dragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Upload className={`w-6 h-6 ${dragging ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">
                {dragging ? 'Drop your CSV here' : 'Drag & drop your CSV file'}
              </p>
              <p className="text-xs text-gray-400 mt-1">or click to browse • max 5 MB</p>
            </div>
            <input ref={inputRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { loadFile(e.target.files[0]); e.target.value = ''; }} />

            {/* The moment an owner needs the template is the moment they open this
                dialog and wonder what the columns should be. stopPropagation is
                required: the whole panel is a click-to-browse target. */}
            <button
              type="button"
              data-testid="modal-download-sample"
              onClick={(e) => { e.stopPropagation(); downloadSample(); }}
              disabled={sampleBusy}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 underline decoration-dotted disabled:opacity-50"
            >
              {sampleBusy ? 'Preparing sample…' : 'Not sure about the format? Download a sample CSV'}
            </button>
          </div>
        )}

        {/* ── File selected ── */}
        {file && !result && (
          <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50">
            <FileText className="w-5 h-5 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={reset} className="p-1 rounded-lg hover:bg-gray-200 transition text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Preview table (first 5 rows) ── */}
        {preview && !result && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Preview — first {preview.rows.length} row(s)
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h}
                        className={`px-3 py-2 text-left font-semibold uppercase tracking-wide whitespace-nowrap
                          ${REQUIRED_COLS.includes(h) ? 'text-blue-700' : 'text-gray-500'}`}>
                        {h}
                        {REQUIRED_COLS.includes(h) && <span className="text-red-500 ml-0.5">*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {preview.headers.map((h) => (
                        <td key={h} className="px-3 py-1.5 text-gray-700 max-w-[120px] truncate" title={row[h]}>
                          {row[h] || <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-400">Showing first 5 rows. All valid rows will be imported.</p>
          </div>
        )}

        {/* ── Upload progress ── */}
        {uploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Uploading…</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Result ── */}
        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-lg font-bold text-green-700">{result.successCount}</p>
                  <p className="text-xs text-green-600">Imported</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold text-red-600">{result.failedCount}</p>
                  <p className="text-xs text-red-500">Failed</p>
                </div>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="border border-red-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowErrors((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-red-50 text-sm font-medium text-red-700 hover:bg-red-100 transition">
                  <span>View {result.errors.length} error(s)</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showErrors ? 'rotate-180' : ''}`} />
                </button>
                {showErrors && (
                  <ul className="divide-y divide-red-100 max-h-48 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <li key={i} className="px-4 py-2 text-xs text-red-700 flex gap-2">
                        <span className="font-semibold shrink-0">Row {e.row}{e.field ? ` (${e.field})` : ''}:</span>
                        <span>{e.error}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex gap-3 pt-1">
          {result ? (
            <>
              <button onClick={reset}
                className="flex-1 h-10 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                Import Another
              </button>
              <button onClick={handleClose}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
                Done
              </button>
            </>
          ) : (
            <>
              <button onClick={handleClose}
                className="flex-1 h-10 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
                {uploading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {uploading ? 'Importing…' : 'Import Products'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
