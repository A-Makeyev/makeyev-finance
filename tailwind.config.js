/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'soft-white': 'aliceblue',
        'soft-red': 'rgb(210 60 60)',
        'soft-black': 'rgb(15 15 15)',
        'soft-blue': 'rgb(35 170 222)',
        'soft-green': 'rgb(35 185 55)',
        'soft-grey': 'rgb(200 200 200)',
        'soft-yellow': 'rgb(250 205 5)',
        'soft-orange': 'rgb(255 125 80)',
        'soft-dark-blue': 'rgb(65 120 235)',
        'soft-dark-grey': 'rgb(100 100 100)',
        calc: {
          ink: '#163235',
          muted: '#6b7f7d',
          teal: '#087f78',
          'teal-dark': '#07514f',
          accent: '#0aa89f',
          'accent-dark': '#08847c',
          paper: '#fffdf8',
          line: '#dbe5df',
          page: '#f1f5ef',
        },
      },
      fontFamily: {
        lato: ['Lato', 'sans-serif'],
        heebo: ['Heebo', 'sans-serif'],
      },
      boxShadow: {
        red: '0.5px 1px 1px 0.5px rgb(210 60 60)',
        blue: '0.5px 1px 1px 0.5px rgb(35 170 222)',
        black: '0.5px 1px 1px 0.5px rgb(15 15 15)',
        white: '0.5px 1px 1px 0.5px aliceblue',
      },
      keyframes: {
        shine: {
          to: { 'background-position': '200% center' },
        },
        spinRight: {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        spinLeft: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(720deg)' },
        },
      },
      animation: {
        shine: 'shine 1s',
        'spin-right': 'spinRight 1s linear infinite',
        'spin-left': 'spinLeft 1s linear infinite',
      },
    },
  },
  plugins: [],
}
