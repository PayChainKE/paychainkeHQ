// Documents the palette every screen already converges on — derived by
// counting actual hex literal usage across src/pages/*.tsx, not invented.
// No screen is required to import this; it exists so a *new* screen (or a
// fix like the ActivityIndicator/RefreshControl color drift cleaned up
// alongside this file) has one place to check "what green do we actually
// use for this" instead of guessing or copying whatever's nearby. Retrofitting
// every existing hardcoded value to import from here is a separate, much
// larger project — not attempted here.

export const colors = {
  // Primary dark green — page headers, primary buttons, PIN/security
  // screens, ActivityIndicator (the dominant loading-spinner color).
  primary: '#00351d',
  // Secondary/gradient-partner green — paired with `primary` in gradients
  // (balance card, receipt/PDF branding) and its own accent borders.
  // Deliberately NOT the same as `primary` — see Dashboard.tsx's balance
  // card gradient and the generated receipt HTML in Collections.tsx/
  // BulkPay.tsx for where this is used correctly today.
  primaryGradient: '#0b4d2e',
  // Deepest green — third gradient stop, near-black.
  primaryDeep: '#031f13',
  // Accent/CTA green — "View All" pills, RefreshControl spinners, links.
  accent: '#006c4e',
  // Bright mint — used sparingly for high-emphasis icons/highlights on a
  // dark background (PIN screens, success states).
  mint: '#5efeb3',
  mintSoft: '#68dbae',

  // Text
  textPrimary: '#0c2010',
  textSecondary: '#5b645c',
  textMuted: '#9ca3af',

  // Surfaces
  pageBackground: '#f0fdf4',
  cardBorder: '#eff4ef',
  chipBackgroundGreen: '#e7f8ef',

  // Status
  success: '#5efeb3',
  error: '#f87171',
  errorDeep: '#ba1a1a',
  warning: '#fbbf24',
};
