/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#0db9f2',
        'bg-dark': '#101e22',
        'bg-card': '#162a30',
        'bg-elevated': '#1e3840',
        'border-subtle': 'rgba(13, 185, 242, 0.12)',
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
