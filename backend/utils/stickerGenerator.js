import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatAccountNumberDisplay } from './ncbaValidators.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '../assets/paybill-sticker-template.pdf');

// All coordinates below were measured directly off the template (A4
// landscape, 841.89 x 595.276 pt) by rendering it at 300dpi and locating
// each box's pixel bounds, then converting px -> pt (scale 72/300 = 0.24)
// with a y-axis flip (PDF origin is bottom-left, image origin is
// top-left). The Paybill Number boxes (880100) are already baked into the
// template's artwork — only the Account Number boxes and the Business
// Name box are genuinely blank and need to be filled in per merchant.
const ACCOUNT_BOX_CENTERS_X = [
  90.96, 147.60, 204.24, 260.88,   // group 1
  348.72, 405.36, 462.12, 518.88,  // group 2
  616.32, 672.96, 729.60, 786.24,  // group 3
];
const ACCOUNT_BOX_CENTER_Y = 207.80;
const ACCOUNT_DIGIT_FONT_SIZE = 30;

const BUSINESS_NAME_START_X = 300;    // clears the "BUSINESS NAME:" label
const BUSINESS_NAME_BOX_RIGHT_X = 809.76;
const BUSINESS_NAME_CENTER_Y = 132.92;
const BUSINESS_NAME_MAX_FONT_SIZE = 24;
// This floor exists ONLY to guarantee the shrink-to-fit loop below never
// overflows the sticker's business-name box, never to target a "readable at
// a distance" size — verified against the longest name the signup form
// allows (80 chars, formatters.businessName's cap in
// merchant-dashboard/utils/validators.js), which needs exactly 8pt to fit
// this box's width. Real business names (typically 10-30 characters) never
// come close to this floor and render at or near the full 24pt bold
// regardless — this only kicks in for unusually long names, where fitting
// inside the printed box professionally matters more than exact size.
const BUSINESS_NAME_MIN_FONT_SIZE = 8;

const NAVY = rgb(0x0e / 255, 0x1f / 255, 0x31 / 255);

// Approximates a bold sans-serif's cap-height as a fraction of its point
// size, for centering a text baseline within a box's vertical center.
// Empirically checked against a rendered sample (see the sticker feature's
// commit) rather than pulled from exact font metrics.
const CAP_HEIGHT_RATIO = 0.7;

function centeredBaselineY(centerY, fontSize) {
  return centerY - (fontSize * CAP_HEIGHT_RATIO) / 2;
}

// pdf-lib has no font-weight axis beyond picking a Bold-family font up
// front, and HelveticaBold is already the boldest standard variant — so to
// read clearly at a distance (a counter sticker is read from arm's length,
// not up close) we thicken the strokes further by stamping the same glyphs
// a few sub-point pixels apart, an old print-shop "faux bold" trick. The
// offset is small enough not to disturb the centering math below.
const BOLD_STAMP_OFFSETS = [
  [0, 0],
  [0.4, 0],
  [0, 0.4],
  [0.4, 0.4],
];

function drawBoldText(page, text, { x, y, size, font, color }) {
  for (const [dx, dy] of BOLD_STAMP_OFFSETS) {
    page.drawText(text, { x: x + dx, y: y + dy, size, font, color });
  }
}

/**
 * Fills the PayChain/NCBA paybill sticker template with a merchant's real
 * 12-digit NCBA virtual account number and business name, returning the
 * finished PDF as bytes. Used both for the "Download Sticker" button in
 * the merchant dashboard and the welcome-email attachment.
 */
export async function generateMerchantStickerPdf({ businessName, accountNumber }) {
  const digits = String(accountNumber || '').replace(/\D/g, '');
  if (digits.length !== 12) {
    throw new Error(`Sticker requires a 12-digit account number, got "${accountNumber}"`);
  }

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  digits.split('').forEach((digit, i) => {
    const cx = ACCOUNT_BOX_CENTERS_X[i];
    const width = font.widthOfTextAtSize(digit, ACCOUNT_DIGIT_FONT_SIZE);
    drawBoldText(page, digit, {
      x: cx - width / 2,
      y: centeredBaselineY(ACCOUNT_BOX_CENTER_Y, ACCOUNT_DIGIT_FONT_SIZE),
      size: ACCOUNT_DIGIT_FONT_SIZE,
      font,
      color: NAVY,
    });
  });

  const name = String(businessName || '').trim() || 'PayChain Merchant';
  const maxWidth = BUSINESS_NAME_BOX_RIGHT_X - BUSINESS_NAME_START_X - 20; // right-side padding
  let fontSize = BUSINESS_NAME_MAX_FONT_SIZE;
  while (fontSize > BUSINESS_NAME_MIN_FONT_SIZE && font.widthOfTextAtSize(name, fontSize) > maxWidth) {
    fontSize -= 1;
  }
  drawBoldText(page, name, {
    x: BUSINESS_NAME_START_X,
    y: centeredBaselineY(BUSINESS_NAME_CENTER_Y, fontSize),
    size: fontSize,
    font,
    color: NAVY,
  });

  return pdfDoc.save();
}

