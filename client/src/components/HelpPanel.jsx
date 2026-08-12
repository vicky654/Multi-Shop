/**
 * HelpPanel — floating ? button + slide-in help panel.
 *
 * Desktop: slides in from the right (w-80).
 * Mobile:  full-screen bottom sheet.
 *
 * Includes:
 *  - How Billing Works
 *  - How Products Work
 *  - How AI Insights Work
 *  - FAQs
 *  - Shareable messages (WhatsApp / Professional / Short)
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle, X, ShoppingCart, Package, Zap,
  MessageSquare, ChevronDown, ChevronUp, Copy, Check, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Content ───────────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id:    'billing',
    icon:  ShoppingCart,
    color: 'blue',
    title: 'How Billing Works',
    steps: [
      'Go to Billing → products appear in the left grid',
      'Click any product to add it to your cart',
      'Apply per-item discounts (% or flat amount)',
      'Choose payment: Cash, Card, UPI, or Credit',
      'Press Pay → invoice is auto-generated & stored',
      'Print or share the invoice via WhatsApp',
    ],
  },
  {
    id:    'products',
    icon:  Package,
    color: 'purple',
    title: 'How Products Work',
    steps: [
      'Go to Inventory → click "Add Product"',
      'Set the selling price, cost price, and stock',
      'Add sizes, colors, and up to 5 images',
      'Use "Add by Photo" to auto-fill details with AI',
      'Bulk import hundreds of products via CSV upload',
      'Low-stock alerts fire when stock drops below threshold',
    ],
  },
  {
    id:    'ai',
    icon:  Zap,
    color: 'violet',
    title: 'How AI Insights Work',
    steps: [
      'AI analyses your last 90 days of sales data',
      'Shows frequently bought together products in billing',
      'Suggests top sellers and slow-moving stock',
      'Helps you decide what to restock and what to discount',
      'Updates automatically as you record more sales',
    ],
  },
  {
    id:    'faq',
    icon:  MessageSquare,
    color: 'gray',
    title: 'FAQs',
    faqs: [
      { q: 'Can I manage multiple shops?',           a: 'Yes! Use the shop switcher in the sidebar to switch between shops anytime.' },
      { q: 'Is my data safe?',                       a: 'Yes. Private sales are excluded from all reports. Your data is never shared with any authority.' },
      { q: 'How does Private Mode work?',            a: 'Toggle "Private Sale" before checkout. That sale will be stored but hidden from reports and dashboards.' },
      { q: 'Can staff see all data?',                a: 'No. Use Roles to control exactly what each staff member can see and do.' },
      { q: 'What is the Daily Closing Summary?',     a: 'Click "Close Day" in billing to see today\'s revenue, profit, top product, and payment breakdown. Share via WhatsApp.' },
    ],
  },
];

const SHARE_MSGS = [
  {
    label:   'WhatsApp / Casual',
    emoji:   '💬',
    color:   'emerald',
    content: 'Bhai ek mast app banaya hai shop ke liye 😄\nBilling, stock aur daily earning sab easy ho jata hai.\nAur AI bhi batata hai kya restock kare aur kya discount de 🤯\nEk baar try kar, kaafi useful hai.',
  },
  {
    label:   'Professional',
    emoji:   '💼',
    color:   'blue',
    content: "I've built a simple POS system for shop owners.\nIt helps manage billing, inventory, and daily sales with smart AI insights.\nWould love for you to try it and share feedback.",
  },
  {
    label:   'Short & Sweet',
    emoji:   '✨',
    color:   'violet',
    content: 'Simple POS app – billing + stock + profit tracking. Try once 👍',
  },
];

const COLOR_MAP = {
  blue:   { icon: 'bg-blue-100 text-blue-600',   bullet: 'bg-blue-400'   },
  purple: { icon: 'bg-purple-100 text-purple-600', bullet: 'bg-purple-400' },
  violet: { icon: 'bg-violet-100 text-violet-600', bullet: 'bg-violet-400' },
  gray:   { icon: 'bg-gray-100 text-gray-600',   bullet: 'bg-gray-400'   },
};

// ── Accordion section ─────────────────────────────────────────────────────────
function Section({ section }) {
  const [open, setOpen] = useState(false);
  const c = COLOR_MAP[section.color];
  const Icon = section.icon;

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition text-left"
      >
        <span className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${c.icon}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="flex-1 text-sm font-semibold text-gray-800">{section.title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{   height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 bg-gray-50 space-y-2">
              {section.steps?.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${c.bullet}`} />
                  <p className="text-xs text-gray-600 leading-relaxed">{s}</p>
                </div>
              ))}
              {section.faqs?.map((faq, i) => (
                <div key={i} className="rounded-xl bg-white p-3 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-800 mb-1">Q: {faq.q}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shareable message card ────────────────────────────────────────────────────
function ShareCard({ msg }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied!');
    });
  };

  const COLOR = {
    emerald: 'bg-emerald-50 border-emerald-200',
    blue:    'bg-blue-50 border-blue-200',
    violet:  'bg-violet-50 border-violet-200',
  };

  return (
    <div className={`rounded-2xl border p-3 ${COLOR[msg.color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700">{msg.emoji} {msg.label}</span>
        <button onClick={copy}
          className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-800 transition">
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{msg.content}</p>
    </div>
  );
}

// ── Build flat searchable items from all sections ─────────────────────────────
const SEARCH_INDEX = [
  ...SECTIONS.flatMap((s) => [
    ...(s.steps || []).map((step) => ({ text: step, section: s.title, sectionId: s.id })),
    ...(s.faqs  || []).flatMap((faq) => [
      { text: faq.q, answer: faq.a, section: s.title, sectionId: s.id },
      { text: faq.a, section: s.title, sectionId: s.id },
    ]),
  ]),
];

// ── Main component ────────────────────────────────────────────────────────────
export default function HelpPanel() {
  const [open,    setOpen]    = useState(false);
  const [tabIdx,  setTabIdx]  = useState(0);
  const [query,   setQuery]   = useState('');

  const TABS = ['Guide', 'Search', 'Share'];

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX.filter((item) =>
      item.text.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query]);

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.92 }}
        aria-label="Help"
        className={`nav-fab fixed bottom-20 right-4 md:bottom-6 z-40 w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all ${
          open
            ? 'bg-gray-900 text-white shadow-black/30'
            : 'bg-white border border-gray-200 text-gray-600 shadow-gray-200/80 hover:bg-gray-50'
        }`}
      >
        {open ? <X className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0,      opacity: 1 }}
              exit={{   x: '100%',  opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className={[
                'fixed z-50 bg-white shadow-2xl shadow-black/10 flex flex-col',
                // Desktop: right panel
                'md:top-0 md:right-0 md:h-full md:w-80 md:border-l md:border-gray-100',
                // Mobile: bottom sheet
                'bottom-0 left-0 right-0 rounded-t-3xl md:rounded-none',
                'h-[88vh] md:h-full',
              ].join(' ')}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <div>
                  <h3 className="font-bold text-gray-900">Help & Guide</h3>
                  <p className="text-xs text-gray-400">Everything you need to know</p>
                </div>
                <button onClick={() => setOpen(false)}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-4 pt-3 pb-2 shrink-0">
                {TABS.map((t, i) => (
                  <button key={t} onClick={() => setTabIdx(i)}
                    className={`flex-1 h-8 rounded-xl text-xs font-bold transition ${
                      tabIdx === i
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2.5 scrollbar-thin">
                {tabIdx === 0 ? (
                  SECTIONS.map((s) => <Section key={s.id} section={s} />)
                ) : tabIdx === 1 ? (
                  <>
                    {/* Search box */}
                    <div className="relative sticky top-0 pt-1 pb-2 bg-white">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 mt-0.5" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder='e.g. "How to add product?"'
                        className="w-full h-9 pl-9 pr-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        autoFocus
                      />
                      {query && (
                        <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-gray-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Results */}
                    {!query ? (
                      <p className="text-xs text-gray-400 text-center pt-6">
                        Type to search across all help topics
                      </p>
                    ) : searchResults.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center pt-6">
                        No results for "{query}"
                      </p>
                    ) : (
                      searchResults.map((r, i) => (
                        <div key={i} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                            {r.section}
                          </p>
                          <p className="text-xs text-gray-700 leading-relaxed">
                            {r.answer ? <><strong>Q:</strong> {r.text}</> : r.text}
                          </p>
                          {r.answer && (
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                              <strong>A:</strong> {r.answer}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 pt-1">
                      Copy a message to share MultiShop with others:
                    </p>
                    {SHARE_MSGS.map((m) => <ShareCard key={m.label} msg={m} />)}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 px-4 py-3 border-t border-gray-50">
                <p className="text-[10px] text-center text-gray-300">MultiShop POS · Made with ❤️ for shop owners</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
