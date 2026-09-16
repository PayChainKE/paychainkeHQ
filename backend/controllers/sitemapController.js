import BlogPost from '../models/BlogPost.js';

// www is the actual canonical domain — Vercel's dashboard-level domain
// config redirects the bare paychain.co.ke -> www.paychain.co.ke. See
// apps/web/src/components/Seo.tsx's SITE_URL comment for the full story.
const SITE_URL = 'https://www.paychain.co.ke';

// Mirrors apps/web/public/sitemap.xml's static entries — that file is now
// superseded by this endpoint (see apps/web/vercel.json's /sitemap.xml
// rewrite) but is left in place as an offline fallback.
const STATIC_PAGES = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/how-it-works', changefreq: 'monthly', priority: '0.9' },
  { loc: '/products', changefreq: 'monthly', priority: '0.9' },
  { loc: '/products/virtual-account', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/bulk-pay', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/cash-advance', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/operations-tools', changefreq: 'monthly', priority: '0.8' },
  { loc: '/products/inflation-shield', changefreq: 'monthly', priority: '0.7' },
  { loc: '/integrations', changefreq: 'monthly', priority: '0.7' },
  { loc: '/docs', changefreq: 'monthly', priority: '0.6' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.8' },
  { loc: '/about', changefreq: 'monthly', priority: '0.7' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.6' },
  { loc: '/book-demo', changefreq: 'monthly', priority: '0.8' },
  { loc: '/blog', changefreq: 'weekly', priority: '0.7' },
  { loc: '/terms-of-service', changefreq: 'yearly', priority: '0.3' },
  { loc: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
];

function xmlEscape(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function urlEntry({ loc, changefreq, priority, lastmod }) {
  return [
    '  <url>',
    `    <loc>${xmlEscape(`${SITE_URL}${loc}`)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n');
}

// @desc    Dynamically generated sitemap — static marketing pages plus
//          every published blog post, so a post created through the admin
//          CMS shows up for crawlers without a code deploy. Mounted at the
//          root (not under /api) so it can be reached at /sitemap.xml
//          directly; see apps/web/vercel.json's rewrite for how
//          paychain.co.ke/sitemap.xml proxies here.
// @route   GET /sitemap.xml
// @access  Public
export const generateSitemap = async (req, res) => {
  const urls = STATIC_PAGES.map(urlEntry);

  try {
    const posts = await BlogPost.find({ status: 'published' })
      .select('slug updatedAt')
      .lean();
    posts.forEach((post) => {
      urls.push(urlEntry({
        loc: `/blog/${post.slug}`,
        changefreq: 'yearly',
        priority: '0.5',
        lastmod: post.updatedAt ? new Date(post.updatedAt).toISOString().slice(0, 10) : undefined,
      }));
    });
  } catch (error) {
    // A DB hiccup should degrade to "static pages only", never a broken sitemap.
    console.error('Sitemap: failed to load blog posts, serving static pages only:', error.message);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  res.set('Content-Type', 'application/xml');
  res.send(xml);
};
