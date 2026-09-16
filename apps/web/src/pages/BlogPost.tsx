import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Share2, Twitter, Linkedin, Facebook } from 'lucide-react';
import Seo from '../components/Seo';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '@/lib/api';

interface ArticleData {
  slug: string;
  title: string;
  category: string;
  readTime: string;
  publishedAt: string;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  image: string;
  content: string;
}

// Derives a meta description from the article's own HTML content rather
// than requiring every post to also maintain a separate plain-text excerpt
// — strips tags, collapses whitespace, and truncates to a length search
// engines won't cut off mid-word.
function excerptFromHtml(html: string, maxLength = 160): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}…`;
}

const BlogPost = () => {
  const { id } = useParams();
  const [articleData, setArticleData] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    api.get(`/api/blog/posts/${id}`)
      .then((res) => { if (!cancelled) setArticleData(res.data?.data || null); })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // BlogPosting structured data — qualifies the post for Google's Article
  // rich results (byline, date, image) instead of a plain blue link.
  useEffect(() => {
    if (!articleData) return;
    const image = articleData.image.startsWith('http')
      ? articleData.image
      : `https://www.paychain.co.ke${articleData.image}`;
    const url = `https://www.paychain.co.ke/blog/${articleData.slug}`;

    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.setAttribute('data-paychain-article-ld', '1');
    ld.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: articleData.title,
      description: excerptFromHtml(articleData.content),
      image: [image],
      // Mongoose serializes Date fields as full ISO strings — slicing the
      // date portion avoids re-parsing through the browser's local
      // timezone, which previously shifted the calendar date backward.
      datePublished: articleData.publishedAt ? articleData.publishedAt.slice(0, 10) : undefined,
      author: { '@type': 'Person', name: articleData.author.name },
      publisher: {
        '@type': 'Organization',
        name: 'PayChain',
        logo: { '@type': 'ImageObject', url: 'https://www.paychain.co.ke/logo.png' },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    });
    document.head.appendChild(ld);
    return () => { ld.remove(); };
  }, [articleData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-grow pt-24 pb-20 container mx-auto px-6 lg:px-8 max-w-3xl">
          <div className="h-8 w-2/3 bg-gray-100 rounded animate-pulse mb-6" />
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse mb-8" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />)}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound || !articleData) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Seo title="Post Not Found | PayChain Blog" description="This article could not be found." path={`/blog/${id || ''}`} noindex />
        <Navbar />
        <main className="flex-grow pt-32 pb-20 container mx-auto px-6 lg:px-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Article not found</h1>
          <p className="text-gray-600 mb-8">This post may have been moved or unpublished.</p>
          <Link to="/blog" className="inline-flex items-center text-[#00bf63] font-semibold">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blog
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Seo
        title={`${articleData.title} | PayChain Blog`}
        description={excerptFromHtml(articleData.content)}
        path={`/blog/${articleData.slug}`}
        image={articleData.image.startsWith('http') ? articleData.image : `https://www.paychain.co.ke${articleData.image}`}
      />
      <Navbar />

      <main className="flex-grow pt-24 pb-20">
        <article>
          {/* Header */}
          <header className="container mx-auto px-6 lg:px-8 py-12 md:py-16 max-w-4xl">
            <Link to="/blog" className="inline-flex items-center text-gray-500 hover:text-[#00bf63] mb-8 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blog
            </Link>

            <div className="flex items-center gap-4 text-sm mb-6">
              <span className="text-[#00bf63] font-semibold tracking-wide uppercase">{articleData.category}</span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500 flex items-center gap-1">
                <Clock className="w-4 h-4" /> {articleData.readTime}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-8">
              {articleData.title}
            </h1>

            <div className="flex items-center justify-between border-b border-gray-100 pb-8">
              <div className="flex items-center gap-4">
                <img src={articleData.author.avatar} alt={articleData.author.name} className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-gray-900">{articleData.author.name}</div>
                  <div className="text-sm text-gray-500">{articleData.author.role}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="p-2 text-gray-400 hover:text-[#1DA1F2] bg-gray-50 hover:bg-blue-50 rounded-full transition-colors">
                  <Twitter className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-[#0A66C2] bg-gray-50 hover:bg-blue-50 rounded-full transition-colors">
                  <Linkedin className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Featured Image */}
          <div className="container mx-auto px-6 lg:px-8 max-w-5xl mb-16">
            <div className="rounded-2xl overflow-hidden shadow-sm bg-gray-100">
              <img
                src={articleData.image}
                alt="Featured"
                className="w-full h-auto max-h-[600px] object-cover"
              />
            </div>
          </div>

          {/* Content */}
          <div className="container mx-auto px-6 lg:px-8 max-w-3xl">
            <div
              className="prose prose-lg prose-gray max-w-none
                prose-headings:font-bold prose-headings:text-gray-900
                prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6
                prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-6
                prose-a:text-[#00bf63] prose-a:no-underline hover:prose-a:underline
                prose-blockquote:border-l-[#00bf63] prose-blockquote:bg-gray-50 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:text-gray-800 prose-blockquote:font-medium prose-blockquote:italic
                prose-strong:text-gray-900"
              dangerouslySetInnerHTML={{ __html: articleData.content }}
            />

            {/* Tags / Bottom Footer */}
            <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">Fintech</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">Africa</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">POS</span>
              </div>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
};

export default BlogPost;
