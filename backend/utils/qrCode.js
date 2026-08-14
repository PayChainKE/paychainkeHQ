import QRCode from 'qrcode';

// Generates a real, scannable QR code (PNG, base64 data URI) encoding a
// given URL — used on invoices so a customer can scan straight to the
// view/pay page instead of typing a link. Mirrors the "serve as a data URI,
// render via <img>" convention already used for the NCBA settlement QR (see
// SettlementQrCard.jsx) rather than rendering QRs client-side, so there's
// one QR mechanism in the app. Never throws: a QR generation hiccup should
// degrade to "no QR shown" on the invoice, not break the whole response.
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