const FLYER_WIDTH = 400;
const FLYER_HEIGHT = 640;
const FLYER_MARGIN = 40;
const FLYER_QR_SIZE = 300;
const FLYER_NAME_MAX_FONT_SIZE = 26;
// Same "guarantee it fits, never target a specific size" reasoning as
// BUSINESS_NAME_MIN_FONT_SIZE above — this flyer's name box is narrower
// (320pt vs the sticker's 490pt), so the 80-char worst case needs a lower
// floor (6pt) to still never overflow.
const FLYER_NAME_MIN_FONT_SIZE = 6;
const FLYER_ACCOUNT_FONT_SIZE = 22;

/**
 * A standalone "Scan to Pay" flyer — the branded checkout QR (already
 * generated by utils/qrCode.js#generateBrandedQrDataUri) embedded into a
 * printable one-page PDF with the business name and account number drawn
 * boldly above/below it, using the exact same HelveticaBold + faux-bold
 * stamping technique as generateMerchantStickerPdf so a downloaded QR reads
 * as clearly at a distance as the paybill sticker does — unlike the bare
 * QR PNG a merchant can already pull straight from their dashboard, which
 * carries no text at all.
 * @param {object} params
 * @param {string} params.businessName
 * @param {string} params.accountNumber - raw 12-digit NCBA virtual account number
 * @param {Buffer} params.qrPngBytes - PNG bytes of the branded QR (already logo-composited)
 */
export async function generateMerchantQrFlyerPdf({ businessName, accountNumber, qrPngBytes }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([FLYER_WIDTH, FLYER_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const centerX = (text, size, useFont = font) => (FLYER_WIDTH - useFont.widthOfTextAtSize(text, size)) / 2;

  // "SCAN TO PAY" caption
  const caption = 'SCAN TO PAY';
  const captionSize = 11;
  page.drawText(caption, {
    x: centerX(caption, captionSize, regularFont),
    y: FLYER_HEIGHT - FLYER_MARGIN,
    size: captionSize,
    font: regularFont,
    color: NAVY,
  });

  // Business name — same shrink-to-fit approach as the sticker.
  const name = String(businessName || '').trim() || 'PayChain Merchant';
  const nameMaxWidth = FLYER_WIDTH - FLYER_MARGIN * 2;
  let nameFontSize = FLYER_NAME_MAX_FONT_SIZE;
  while (nameFontSize > FLYER_NAME_MIN_FONT_SIZE && font.widthOfTextAtSize(name, nameFontSize) > nameMaxWidth) {
    nameFontSize -= 1;
  }
  const nameY = FLYER_HEIGHT - FLYER_MARGIN - 40;
  drawBoldText(page, name, { x: centerX(name, nameFontSize), y: nameY, size: nameFontSize, font, color: NAVY });

  // QR code, centered
  const qrImage = await pdfDoc.embedPng(qrPngBytes);
  const qrX = (FLYER_WIDTH - FLYER_QR_SIZE) / 2;
  const qrY = nameY - 30 - FLYER_QR_SIZE;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: FLYER_QR_SIZE, height: FLYER_QR_SIZE });

  // Account number, grouped in 4s for readability (same convention as the
  // dashboard/admin display — see utils/ncbaValidators.js#formatAccountNumberDisplay).
  const label = 'ACCOUNT NUMBER';
  const labelSize = 10;
  const labelY = qrY - 34;
  page.drawText(label, { x: centerX(label, labelSize, regularFont), y: labelY, size: labelSize, font: regularFont, color: NAVY });

  const formattedAccount = formatAccountNumberDisplay(accountNumber) || accountNumber;
  const accountY = labelY - FLYER_ACCOUNT_FONT_SIZE - 6;
  drawBoldText(page, formattedAccount, {
    x: centerX(formattedAccount, FLYER_ACCOUNT_FONT_SIZE),
    y: accountY,
    size: FLYER_ACCOUNT_FONT_SIZE,
    font,
    color: NAVY,
  });

  // Paybill caption
  const paybillText = 'Paybill 880100';
  const paybillSize = 11;
  const paybillY = accountY - 26;
  page.drawText(paybillText, { x: centerX(paybillText, paybillSize, regularFont), y: paybillY, size: paybillSize, font: regularFont, color: NAVY });

  return pdfDoc.save();
}

/**
 * Merges one sticker per merchant into a single multi-page PDF — used by
 * the admin dashboard's "Download All Stickers" bulk action, so an admin
 * can print a whole batch (e.g. before a round of merchant site visits)
 * in one file instead of one download per merchant. Each merchant is
 * generated independently via generateMerchantStickerPdf (reused as-is,
 * not reimplemented) then its single page is copied into one combined
 * document — simpler and lower-risk than restructuring the single-sticker
 * generator to draw multiple pages into one shared PDFDocument, and at
 * this scale (tens of merchants, not thousands) the extra template
 * reloads per merchant cost nothing that matters.
 */
export async function generateBulkStickerPdf(merchants) {
  const combined = await PDFDocument.create();

  for (const { businessName, accountNumber } of merchants) {
    const stickerBytes = await generateMerchantStickerPdf({ businessName, accountNumber });
    const stickerDoc = await PDFDocument.load(stickerBytes);
    const [copiedPage] = await combined.copyPages(stickerDoc, [0]);
    combined.addPage(copiedPage);
  }

  return combined.save();
}
