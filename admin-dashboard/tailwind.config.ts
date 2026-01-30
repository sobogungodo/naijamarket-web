import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nigerian flag colors
        'naija-green': {
          50: '#e6f5ed',
          100: '#b3e0c7',
          200: '#80cca1',
          300: '#4db87b',
          400: '#1aa355',
          500: '#008751', // Primary green
          600: '#006b41',
          700: '#005030',
          800: '#003520',
          900: '#001a10',
        },
        'naija-gold': {
          50: '#fff9e6',
          100: '#fef0b3',
          200: '#fde780',
          300: '#fcde4d',
          400: '#fcd116', // Primary gold
          500: '#e3b800',
          600: '#b39200',
          700: '#846c00',
          800: '#554600',
          900: '#2a2300',
        },
        // Dashboard dark theme
        'dash': {
          bg: '#0a0e14',
          card: '#111827',
          border: '#1f2937',
          hover: '#1e293b',
          muted: '#6b7280',
          text: '#e5e7eb',
          accent: '#008751',
        },
        // Status colors
        'status': {
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
          pending: '#8b5cf6',
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'display': ['Space Grotesk', 'sans-serif'],
        'body': ['Plus Jakarta Sans', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
