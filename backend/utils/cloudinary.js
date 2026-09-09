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
