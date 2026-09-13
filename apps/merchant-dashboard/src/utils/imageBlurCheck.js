// Client-side heads-up only — lets a merchant catch an obviously blurry
// document photo before waiting on a network round trip. The backend runs
// its own version of this same check (Laplacian-variance edge detection)
// on the actual uploaded bytes and is the real gate; this one uses a
// downscaled canvas render so its numbers won't match exactly, but a
// genuinely out-of-focus photo fails both.
const MIN_DIMENSION = 300;
const BLUR_VARIANCE_THRESHOLD = 25;

export function isImageFile(file) {
  return !!file && file.type.startsWith('image/');
}

// The exact set the backend's own Multer fileFilter accepts
// (backend/utils/cloudinary.js's uploadMemory) — anything else (most
// commonly an iPhone's default HEIC camera format, but also WEBP, GIF,
// TIFF, BMP...) is silently DROPPED by the server rather than erroring:
// Multer's fileFilter just excludes the file from req.files with no error
// at all, so a signup would previously fail later with a confusing
// "upload your document" message even though the merchant did select a
// file. Checking this here, at the moment of selection, catches it
// immediately with a reason instead.
const ALLOWED_DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

function isHeicFile(file) {
  return /heic|heif/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '');
}

// Returns a specific, actionable reason a file was rejected, or null if
// it's fine — call before ever attempting to preview/upload a document.
export function unsupportedDocumentTypeReason(file) {
  if (!file || ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) return null;
  if (isHeicFile(file)) {
    return "iPhone photos in HEIC format aren't supported. Go to Settings > Camera > Formats and choose \"Most Compatible\", or select \"JPEG\" when sharing/saving the photo, then try again.";
  }
  return 'Upload a JPG, PNG or PDF file — that format is not supported.';
}

export async function estimateImageSharpness(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
    return { blurry: true, reason: 'Image resolution is too low. Please upload a clearer, higher-resolution photo.', dataUrl };
  }

  const scale = Math.min(1, 900 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let sum = 0;
  let count = 0;
  const responses = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap =
        gray[idx - 1] + gray[idx + 1] + gray[idx - w] + gray[idx + w] - 4 * gray[idx];
      responses[idx] = lap;
      sum += lap;
      count++;
    }
  }
  const mean = sum / count;
  let variance = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const d = responses[y * w + x] - mean;
      variance += d * d;
    }
  }
  variance /= count;

  if (variance < BLUR_VARIANCE_THRESHOLD) {
    return { blurry: true, reason: 'This photo looks blurry or out of focus. Retake it in good lighting, holding the camera steady, then try again.', dataUrl };
  }
  return { blurry: false, dataUrl };
}
