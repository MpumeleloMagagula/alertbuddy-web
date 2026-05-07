/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        surface: 'var(--surface)',
        card: 'var(--card)',
        critical: '#ef4444',
        warning: '#f97316',
        info: '#3b82f6',
        success: '#22c55e',
      },
    },
  },
  plugins: [],
}
