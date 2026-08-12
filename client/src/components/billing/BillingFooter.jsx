import { Wifi, WifiOff } from 'lucide-react';

const SHORTCUTS = [
  { key: 'F1', desc: 'Find Product' },
  { key: 'F2', desc: 'Find Cust' },
  { key: 'F3', desc: 'Apply Disc' },
  { key: 'F4-F7', desc: 'Pay Cash-Credit' },
  { key: 'F8', desc: 'UPI QR' },
  { key: 'Ctrl+B', desc: 'New Bill' },
  { key: 'Ctrl+↵', desc: 'Complete' },
  { key: 'Ctrl+D', desc: 'Delete' },
  { key: 'Ctrl+P', desc: 'Print' },
  { key: 'Esc', desc: 'Cancel' },
];

export default function BillingFooter({ isOnline }) {
  return (
    <footer className="shrink-0 bg-white text-gray-600 border-t border-gray-200 px-5 py-2.5 flex items-center justify-between text-xs select-none z-20">
      {/* Keyboard Shortcuts Cheat Sheet */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
        <span className="text-[10px] font-extrabold uppercase text-gray-500 tracking-wider">Shortcuts:</span>
        {SHORTCUTS.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono text-[10px] font-bold text-white shadow-sm">
              {s.key}
            </kbd>
            <span className="text-gray-400 font-medium">{s.desc}</span>
          </div>
        ))}
      </div>

      {/* Network Connectivity Status Badge */}
      <div className="flex items-center gap-1.5 shrink-0 ml-4">
        {isOnline ? (
          <span className="inline-flex items-center gap-1 text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 font-semibold px-2 py-0.5 rounded-full">
            <Wifi className="w-3 h-3" /> Online Mode
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 font-semibold px-2 py-0.5 rounded-full animate-pulse">
            <WifiOff className="w-3 h-3 animate-bounce" /> Offline Mode
          </span>
        )}
      </div>
    </footer>
  );
}
