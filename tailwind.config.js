/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        'primary-light': '#3B82F6',
        'primary-dark': '#1E3A8A',
      }
    },
  },
  plugins: [],
}