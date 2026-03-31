import { useState, useEffect } from 'react';
import { Tag, Timer, X, ChevronRight } from 'lucide-react';

// ── Preset templates ──────────────────────────────────────────────────────────
export const BANNER_TEMPLATES = [
  { id: 'diwali',   title: '🪔 Diwali Sale',      subtitle: 'Celebrate with savings!', discount: '30% OFF',    theme: 'orange' },
  { id: 'weekend',  title: '🎉 Weekend Deal',      subtitle: 'This weekend only',        discount: '20% OFF',    theme: 'purple' },
  { id: 'grocery',  title: '🛒 Fresh Grocery Sale', subtitle: 'Daily essentials cheaper', discount: 'Flat ₹50 OFF', theme: 'green'  },
  { id: 'fashion',  title: '👗 Fashion Fiesta',     subtitle: 'New arrivals, big discounts', discount: '40% OFF', theme: 'red'    },
  { id: 'clearance',title: '📦 Clearance Sale',    subtitle: 'Limited stock — grab fast!', discount: 'Up to 50% OFF', theme: 'blue' },
];

// ── Theme definitions ─────────────────────────────────────────────────────────
const THEMES = {
  blue:   { bg: 'from-blue-600 to-blue-800',    badge: 'bg-blue-500/30 border-blue-400/50',   text: 'text-white' },
  orange: { bg: 'from-orange-500 to-red-600',   badge: 'bg-orange-400/30 border-orange-300/50', text: 'text-white' },
  green:  { bg: 'from-emerald-500 to-teal-700', badge: 'bg-emerald-400/30 border-emerald-300/50', text: 'text-white' },
  purple: { bg: 'from-purple-600 to-indigo-700',badge: 'bg-purple-400/30 border-purple-300/50', text: 'text-white' },
  red:    { bg: 'from-rose-600 to-pink-700',    badge: 'bg-rose-400/30 border-rose-300/50',   text: 'text-white' },
};

// ── Countdown Timer ───────────────────────────────────────────────────────────
function CountdownTimer({ endDate }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        h > 0
          ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-1.5 bg-black/20 rounded-lg px-2.5 py-1 text-white/90">
      <Timer className="w-3.5 h-3.5 shrink-0" />
      <span className="text-xs font-bold font-mono">Ends in {timeLeft}</span>
    </div>
  );
}

// ── Sale Banner ───────────────────────────────────────────────────────────────
export default function SaleBanner({ banner, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);

  if (!banner?.enabled || dismissed) return null;

  // If endDate is past, don't show
  if (banner.endDate && new Date(banner.endDate) < new Date()) return null;

  const theme = THEMES[banner.theme] || THEMES.blue;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={`relative w-full bg-gradient-to-r ${theme.bg} rounded-2xl overflow-hidden shadow-lg`}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white" />
        <div className="absolute top-4 right-24 w-12 h-12 rounded-full bg-white" />
      </div>

      <div className="relative flex items-center justify-between px-5 py-4 gap-4">
        {/* Left: discount badge + text */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Discount badge */}
          {banner.discount && (
            <div className={`shrink-0 border rounded-xl px-3 py-2 text-center ${theme.badge}`}>
              <div className="flex items-center gap-1 text-white">
                <Tag className="w-3 h-3" />
                <span className="text-xs font-bold whitespace-nowrap">{banner.discount}</span>
              </div>
            </div>
          )}

          {/* Title + subtitle */}
          <div className="min-w-0">
            <p className="font-bold text-white text-base leading-tight truncate">{banner.title}</p>
            {banner.subtitle && (
              <p className="text-white/80 text-xs mt-0.5 truncate">{banner.subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: countdown + close */}
        <div className="flex items-center gap-2 shrink-0">
          {banner.endDate && <CountdownTimer endDate={banner.endDate} />}
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
            title="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
