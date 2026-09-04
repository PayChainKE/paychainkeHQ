/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "tertiary-fixed": "#d3e7e0",
        "outline": "#707971",
        "on-tertiary-container": "#a0b4ad",
        "on-secondary-container": "#007151",
        "primary-container": "#0b4d2e",
        // Surface family (and on-surface/background) aligned to the
        // merchant-dashboard's tailwind.config.js — same underlying
        // Material-You palette, but the dashboard's surface tones are
        // tinted mint-green rather than neutral grey/cream. Kept every
        // token this app doesn't share with the dashboard (fixed/inverse
        // variants, etc.) unchanged.
        "background": "#eaffe8",
        "surface-container-lowest": "#ffffff",
        "on-surface-variant": "#404942",
        "tertiary-container": "#354641",
        "tertiary": "#1f302b",
        "on-primary-container": "#80bd95",
        "on-tertiary-fixed-variant": "#394a45",
        "on-secondary-fixed-variant": "#00513a",
        "inverse-surface": "#2f312f",
        "on-background": "#0c2010",
        "surface-tint": "#2e6a48",
        "on-error": "#ffffff",
        "surface-dim": "#dbdad7",
        "surface-container-low": "#e1fadf",
        "secondary-container": "#83f5c6",
        "on-primary-fixed-variant": "#115132",
        "on-tertiary-fixed": "#0d1f1b",
        "surface-variant": "#e3e2df",
        "surface-container-high": "#d6efd4",
        "on-secondary-fixed": "#002115",
        "on-tertiary": "#ffffff",
        "error": "#ba1a1a",
        "surface": "#eaffe8",
        "surface-container": "#dcf5da",
        "surface-bright": "#faf9f6",
        "on-surface": "#0c2010",
        "on-error-container": "#93000a",
        "error-container": "#ffdad6",
        "secondary": "#006c4e",
        "secondary-fixed-dim": "#68dbae",
        "secondary-fixed": "#86f8c9",
        "on-secondary": "#ffffff",
        "on-primary": "#ffffff",
        "tertiary-fixed-dim": "#b7cbc4",
        "outline-variant": "#c0c9c0",
        "primary-fixed": "#b1f1c6",
        "surface-container-highest": "#d0e9cf",
        "primary": "#00351d",
        "on-primary-fixed": "#002110",
        "primary-fixed-dim": "#96d4ab",
        "inverse-primary": "#96d4ab",
        "inverse-on-surface": "#f2f1ee",
        // New — present in the dashboard's palette, missing here.
        "accent": "#1d9e75",
        "usdc-blue": "#0a2540",
      },
      fontFamily: {
        headline: ["PlusJakartaSans_700Bold"],
        body: ["PlusJakartaSans_400Regular"],
        label: ["PlusJakartaSans_600SemiBold"],
        serif: ["DMSerifDisplay_400Regular_Italic"],
      },
    },
  },
  plugins: [],
}
