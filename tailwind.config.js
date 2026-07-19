/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './sasebo.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#04070f',
          900: '#070c1a',
          800: '#0b1226',
          700: '#101a36',
          600: '#182548',
        },
        sunrise: {
          400: '#fbbf6d',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
      },
      fontFamily: {
        display: ['"Hiragino Sans"', '"Yu Gothic"', '"Meiryo"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'sunrise-gradient': 'linear-gradient(135deg, #f97316 0%, #fb923c 45%, #fbbf6d 100%)',
      },
    },
  },
  plugins: [],
}
