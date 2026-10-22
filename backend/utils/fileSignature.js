// What an uploaded file actually IS, read from its first bytes — never from
// the client-supplied filename or Content-Type, which an attacker controls.
// KYC/KYB and receipt uploads only ever accept JPEG, PNG and PDF (iPhone
// HEIC photos are converted to JPEG client-side before upload), so anything
// else is refused before it reaches sharp (whose SVG parser, librsvg, has
// had memory-safety advisories) or gets stored in Cloudinary.
export function detectFileKind(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  return null;
}

export class UnsupportedFileError extends Error {
  constructor(message = 'Unsupported file. Upload a JPG, PNG or PDF.') {
    super(message);
    this.name = 'UnsupportedFileError';
  }
}

export function assertAllowedUpload(buffer, allowed = ['jpeg', 'png', 'pdf']) {
  const kind = detectFileKind(buffer);
  if (!kind || !allowed.includes(kind)) throw new UnsupportedFileError();
  return kind;
}
