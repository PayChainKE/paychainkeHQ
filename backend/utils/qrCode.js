import QRCode from 'qrcode';
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_MARK_SVG_PATH = path.join(__dirname, '..', 'assets', 'paychain-icon-mark.svg');

// Generates a real, scannable QR code (PNG, base64 data URI) encoding a
// given URL — used on invoices so a customer can scan straight to the
// view/pay page instead of typing a link. Never throws: a QR generation
// hiccup should degrade to "no QR shown" on the invoice, not break the
// whole response.
export async function generateQrDataUri(text) {
  if (!text) return null;
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#06201B', light: '#FFFFFF' },
    });
  } catch (err) {
    console.error('QR code generation failed:', err.message);
    return null;
  }
}

// White rounded-square "badge" behind the center logo — gives the icon a
// clean, high-contrast quiet zone against the QR's own dark modules rather
// than sitting directly on top of them.
function buildBadgeSvg(iconSvg, size) {
  const badgeInset = Math.round(size * 0.02);
  const badgeInner = size - badgeInset * 2;
  const cornerRadius = Math.round(size * 0.18);
  const iconBox = Math.round(size * 0.65);
  const iconOffset = Math.round((size - iconBox) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="${badgeInset}" y="${badgeInset}" width="${badgeInner}" height="${badgeInner}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#ffffff"/>
    <svg x="${iconOffset}" y="${iconOffset}" width="${iconBox}" height="${iconBox}" viewBox="411.382812 686.484375 159.75 150.9375">
      ${iconSvg}
    </svg>
  </svg>`;
}

// Generates a PayChain-branded, scannable QR (PNG, base64 data URI) with the
// PayChain mark composited into the center — used for merchant checkout QRs
// (mpesaController.js#generateAccountQr) so a scanned code visibly belongs
// to PayChain rather than being an unbranded black-and-white square.
// errorCorrectionLevel 'H' (~30% tolerance) plus keeping the logo badge to
// ~24% of the QR's width is comfortably within the margin real-world QR
// scanners need to still read the code around a center logo — verified via
// a decode round-trip during development, not just visual inspection.
// Never throws: falls back to a plain (unbranded) QR, then to null, rather
// than blocking whatever flow requested it.
export async function generateBrandedQrDataUri(text) {
  if (!text) return null;
  const qrSize = 600;
  let qrBuffer;
  try {
    qrBuffer = await QRCode.toBuffer(text, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: qrSize,
      color: { dark: '#06201B', light: '#FFFFFF' },
    });
  } catch (err) {
    console.error('Branded QR code generation failed:', err.message);
    return null;
  }

  try {
    const iconSvg = await readFile(ICON_MARK_SVG_PATH, 'utf8');
    const iconPathMatch = iconSvg.match(/<path[\s\S]*?\/>/);
    if (!iconPathMatch) throw new Error('Icon mark SVG has no <path> element');

    const badgeSize = Math.round(qrSize * 0.24);
    const badgeBuffer = await sharp(Buffer.from(buildBadgeSvg(iconPathMatch[0], badgeSize)))
      .png()
      .toBuffer();

    const composited = await sharp(qrBuffer)
      .composite([{ input: badgeBuffer, gravity: 'center' }])
      .png()
      .toBuffer();

    return `data:image/png;base64,${composited.toString('base64')}`;
  } catch (err) {
    // Logo compositing failed for some reason (missing asset, sharp error,
    // etc.) — a plain, unbranded QR that still works is far better than no
    // QR at all.
    console.error('QR logo compositing failed, falling back to plain QR:', err.message);
    return `data:image/png;base64,${qrBuffer.toString('base64')}`;
  }
}
