import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Bloomberg-inspired terminal colors
        terminal: {
          bg: "#0a0a0a",
          surface: "#141414",
          elevated: "#1a1a1a",
          border: "#2a2a2a",
          muted: "#3a3a3a",
        },
        // NaijaMarket brand colors
        naija: {
          green: {
            DEFAULT: "#00A36C",
            50: "#E6F7F1",
            100: "#B3E8D5",
            200: "#80D9B9",
            300: "#4DCA9D",
            400: "#26BE88",
            500: "#00A36C",
            600: "#008F5F",
            700: "#007A52",
            800: "#006545",
            900: "#004D33",
          },
          gold: {
            DEFAULT: "#FFB800",
            50: "#FFF8E6",
            100: "#FFEAB3",
            200: "#FFDC80",
            300: "#FFCE4D",
            400: "#FFC326",
            500: "#FFB800",
            600: "#E6A600",
            700: "#CC9400",
            800: "#B38200",
            900: "#996F00",
          },
          red: {
            DEFAULT: "#E53935",
            light: "#FF6B6B",
            dark: "#C62828",
          },
          blue: {
            DEFAULT: "#2196F3",
            light: "#64B5F6",
            dark: "#1976D2",
          },
        },
        // Price change colors
        price: {
          up: "#00C853",
          down: "#FF1744",
          unchanged: "#78909C",
        },
        // Semantic colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.75rem" }],
        "3xs": ["0.5rem", { lineHeight: "0.625rem" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "pulse-green": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0, 200, 83, 0.7)" },
          "50%": { boxShadow: "0 0 0 8px rgba(0, 200, 83, 0)" },
        },
        "pulse-red": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 23, 68, 0.7)" },
          "50%": { boxShadow: "0 0 0 8px rgba(255, 23, 68, 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "number-scroll": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.3s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.3s ease-out",
        "slide-in-from-bottom": "slide-in-from-bottom 0.3s ease-out",
        "pulse-green": "pulse-green 2s infinite",
        "pulse-red": "pulse-red 2s infinite",
        shimmer: "shimmer 2s infinite",
        ticker: "ticker 30s linear infinite",
        "number-scroll": "number-scroll 0.3s ease-out",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "grid-pattern": "linear-gradient(to right, #1a1a1a 1px, transparent 1px), linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)",
        "noise": "url('/images/noise.png')",
      },
      boxShadow: {
        "glow-green": "0 0 20px rgba(0, 163, 108, 0.3)",
        "glow-gold": "0 0 20px rgba(255, 184, 0, 0.3)",
        "glow-red": "0 0 20px rgba(229, 57, 53, 0.3)",
        "terminal": "0 4px 30px rgba(0, 0, 0, 0.5)",
        "card": "0 2px 8px rgba(0, 0, 0, 0.3)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
