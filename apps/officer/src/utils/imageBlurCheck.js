// Client-side only — the officer app streams uploads straight to
// Cloudinary via multer's CloudinaryStorage (backend/utils/cloudinary.js),
// which only ever gives the backend a `.path` (a Cloudinary URL), never
// the raw bytes a server-side sharpness check needs — unlike self-serve
// merchant signup, which uploads to memory first specifically so
// registerMerchant can run checkImageSharpness against the buffer before
// anything reaches Cloudinary (see backend/utils/imageBlurCheck.js). This
// is the one gate a blurry national-ID photo captured here gets — same
// Laplacian-variance algorithm as the merchant-dashboard copy this was
// copied from, so a genuinely out-of-focus photo fails identically either
// app.
const MIN_DIMENSION = 300;
const BLUR_VARIANCE_THRESHOLD = 25;

export function isImageFile(file) {
  return !!file && file.type.startsWith('image/');
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
    return { blurry: true, reason: 'Image resolution is too low. Please retake a clearer, higher-resolution photo.', dataUrl };
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
