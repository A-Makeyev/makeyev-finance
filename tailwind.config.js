/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette. These are the same in both themes - they are hues
        // (links, accents, the error red), not surfaces. `soft-grey` and
        // `soft-dark-grey` are the exception: they are the muted-text /
        // divider roles, so they read from the theme-aware channel vars
        // defined in client/src/globals.css.
        'soft-white': 'aliceblue',
        'soft-red': 'rgb(210 60 60)',
        'soft-black': 'rgb(15 15 15)',
        'soft-blue': 'rgb(35 170 222)',
        'soft-green': 'rgb(35 185 55)',
        'soft-grey': 'rgb(var(--soft-grey-rgb) / <alpha-value>)',
        'soft-yellow': 'rgb(250 205 5)',
        'soft-orange': 'rgb(255 125 80)',
        'soft-dark-blue': 'rgb(65 120 235)',
        'soft-dark-grey': 'rgb(var(--soft-dark-grey-rgb) / <alpha-value>)',
        // Theme roles (see the THEME ROLES block in globals.css). Use these
        // for new UI - `bg-surface-card`, `text-ink`, `border-line-strong` -
        // and dark mode comes for free.
        surface: {
          page: 'var(--surface-page)',
          card: 'var(--surface-card)',
          soft: 'var(--surface-soft)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink-rgb) / <alpha-value>)',
          muted: 'rgb(var(--soft-dark-grey-rgb) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'var(--hairline)',
          strong: 'var(--line-strong)',
          soft: 'var(--line-soft)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          strong: 'var(--danger-strong)',
        },
        calc: {
          ink: 'var(--calc-ink)',
          muted: 'var(--calc-muted)',
          teal: 'var(--calc-teal)',
          'teal-dark': 'var(--calc-teal-dark)',
          accent: 'var(--calc-accent)',
          'accent-dark': 'var(--calc-accent-dark)',
          paper: 'var(--calc-paper)',
          line: 'var(--calc-line)',
          page: 'var(--calc-page)',
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
