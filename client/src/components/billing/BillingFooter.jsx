import { Wifi, WifiOff } from 'lucide-react';

const SHORTCUTS = [
  { key: 'F1', desc: 'Find Product' },
  { key: 'F2', desc: 'Find Cust' },
  { key: 'F3', desc: 'Apply Disc' },
  { key: 'F4-F7', desc: 'Pay Cash-Credit' },
  { key: 'F8', desc: 'UPI QR' },
  { key: 'Ctrl+B', desc: 'New Bill' },
  { key: 'Ctrl+Enter', desc: 'Complete' },
  { key: 'Ctrl+D', desc: 'Delete' },
  { key: 'Ctrl+P', desc: 'Print' },
  { key: 'Esc', desc: 'Cancel' },
];

export default function BillingFooter({ isOnline }) {
  return (
    <footer className="shrink-0 bg-[var(--color-card)] text-[var(--color-text-secondary)] border-t border-[var(--color-border)] px-5 py-2.5 flex items-center justify-between text-xs select-none z-20">
      {/* Keyboard Shortcuts Cheat Sheet */}
      <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
        <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-wider">Shortcuts:</span>
        {SHORTCUTS.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 bg-slate-800 dark:bg-slate-700 text-slate-100 border border-slate-700 rounded font-mono text-[10px] font-bold shadow-sm">
              {s.key}
            </kbd>
            <span className="text-[var(--color-text-secondary)] font-medium text-[11px]">{s.desc}</span>
          </div>
        ))}
      </div>

      {/* Network Connectivity Status Badge */}
      <div className="flex items-center gap-1.5 shrink-0 ml-4">
        {isOnline ? (
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-0.5 rounded-full">
            <Wifi className="w-3 h-3" /> Online Mode
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold px-2.5 py-0.5 rounded-full">
            <WifiOff className="w-3 h-3 animate-pulse" /> Offline Mode
          </span>
        )}
      </div>
    </footer>
  );
}
