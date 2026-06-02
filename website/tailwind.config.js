/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eafff0',
          100: '#c8ffd6',
          200: '#95ffae',
          300: '#53ff80',
          400: '#1dfa5f',
          500: '#05e34e',
          600: '#00b83d',
          700: '#039233',
          800: '#0a732c',
          900: '#0a5f27',
        },
        surface: {
          0: '#0f0f11',
          1: '#18181b',
          2: '#232326',
          3: '#2a2a2e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
