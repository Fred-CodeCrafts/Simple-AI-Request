/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design system palette
        brand: {
          red: '#B91C1C',
          'red-dark': '#991B1B',
        },
        surface: {
          bg: '#F3F4F6',
          card: '#FFFFFF',
        },
        text: {
          primary: '#111827',
          secondary: '#374151',
          muted: '#9CA3AF',
        },
        border: {
          DEFAULT: '#E5E7EB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
