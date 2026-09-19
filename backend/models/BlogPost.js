import mongoose from 'mongoose';

export const BLOG_CATEGORIES = ['Company News', 'Compliance', 'Industry Insights', 'Product Updates', 'Technology', 'Case Studies'];

// Marketing-site blog content, managed from the admin dashboard's Blog Posts
// page instead of being hardcoded in apps/web (see blogController.js). A
// post is only ever shown on the public site once status is 'published'.
const BlogPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  excerpt: { type: String, default: '', trim: true, maxlength: 300 },
  category: { type: String, enum: BLOG_CATEGORIES, default: 'Company News' },
  content: { type: String, default: '', maxlength: 100000 }, // HTML from the admin's rich text editor
  image: { type: String, default: '' }, // Cloudinary cover image URL
  author: {
    name: { type: String, default: '', trim: true },
    role: { type: String, default: '', trim: true },
    avatar: { type: String, default: '' },
  },
  readTime: { type: String, default: '', trim: true },
  // 'scheduled' = will be published automatically at scheduledAt (see
  // services/schedulerService.js#publishDueBlogPosts); never shown publicly
  // until then, exactly like a draft.
  status: { type: String, enum: ['draft', 'scheduled', 'published'], default: 'draft' },
  scheduledAt: { type: Date, default: null },
  featured: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

BlogPostSchema.index({ status: 1, publishedAt: -1 });
BlogPostSchema.index({ status: 1, scheduledAt: 1 });

const BlogPost = mongoose.model('BlogPost', BlogPostSchema);

export default BlogPost;
