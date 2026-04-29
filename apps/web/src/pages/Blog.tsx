import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Clock, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { motion } from 'framer-motion';

const articles = [
  {
    id: 'future-of-payments-africa',
    title: 'The Future of Digital Payments in East Africa',
    excerpt: 'How mobile money and smart POS systems are transforming the retail landscape across Kenya and beyond.',
    category: 'Industry Insights',
    date: 'Oct 15, 2026',
    readTime: '5 min read',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=800',
    featured: true,
  },
  {
    id: 'inflation-shield-stablecoins',
    title: 'Shielding Your Business from Currency Volatility',
    excerpt: 'Understanding how stablecoin-backed tills can protect your margins during economic uncertainty.',
    category: 'Product Updates',
    date: 'Oct 10, 2026',
    readTime: '4 min read',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: 'offline-first-pos',
    title: 'Why Offline-First Architecture is Critical for Retail',
    excerpt: 'Network drops shouldn\'t mean lost sales. Discover the technology behind continuous operations.',
    category: 'Technology',
    date: 'Oct 5, 2026',
    readTime: '6 min read',
    image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: 'bulk-pay-payroll',
    title: 'Streamlining Mass Payouts for Gig Workers',
    excerpt: 'The operational efficiency of instant, automated bulk disbursements.',
    category: 'Case Studies',
    date: 'Sep 28, 2026',
    readTime: '3 min read',
    image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=800',
  }
];

const categories = ['All', 'Company News', 'Industry Insights', 'Product Updates', 'Technology'];

const Blog = () => {
  const [activeCategory, setActiveCategory] = React.useState('All');
  
  const filteredArticles = articles.filter(a => activeCategory === 'All' || a.category === activeCategory);
  const featuredArticle = articles.find(a => a.featured);
  const gridArticles = filteredArticles.filter(a => !a.featured || activeCategory !== 'All');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-grow pt-24 pb-20">
        {/* Professional Dark Hero Section */}
        <section className="relative overflow-hidden min-h-[450px] flex items-center text-white pt-24 pb-20 bg-[#0a0a0a]">
          {/* Background Image with High-Contrast Overlay */}
          <div className="absolute inset-0 -z-10">
            <img 
              src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2000" 
              alt="Premium Architecture" 
              className="w-full h-full object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent" />
          </div>
          
          <div className="container mx-auto px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
                  Knowledge for the <span className="text-[#00bf63]">Modern Merchant</span>
                </h1>
                <p className="text-lg text-gray-400 leading-relaxed mb-8 max-w-xl">
                  Authoritative research and deep technical analysis on the digital transformation of African retail and global fintech.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="relative w-full sm:w-auto flex-grow max-w-md">
                    <input 
                      type="email" 
                      placeholder="Enter corporate email" 
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-[#00bf63] transition-all backdrop-blur-md"
                    />
                  </div>
                  <button className="w-full sm:w-auto px-8 py-4 bg-[#00bf63] hover:bg-[#00d971] text-black font-bold rounded-xl transition-all duration-300 transform hover:scale-[1.02]">
                    Subscribe
                  </button>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="hidden lg:block relative"
              >
                {/* Compact Featured Card */}
                <div className="relative z-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                  <div className="flex justify-between items-start mb-6">
                    <div className="px-3 py-1 rounded-md bg-[#00bf63]/20 border border-[#00bf63]/30 text-[#00bf63] text-xs font-bold tracking-wider">
                      TRENDING NOW
                    </div>
                    <Clock className="w-4 h-4 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 leading-snug">
                    Stablecoin Settlement: The End of Delayed Payouts?
                  </h3>
                  <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00bf63] to-green-300 overflow-hidden">
                        <img 
                          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80" 
                          alt="Author" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-sm">
                        <div className="font-bold">David Chen</div>
                        <div className="text-[#00bf63] text-xs">CTO, PayChain</div>
                      </div>
                    </div>
                    <Link to="/blog" className="text-[#00bf63] hover:text-[#00d971] transition-colors">
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Clean High-End Separator */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] z-20">
            <svg viewBox="0 0 1440 120" className="relative block w-full h-[60px] md:h-[80px]" preserveAspectRatio="none">
              <path 
                d="M0,120 L1440,120 L1440,0 C1100,80 340,80 0,0 L0,120 Z" 
                className="fill-gray-50"
              />
            </svg>
          </div>
        </section>

        <div className="container mx-auto px-6 lg:px-8 py-12">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-12">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === category 
                    ? 'bg-gray-900 text-white' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Featured Article */}
          {activeCategory === 'All' && featuredArticle && (
            <div className="mb-16">
              <Link to={`/blog/${featuredArticle.id}`} className="group block">
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col md:flex-row transition-all duration-300 hover:shadow-md">
                  <div className="md:w-1/2 relative overflow-hidden">
                    <img 
                      src={featuredArticle.image} 
                      alt={featuredArticle.title}
                      className="w-full h-64 md:h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                    <div className="flex items-center gap-4 text-sm mb-4">
                      <span className="text-[#00bf63] font-semibold">{featuredArticle.category}</span>
                      <span className="text-gray-400 flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> {featuredArticle.date}
                      </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 group-hover:text-[#00bf63] transition-colors">
                      {featuredArticle.title}
                    </h2>
                    <p className="text-gray-600 mb-6 line-clamp-3">
                      {featuredArticle.excerpt}
                    </p>
                    <div className="flex items-center text-[#00bf63] font-medium mt-auto">
                      Read Article <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Articles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {gridArticles.map((article, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                key={article.id}
              >
                <Link to={`/blog/${article.id}`} className="group h-full flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={article.image} 
                      alt={article.title}
                      className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6 flex flex-col flex-grow">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="text-[#00bf63] font-medium">{article.category}</span>
                      <span className="text-gray-500">{article.readTime}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#00bf63] transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-3 mb-6">
                      {article.excerpt}
                    </p>
                    <div className="mt-auto flex items-center text-sm text-gray-500 pt-4 border-t border-gray-50">
                      <Calendar className="w-4 h-4 mr-2" /> {article.date}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          
          {filteredArticles.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-500">No articles found in this category.</p>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Blog;
