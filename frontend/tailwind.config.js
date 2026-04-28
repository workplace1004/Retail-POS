/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pos: {
          bg: '#2c3e50',
          panel: '#34495e',
          surface: '#7f8c8d',
          'surface-hover': '#95a5a6',
          text: '#ecf0f1',
          muted: '#95a5a6',
          'text-dim': '#bdc3c7',
          border: '#34495e',
          dark: '#1a252f',
          danger: '#e74c3c',
          rowHover: '#3d566e',
          inputBorder: '#4a6278',
        },
      },
    },
  },
  plugins: [],
};
