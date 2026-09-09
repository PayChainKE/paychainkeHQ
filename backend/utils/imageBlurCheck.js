import sharp from 'sharp';

// Same metric OpenCV's cv2.Laplacian(img, CV_64F).var() blur-detector uses:
// convolve a grayscale image with a Laplacian (edge-detection) kernel, then
// measure the variance of the result. Crisp text/printed borders produce
// strong, varied edge responses; a blurred photo smooths those away and the
// variance collapses toward zero. Threshold is empirical and intentionally
// conservative (catches only clearly out-of-focus/shaky photos) — override
// via CERT_BLUR_VARIANCE_THRESHOLD in the environment if real-world uploads
// show it's too strict or too lenient, no code change needed.
const LAPLACIAN_KERNEL = { width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] };
const DEFAULT_THRESHOLD = 25;
const MIN_DIMENSION = 300; // below this, sharpness can't be judged reliably anyway

function getThreshold() {
  const fromEnv = Number(process.env.CERT_BLUR_VARIANCE_THRESHOLD);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_THRESHOLD;
}

// Returns { blurry: boolean, reason?: string } — never throws; a photo we
// can't analyze (corrupt, unsupported) is treated as a format problem
// elsewhere, not silently accepted as "not blurry".
export async function checkImageSharpness(buffer) {
  const meta = await sharp(buffer).metadata();
  if ((meta.width || 0) < MIN_DIMENSION || (meta.height || 0) < MIN_DIMENSION) {
    return { blurry: true, reason: 'Image resolution is too low. Please upload a clearer, higher-resolution photo.' };
  }

  const { data } = await sharp(buffer)
    .rotate() // respect EXIF orientation before measuring
    .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
    .grayscale()
    .convolve(LAPLACIAN_KERNEL)
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length;

  let variance = 0;
  for (let i = 0; i < data.length; i++) {
    const d = data[i] - mean;
    variance += d * d;
  }
  variance /= data.length;

  if (variance < getThreshold()) {
    return { blurry: true, reason: 'This photo looks blurry or out of focus. Retake it in good lighting, holding the camera steady, then try again.' };
  }
  return { blurry: false };
}
