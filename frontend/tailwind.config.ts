import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--bg-base)",
        foreground: "var(--text-primary)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        border: "var(--bg-border)",
        bitcoin: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        success: 'var(--green-500)',
        warning: '#f59e0b',
        error: 'var(--red-500)',
        gold: 'var(--gold)',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['Manrope', 'system-ui', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'Courier New', 'monospace'],
        sans:    ['Manrope', 'system-ui', 'sans-serif'],
      },
      animation: {
        'ticker':       'ticker 40s linear infinite',
        'price-up':     'priceUp 1.5s ease forwards',
        'price-down':   'priceDown 1.5s ease forwards',
        'ring':         'ring 2s infinite',
        'slide-in':     'slideInUp 0.25s ease forwards',
        'slideInUp':    'slideInUp 0.25s ease forwards',
        'card-in':      'cardIn 0.3s ease forwards',
        'shimmer':      'shimmer 0.5s ease forwards',
      },
      keyframes: {
        ticker:    { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        priceUp:   { '0%': { color: 'var(--green-500)' }, '100%': { color: 'inherit' } },
        priceDown: { '0%': { color: 'var(--red-500)' },   '100%': { color: 'inherit' } },
        ring: {
          '0%':   { boxShadow: '0 0 0 0 var(--orange-glow)' },
          '70%':  { boxShadow: '0 0 0 8px transparent' },
          '100%': { boxShadow: '0 0 0 0 transparent' },
        },
        slideInUp: {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        cardIn: {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      boxShadow: {
        'orange-glow': '0 0 20px var(--orange-glow)',
        'card-hover':  '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
export default config;
