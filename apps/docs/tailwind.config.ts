import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        canvas: "#08090a",
        surface: "#0e1012",
        "surface-raised": "#131619",
        border: "#1f2327",
        "border-subtle": "#191c1f",
        ink: "#f4f5f6",
        "ink-muted": "#9a9fa6",
        "ink-faint": "#5b6167",
        brand: {
          DEFAULT: "#00bf63",
          bright: "#20e37f",
          dim: "#0a9950",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,191,99,0.15), 0 8px 30px -8px rgba(0,191,99,0.25)",
      },
      maxWidth: {
        prose: "42rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
