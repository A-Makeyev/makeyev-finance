import type { Config } from 'tailwindcss'

/**
 * Same design tokens as the Vite app's tailwind.config.js. The theme-role
 * channels (--surface-*, --ink-*, --line-*) live in src/styles/globals.css and
 * flip with data-theme, so dark mode comes for free.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
        surface: {
          page: 'var(--surface-page)',
          card: 'var(--surface-card)',
          soft: 'var(--surface-soft)',
          // For controls that sit ON a card; dark theme lifts it above the
          // card, since --surface-page is darker there.
          raised: 'var(--surface-raised)',
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

export default config
