export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#00351d",
        "primary-container": "#0b4d2e",
        secondary: "#006c4e",
        "secondary-fixed": "#86f8c9",
        "secondary-fixed-dim": "#68dbae",
        "secondary-container": "#83f5c6",
        tertiary: "#1f302b",
        "sidebar-dark": "#1f302b",
        surface: "#eaffe8",
        "surface-container-low": "#e1fadf",
        "surface-container": "#dcf5da",
        "surface-container-high": "#d6efd4",
        "surface-container-highest": "#d0e9cf",
        "surface-container-lowest": "#ffffff",
        accent: "#1d9e75",
        "outline-variant": "#c0c9c0",
        "on-surface": "#0c2010",
        "on-surface-variant": "#404942",
        "on-primary": "#ffffff",
        error: "#ba1a1a",
        "usdc-blue": "#0a2540",
      },
      fontFamily: {
        headline: ["DM Serif Display", "serif"],
        body: ["Plus Jakarta Sans", "sans-serif"],
        label: ["Plus Jakarta Sans", "sans-serif"],
      },
      spacing: {
        '1.5': '0.375rem', // Corrected to match Tailwind 1.5 mapping if needed, or explicitly 0.3rem
        '2.5': '0.625rem',
        '3': '0.75rem',
      },
      boxShadow: {
        'editorial': '0px 12px 32px rgba(11, 77, 46, 0.06)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
