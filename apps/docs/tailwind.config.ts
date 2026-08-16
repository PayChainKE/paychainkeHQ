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
        // Theme-able chrome — resolve through CSS variables (see index.css)
        // so the same class names repaint for light vs. dark instead of
        // needing dark: variants sprinkled through every component. The
        // rgb(var(--x) / <alpha-value>) form (not a bare var()) is required
        // for Tailwind to keep generating opacity-modifier utilities like
        // bg-brand/10 or decoration-brand/30 against these tokens.
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--surface-raised) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-subtle": "rgb(var(--border-subtle) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--ink-muted) / <alpha-value>)",
        "ink-faint": "rgb(var(--ink-faint) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          bright: "rgb(var(--brand-bright) / <alpha-value>)",
          dim: "rgb(var(--brand-dim) / <alpha-value>)",
        },
        // Fixed, NOT theme-able — code panels stay dark in both light and
        // dark mode (same call Stripe/GitHub/Vercel docs make) because the
        // syntax-highlight palette in lib/highlight.ts is tuned for a dark
        // background; flipping it light-mode would make it unreadable.
        code: {
          bg: "#0e1012",
          header: "#131619",
          border: "#1f2327",
          "border-subtle": "#191c1f",
          text: "#f4f5f6",
          muted: "#9a9fa6",
          faint: "#5b6167",
          accent: "#20e37f",
        },
      },
      maxWidth: {
        prose: "42rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
