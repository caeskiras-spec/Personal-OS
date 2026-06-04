/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        // ── Brand / accent (fixed, support opacity via Tailwind auto) ──
        accent:        '#6c63ff',
        'accent-light':'#8b85ff',
        success:       '#22c55e',
        warning:       '#f59e0b',
        danger:        '#ef4444',

        // ── Theme-adaptive (RGB format for opacity modifier support) ──
        bg:      'rgb(var(--bg-rgb)      / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        muted:   'rgb(var(--muted-rgb)   / <alpha-value>)',
        subtle:  'rgb(var(--subtle-rgb)  / <alpha-value>)',
        text:    'rgb(var(--text-rgb)    / <alpha-value>)',
        border:  'rgb(var(--border-rgb)  / <alpha-value>)',

        // ── Additional surface/bg tokens (no opacity needed) ──────────
        card:           'var(--color-card)',
        panel:          'var(--color-panel)',
        'bg-2':         'var(--color-bg-2)',
        'surface-2':    'var(--color-surface-2)',
        'surface-3':    'var(--color-surface-3)',

        // ── Additional border tokens ───────────────────────────────────
        'border-1':     'var(--color-border-1)',
        'border-2':     'var(--color-border-2)',
        'border-hover': 'var(--color-border-hover)',

        // ── Additional text tokens ─────────────────────────────────────
        'text-2':       'var(--color-text-2)',
        'text-3':       'var(--color-text-3)',
        'text-4':       'var(--color-text-4)',
        'text-6':       'var(--color-text-6)',
        'text-7':       'var(--color-text-7)',
        'text-8':       'var(--color-text-8)',
        'text-9':       'var(--color-text-9)',

        // ── State tokens ───────────────────────────────────────────────
        'card-selected':'var(--color-card-selected)',
        'card-accent':  'var(--color-card-accent)',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease',
        'slide-up':   'slideUp 0.3s ease',
        'pulse-slow': 'pulse 3s infinite'
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } }
      }
    }
  },
  plugins: []
}
