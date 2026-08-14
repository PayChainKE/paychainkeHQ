// Deterministic, unique-per-reference pseudo-barcode used on printed
// receipts. It is a visual identity mark (like the barcode on a till
// receipt), not a real Code128/EAN encoding — nothing decodes it — but the
// same input reference always produces the same bar pattern and different
// references always look visually distinct, via a simple string hash.
// Mirrors apps/merchant-dashboard/src/utils/barcode.js.
export function barcodePattern(text: string, barCount = 50): { on: boolean; w: number }[] {
  const s = String(text || '');
  let seed = 7;
  for (let i = 0; i < s.length; i++) seed = (Math.imul(seed, 31) + s.charCodeAt(i)) >>> 0;
  const bars: { on: boolean; w: number }[] = [];
  for (let i = 0; i < barCount; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    bars.push({ on: (seed >>> 16) % 2 === 0, w: 1 + ((seed >>> 24) % 3) });
  }
  return bars;
}

// Inline SVG markup, embedded into the HTML documents expo-print renders to
// PDF (a WebView under the hood, so plain inline SVG works).
export function barcodeSvg(text: string, { width = 220, height = 40, barCount = 50 } = {}): string {
  const bars = barcodePattern(text, barCount);
  const totalUnits = bars.reduce((s, b) => s + b.w, 0);
  const scale = width / totalUnits;
  let x = 0;
  const rects = bars
    .map((b) => {
      const w = b.w * scale;
      const rect = b.on ? `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="#0B1F1A"/>` : '';
      x += w;
      return rect;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${rects}</svg>`;
}
