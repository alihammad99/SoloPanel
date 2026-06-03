/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        panel: {
          bg: '#0b0d14',
          surface: '#11131c',
          card: '#13151f',
          elevated: '#181b26',
          border: '#1e2130',
          'border-hover': '#2a2e40',
          accent: '#818cf8',
          'accent-hover': '#a5b4fc',
          'accent-glow': 'rgba(129,140,248,0.12)',
          success: '#34d399',
          'success-glow': 'rgba(52,211,153,0.10)',
          warning: '#fbbf24',
          danger: '#fb7185',
          'danger-glow': 'rgba(251,113,133,0.10)',
          muted: '#6b7280',
          heading: '#e2e8f0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(129,140,248,0.08)',
        'card': '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03)',
        'elevated': '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(ellipse at top, var(--tw-gradient-stops))',
      }
    }
  },
  plugins: []
}
