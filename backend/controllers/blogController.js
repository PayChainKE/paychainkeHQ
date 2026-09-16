import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import BlogPost, { BLOG_CATEGORIES } from '../models/BlogPost.js';

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

// Appends -2, -3, ... until the slug is free — covers both a genuine
// duplicate title and an admin hand-editing the slug field to something
// already taken. excludeId lets an update skip colliding with itself.
async function uniqueSlug(base, excludeId) {
  let slug = base || 'post';
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await BlogPost.exists(query);
    if (!exists) return slug;
    slug = `${base}-${n++}`;
  }
}

const LIST_FIELDS = 'title slug excerpt category image author readTime status featured publishedAt updatedAt';

// ── Public ────────────────────────────────────────────────────────────

// @desc    List published posts for the marketing site's Blog index.
//          `content` is deliberately excluded — the list view only needs
//          a preview, not the full HTML, which can be large.
// @route   GET /api/blog/posts
// @access  Public
export const listPublishedPosts = async (req, res) => {
  try {
    const posts = await BlogPost.find({ status: 'published' })
      .sort({ publishedAt: -1 })
      .select(LIST_FIELDS)
      .lean();
    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('List Published Posts Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Fetch one published post by slug, for the marketing site's
//          Blog detail page. Full content + author included.
// @route   GET /api/blog/posts/:slug
// @access  Public
export const getPublishedPost = async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug, status: 'published' }).lean();
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Get Published Post Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// ── Admin ─────────────────────────────────────────────────────────────

// @desc    Admin list of all posts, any status.
// @route   GET /api/blog/admin
// @access  Private (Admin)
export const listPosts = async (req, res) => {
  try {
    const posts = await BlogPost.find({})
      .sort({ updatedAt: -1 })
      .select(LIST_FIELDS)
      .lean();
    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('List Posts Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Fetch one post's full content, to load into the admin editor.
// @route   GET /api/blog/admin/:id
// @access  Private (Admin)
export const getPost = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const post = await BlogPost.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Get Post Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Shared write-path validation + field normalization for create/update.
function buildFields(body) {
  const fields = {};
  if (body.title !== undefined) fields.title = String(body.title).trim().slice(0, 200);
  if (body.excerpt !== undefined) fields.excerpt = String(body.excerpt).trim().slice(0, 300);
  if (body.category !== undefined && BLOG_CATEGORIES.includes(body.category)) fields.category = body.category;
  if (body.content !== undefined) fields.content = String(body.content);
  if (body.image !== undefined) fields.image = String(body.image);
  if (body.readTime !== undefined) fields.readTime = String(body.readTime).trim().slice(0, 40);
  if (body.featured !== undefined) fields.featured = !!body.featured;
  if (body.status !== undefined && ['draft', 'published'].includes(body.status)) fields.status = body.status;
  if (body.author && typeof body.author === 'object') {
    fields.author = {
      name: String(body.author.name || '').trim().slice(0, 100),
      role: String(body.author.role || '').trim().slice(0, 100),
      avatar: String(body.author.avatar || ''),
    };
  }
  return fields;
}

// @desc    Create a new post. Starts as a draft unless status is explicitly
//          set to 'published' on creation.
// @route   POST /api/blog/admin
// @access  Private (Admin, owner/admin role)
export const createPost = async (req, res) => {
  try {
    const { title } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }
    const fields = buildFields(req.body || {});
    const requestedSlug = req.body?.slug ? slugify(req.body.slug) : slugify(title);
    fields.slug = await uniqueSlug(requestedSlug);
    fields.createdBy = req.admin?._id || null;
    fields.updatedBy = req.admin?._id || null;
    if (fields.status === 'published') fields.publishedAt = new Date();

    if (fields.featured) {
      await BlogPost.updateMany({ featured: true }, { $set: { featured: false } });
    }

    const post = await BlogPost.create(fields);
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    console.error('Create Post Error:', error);
    if (error.code === 11000) return res.status(409).json({ error: 'A post with that slug already exists.' });
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((v) => v.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update a post. Publishing for the first time stamps publishedAt;
//          re-saving an already-published post leaves publishedAt alone so
//          edits don't bump it back to the top of a date-sorted list.
// @route   PUT /api/blog/admin/:id
// @access  Private (Admin, owner/admin role)
export const updatePost = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const existing = await BlogPost.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Post not found.' });

    const fields = buildFields(req.body || {});
    if (req.body?.slug !== undefined) {
      const requested = slugify(req.body.slug) || existing.slug;
      fields.slug = requested === existing.slug ? existing.slug : await uniqueSlug(requested, existing._id);
    }
    fields.updatedBy = req.admin?._id || null;
    if (fields.status === 'published' && existing.status !== 'published') {
      fields.publishedAt = new Date();
    }

    if (fields.featured) {
      await BlogPost.updateMany({ _id: { $ne: existing._id }, featured: true }, { $set: { featured: false } });
    }

    Object.assign(existing, fields);
    await existing.save();
    res.json({ success: true, data: existing });
  } catch (error) {
    console.error('Update Post Error:', error);
    if (error.code === 11000) return res.status(409).json({ error: 'A post with that slug already exists.' });
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((v) => v.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Delete a post permanently.
// @route   DELETE /api/blog/admin/:id
// @access  Private (Admin, owner/admin role)
export const deletePost = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const result = await BlogPost.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Post not found.' });
    res.json({ success: true, message: 'Post deleted.' });
  } catch (error) {
    console.error('Delete Post Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Upload a cover/inline image for a blog post. Mirrors
//          newsletterController.js#uploadNewsletterImage's Cloudinary
//          upload_stream pattern — raw bytes are never persisted, only the
//          resulting secure URL is kept.
// @route   POST /api/blog/admin/upload-image
// @access  Private (Admin, owner/admin role)
export const uploadBlogImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMime.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Unsupported file type. Use JPG, PNG, GIF or WebP.' });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'paychain_blog_images',
          transformation: [
            { width: 1600, crop: 'limit' },
            { quality: 'auto:good', fetch_format: 'auto' },
          ],
          resource_type: 'image',
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    console.log(`📸 Blog image uploaded: ${result.public_id} (${Math.round(result.bytes / 1024)} KB)`);

    res.json({
      success: true,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      sizeKb: Math.round(result.bytes / 1024),
      format: result.format,
    });
  } catch (error) {
    console.error('Blog image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image. Try again.' });
  }
};
