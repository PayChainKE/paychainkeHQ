import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'paychain_certificates',
    allowedFormats: ['jpg', 'png', 'jpeg', 'pdf'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — matches allowedFormats below
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    cb(null, ok.includes(file.mimetype));
  },
});

// Separate folder from `upload` above — expense receipts/invoices are
// financial audit documents (tax filing support), not KYC/certificate
// paperwork, and are worth being able to find independently in the
// Cloudinary dashboard.
const receiptStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'paychain_expense_receipts',
    allowedFormats: ['jpg', 'png', 'jpeg', 'pdf'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

export const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    cb(null, ok.includes(file.mimetype));
  },
});

// Buffers the file in memory instead of streaming straight to Cloudinary —
// used only where the file must be inspected (e.g. a blur check) before
// deciding whether to keep it. `upload` above can't support that: its
// CloudinaryStorage engine uploads while the request body is still being
// read, so by the time a controller sees `req.file` the (possibly rejected)
// file is already persisted.
export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    cb(null, ok.includes(file.mimetype));
  },
});

// Wraps a Multer middleware (any of the exports above, `.fields()` or
// `.single()`) so a file-related failure reaches the client as a clear,
// specific 400 message instead of falling through to server.js's global
// error handler — which, in production, replaces every error's own
// `.message` with a generic "An unexpected server error occurred" before
// it ever reaches the client (deliberately, so an unrelated internal error
// never leaks a raw DB string). That's correct for a genuine bug, but it
// also swallowed the one piece of information a merchant actually needed
// here: Multer's own errors already say exactly what went wrong (a file
// over the 10MB limit, an unexpected field), and there's nothing unsafe
// about telling the merchant that. Used on the two public, self-serve
// document-upload endpoints (merchant registration, KYC resubmission)
// where a merchant seeing only "registration failed" with no reason is a
// real support cost — the file-type mismatch that's the more common cause
// in practice (e.g. an iPhone's default HEIC photos, which fileFilter
// above silently drops rather than erroring on) is guarded client-side
// instead, since Multer's fileFilter has no error to report there at all.
export function withMulterErrorHandling(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'One of your uploaded files is larger than 10MB. Please upload a smaller file or a compressed photo.' });
        }
        return res.status(400).json({ error: 'Could not process your uploaded file(s) — please try again.' });
      }
      return next(err);
    });
  };
}

// Manual counterpart to CloudinaryStorage — uploads a buffer that's already
// in memory (post fileFilter/blur-check) rather than a multipart stream.
export function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation: [{ width: 1000, height: 1000, crop: 'limit' }] },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });
}
