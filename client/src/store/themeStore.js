import { create } from 'zustand';
import { PRIMARY_PRESETS } from '../styles/theme';

const STORAGE_KEY = 'ms_theme_prefs';

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
};
const save = (patch) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...load(), ...patch }));
};

// ── Helpers ───────────────────────────────────────────────────────────────
const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
};

// Darken a hex colour by `amount` (0–1)
const darken = (hex, amount = 0.1) => {
  const { r, g, b } = hexToRgb(hex);
  const d = (v) => Math.max(0, Math.round(v * (1 - amount)));
  return `#${d(r).toString(16).padStart(2,'0')}${d(g).toString(16).padStart(2,'0')}${d(b).toString(16).padStart(2,'0')}`;
};

// Lighten a hex colour to a very pale tint (for primary-bg)
const tint = (hex, opacity = 0.12) =>
  `color-mix(in srgb, ${hex} ${Math.round(opacity * 100)}%, white)`;

const applyPrimaryColor = (color) => {
  const root = document.documentElement;
  root.style.setProperty('--color-primary',       color);
  root.style.setProperty('--color-primary-hover',  darken(color, 0.08));
  root.style.setProperty('--color-primary-light',  darken(color, -0.2)); // lighter
  root.style.setProperty('--color-primary-bg',     tint(color, 0.12));
  root.style.setProperty('--shadow-colored',
    `0 4px 14px color-mix(in srgb, ${color} 40%, transparent)`
  );
};

const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
};

const applyCompact = (compact) =>
  document.documentElement.classList.toggle('compact', compact);

/**
 * Where the primary navigation sits. Persisted alongside the other appearance
 * preferences so it survives reloads like theme and accent colour do.
 *
 * Only honoured from `lg:` upward. Below that the sidebar is already an overlay
 * drawer paired with BottomNav, and that mobile pattern is the right one
 * regardless of the desktop choice — re-anchoring it would break navigation on
 * the smallest screens to serve a preference that only makes sense on large ones.
 */
export const SIDEBAR_POSITIONS = ['left', 'right', 'top', 'bottom'];

const applySidebarPosition = (pos) => {
  const root = document.documentElement;
  SIDEBAR_POSITIONS.forEach((p) => root.classList.remove(`nav-${p}`));
  root.classList.add(`nav-${SIDEBAR_POSITIONS.includes(pos) ? pos : 'left'}`);
};

// ── Store ─────────────────────────────────────────────────────────────────
const useThemeStore = create((set) => {
  const stored = load();

  const initialTheme   = stored.theme        || 'light';
  const initialCompact = stored.compact      || false;
  const initialPrimary = stored.primaryColor || '#4F46E5';
  const initialSidebar = SIDEBAR_POSITIONS.includes(stored.sidebarPosition)
    ? stored.sidebarPosition
    : 'left';

  // Apply all on boot
  applyTheme(initialTheme);
  applyCompact(initialCompact);
  applyPrimaryColor(initialPrimary);
  applySidebarPosition(initialSidebar);

  return {
    theme:        initialTheme,
    compact:      initialCompact,
    primaryColor: initialPrimary,
    sidebarPosition: initialSidebar,

    setTheme: (theme) => {
      applyTheme(theme);
      save({ theme });
      set({ theme });
    },

    setCompact: (compact) => {
      applyCompact(compact);
      save({ compact });
      set({ compact });
    },

    setSidebarPosition: (pos) => {
      const next = SIDEBAR_POSITIONS.includes(pos) ? pos : 'left';
      applySidebarPosition(next);
      save({ sidebarPosition: next });
      set({ sidebarPosition: next });
    },

    setPrimaryColor: (color) => {
      applyPrimaryColor(color);
      save({ primaryColor: color });
      set({ primaryColor: color });
    },

    // Reset to defaults
    reset: () => {
      const defaults = { theme: 'light', compact: false, primaryColor: '#4F46E5', sidebarPosition: 'left' };
      applyTheme(defaults.theme);
      applyCompact(defaults.compact);
      applyPrimaryColor(defaults.primaryColor);
      applySidebarPosition(defaults.sidebarPosition);
      save(defaults);
      set(defaults);
    },
  };
});

// Keep system theme in sync with OS preference
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { theme } = useThemeStore.getState();
  if (theme === 'system') applyTheme('system');
});

export default useThemeStore;
