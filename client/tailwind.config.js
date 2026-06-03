/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        panel: {
          bg: '#080a10',
          surface: '#0d0f18',
          card: '#0f1119',
          elevated: '#141720',
          sidebar: '#0a0c15',
          border: '#1a1d2e',
          'border-hover': '#252840',
          accent: '#3b82f6',
          'accent-dim': '#2563eb',
          'accent-hover': '#60a5fa',
          'accent-glow': 'rgba(59,130,246,0.15)',
          success: '#34d399',
          'success-dim': '#10b981',
          'success-glow': 'rgba(52,211,153,0.12)',
          warning: '#fbbf24',
          'warning-dim': '#f59e0b',
          danger: '#fb7185',
          'danger-dim': '#f43f5e',
          'danger-glow': 'rgba(251,113,133,0.12)',
          info: '#38bdf8',
          'info-glow': 'rgba(56,189,248,0.12)',
          muted: '#4b5268',
          'muted-bright': '#6b7280',
          heading: '#e8eaf2',
          subtext: '#9ca3af',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(59,130,246,0.08)',
        'glow': '0 0 24px rgba(59,130,246,0.12)',
        'glow-lg': '0 0 48px rgba(59,130,246,0.16)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.025)',
        'card-hover': '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.1)',
        'elevated': '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        'inner-top': 'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(ellipse at top, var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'slide-in': { from: { opacity: 0, transform: 'translateX(-8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(0.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
        'shimmer': { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-ring': { '0%, 100%': { boxShadow: '0 0 0 0 currentColor' }, '50%': { boxShadow: '0 0 0 4px transparent' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
        'scale-in': 'scale-in 0.15s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
    }
  },
  plugins: []
}
