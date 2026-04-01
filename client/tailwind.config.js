/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand (driven by --color-primary CSS var) ──────────────
        primary: {
          DEFAULT: 'var(--color-primary)',
          light:   'var(--color-primary-light)',
          hover:   'var(--color-primary-hover)',
          bg:      'var(--color-primary-bg)',
        },

        // ── Status ────────────────────────────────────────────────
        success: { DEFAULT: 'var(--color-success)', bg: 'var(--color-success-bg)' },
        warning: { DEFAULT: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
        danger:  { DEFAULT: 'var(--color-danger)',  bg: 'var(--color-danger-bg)'  },
        info:    { DEFAULT: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },

        // ── Semantic surfaces (auto-switch in dark mode) ───────────
        app: {
          bg:     'var(--color-bg)',
          card:   'var(--color-card)',
          input:  'var(--color-input)',
          border: 'var(--color-border)',
          text:   'var(--color-text)',
          muted:  'var(--color-text-muted)',
          secondary: 'var(--color-text-secondary)',
        },
      },

      // ── Box shadows from tokens ───────────────────────────────────
      boxShadow: {
        token:    'var(--shadow-sm)',
        'token-md': 'var(--shadow-md)',
        'token-lg': 'var(--shadow-lg)',
        colored:  'var(--shadow-colored)',
      },

      // ── Border radius from tokens ─────────────────────────────────
      borderRadius: {
        token:    'var(--radius)',
        'token-md': 'var(--radius-md)',
        'token-lg': 'var(--radius-lg)',
      },

      // ── Transition ────────────────────────────────────────────────
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // ── Animations ───────────────────────────────────────────────
      keyframes: {
        'slide-up': {
          '0%':   { transform: 'translateY(40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-in':  'fade-in 0.2s ease-out',
      },

      // ── Screen sizes (adds dvh support) ──────────────────────────
      height: {
        'dvh': '100dvh',
        'svh': '100svh',
        'lvh': '100lvh',
      },
      minHeight: {
        'dvh': '100dvh',
      },

      // ── Font ─────────────────────────────────────────────────────
      fontFamily: {
        sans: [
          'Inter', 'ui-sans-serif', 'system-ui', '-apple-system',
          'BlinkMacSystemFont', 'Segoe UI', 'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
