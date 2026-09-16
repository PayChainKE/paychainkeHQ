import express from 'express';
import multer from 'multer';
import {
  listPublishedPosts,
  getPublishedPost,
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  uploadBlogImage,
} from '../controllers/blogController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';

// Mirrors routes/newsletterRoutes.js's imageUpload — memory storage only,
// the buffer goes straight to Cloudinary's upload_stream. SVG excluded
// (stored-XSS risk via inline <script>/onload if the URL is ever opened
// directly rather than rendered as an <img>).
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, ok.includes(file.mimetype));
  },
});

const router = express.Router();

// 'analyst' stays read-only, matching newsletterRoutes.js's convention.
const requireMutator = requireRole('owner', 'admin');

// Public — the marketing site's Blog index/detail pages.
router.get('/posts', listPublishedPosts);
router.get('/posts/:slug', getPublishedPost);

// Admin — registered before any public catch-alls would conflict (none do
// here, but /admin is a literal segment so ordering isn't actually load-bearing).
router.get('/admin', protect, listPosts);
router.get('/admin/:id', protect, getPost);
router.post('/admin', protect, requireMutator, createPost);
router.put('/admin/:id', protect, requireMutator, updatePost);
router.delete('/admin/:id', protect, requireMutator, deletePost);
router.post('/admin/upload-image', protect, requireMutator, imageUpload.single('image'), uploadBlogImage);

export default router;
