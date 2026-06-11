/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        clinic: {
          red: '#D32F2F',      // Rojo médico elegante
          redDark: '#9A0007',  // Rojo profundo
          white: '#FFFFFF',    // Blanco puro
          bg: '#F9FAFB',       // Fondo grisáceo suave
        },
      },
      boxShadow: {
        'luxury': '0 4px 20px 0 rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}