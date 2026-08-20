import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// KRA's own Technical Specification of TIS for OSCU/VSCU v2.0 (item 6.28)
// requires: "print official KRA logo on each receipt regardless the type."
// This is the actual KRA crest, extracted directly from that same
// KRA-published PDF (page 3 header) — not a recreation — so every KRA
// e-Invoice surface (thermal receipt, email, public invoice page) shows
// the real mark rather than a text placeholder.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KRA_LOGO_PATH = path.join(__dirname, '..', 'assets', 'kra-logo.png');

let cachedDataUri;

export function kraLogoDataUri() {
  if (cachedDataUri !== undefined) return cachedDataUri;
  try {
    const buf = readFileSync(KRA_LOGO_PATH);
    cachedDataUri = `data:image/png;base64,${buf.toString('base64')}`;
  } catch (err) {
    console.error('KRA logo asset missing:', err.message);
    cachedDataUri = null;
  }
  return cachedDataUri;
}
