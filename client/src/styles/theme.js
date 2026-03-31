/**
 * MultiShop Design Tokens — JS side
 * Use for runtime values (charts, canvas, inline styles).
 * CSS classes and Tailwind utilities are preferred for static styles.
 *
 * All values mirror the CSS custom properties in index.css.
 */

// ── Primary color presets ──────────────────────────────────────────────────
export const PRIMARY_PRESETS = [
  { id: 'indigo',  name: 'Indigo',   value: '#4F46E5', hover: '#4338CA' },
  { id: 'blue',    name: 'Blue',     value: '#2563EB', hover: '#1D4ED8' },
  { id: 'violet',  name: 'Violet',   value: '#7C3AED', hover: '#6D28D9' },
  { id: 'rose',    name: 'Rose',     value: '#E11D48', hover: '#BE123C' },
  { id: 'emerald', name: 'Emerald',  value: '#059669', hover: '#047857' },
  { id: 'amber',   name: 'Amber',    value: '#D97706', hover: '#B45309' },
  { id: 'cyan',    name: 'Cyan',     value: '#0891B2', hover: '#0E7490' },
  { id: 'pink',    name: 'Pink',     value: '#DB2777', hover: '#BE185D' },
];

// ── Static color constants (light theme values) ───────────────────────────
export const COLORS = {
  primary:  '#4F46E5',
  success:  '#22C55E',
  warning:  '#F59E0B',
  danger:   '#EF4444',
  info:     '#3B82F6',

  light: {
    bg:        '#F9FAFB',
    card:      '#FFFFFF',
    border:    '#E5E7EB',
    text:      '#111827',
    secondary: '#4B5563',
    muted:     '#9CA3AF',
  },

  dark: {
    bg:        '#0F172A',
    card:      '#1E293B',
    border:    '#334155',
    text:      '#E2E8F0',
    secondary: '#94A3B8',
    muted:     '#64748B',
  },
};

// ── Chart palette (consistently used across recharts) ─────────────────────
export const CHART_COLORS = [
  '#4F46E5', '#22C55E', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#F97316', '#EC4899',
];

// ── Status severity → color map ────────────────────────────────────────────
export const SEVERITY_COLORS = {
  error:   { text: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  warning: { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  success: { text: '#059669', bg: '#F0FDF4', border: '#A7F3D0' },
  info:    { text: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
};

// ── Typography scale ───────────────────────────────────────────────────────
export const TYPOGRAPHY = {
  heading:    'text-2xl font-semibold tracking-tight',
  subheading: 'text-lg font-semibold',
  title:      'text-base font-semibold',
  body:       'text-sm font-normal',
  caption:    'text-xs text-app-muted',
  label:      'text-xs font-medium text-app-secondary uppercase tracking-wide',
};

// ── Helper — read current primary from CSS var (runtime) ──────────────────
export const getCurrentPrimary = () =>
  getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary')
    .trim() || COLORS.primary;
