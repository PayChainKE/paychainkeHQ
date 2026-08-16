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
        canvas: "#f6f7f8",
        surface: "#ffffff",
        border: "#e6e8eb",
        ink: "#0a0a0a",
        "ink-muted": "#5c6066",
        "ink-faint": "#9a9fa6",
        brand: {
          DEFAULT: "#00bf63",
          dark: "#00a857",
          bright: "#20e37f",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
