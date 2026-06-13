/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        clinic: {
          red:      '#D32F2F',  // Rojo principal
          redDark:  '#9A0007',  // Rojo profundo (hover)
          redMid:   '#EF5350',  // Rojo medio (estados intermedios)
          redLight: '#FFCDD2',  // Fondo rojo muy suave
          redSoft:  '#FFEBEE',  // Fondo rojo mínimo
          white:    '#FFFFFF',
          bg:       '#F9FAFB',  // Fondo principal
          bgDark:   '#F3F4F6',  // Fondo alternativo
        },
      },
      boxShadow: {
        'luxury':  '0 4px 20px 0 rgba(0, 0, 0, 0.05)',
        'card':    '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)',
        'clinic':  '0 4px 16px 0 rgba(211,47,47,0.20)',
      },
      borderRadius: {
        '2.5xl': '1.25rem',
        '3xl':   '1.5rem',
        '4xl':   '2rem',
        '5xl':   '2.5rem',
      },
      screens: {
        'xs': '375px',
      },
    },
  },
  plugins: [],
}
