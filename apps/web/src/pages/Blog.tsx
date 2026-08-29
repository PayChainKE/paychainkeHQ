import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Clock, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { motion } from 'framer-motion';

const articles = [
  {
    id: 'paychain-official-registration',
    title: 'PayChain Financial Services Ltd Officially Registered in Kenya',
    excerpt: 'Marking a significant milestone in East African fintech, PayChain announces its official incorporation as a registered entity in Kenya, paving the way for next-generation merchant solutions.',
    category: 'Company News',
    date: 'May 28, 2026',
    readTime: '3 min read',
    image: '/merchant-dashboard-teaser.png',
    featured: false,
  },
  {
    id: 'future-of-payments-africa',
    title: 'The Future of Digital Payments in East Africa',
    excerpt: 'How mobile money and smart POS systems are transforming the retail landscape across Kenya and beyond.',
    category: 'Industry Insights',
    date: 'Oct 15, 2026',
    readTime: '5 min read',
    image: '/happy_kenyan_merchant.png',
    featured: false,
  },
  {
    id: 'paychain-data-controller-registration',
    title: 'PayChain Registers as a Data Controller with the ODPC',
    excerpt: 'PayChain Financial Services Ltd is now a registered Data Controller with Kenya\'s Office of the Data Protection Commissioner, formalizing how merchant and customer data is protected under the Data Protection Act 2019.',
    category: 'Compliance',
    date: 'Jul 14, 2026',
    readTime: '3 min read',
    image: '/happy_kenyan_merchant.png',
  },
  {
    id: 'inflation-shield-stablecoins',
    title: 'The Inflation Shield: What We\'re Building and Why',
    excerpt: 'A look at the stablecoin protection feature currently in development, and how it will help merchants hedge shilling depreciation once it launches.',
    category: 'Product Updates',
    date: 'Oct 10, 2026',
    readTime: '4 min read',
    image: '/Home page/merchant 3.png',
  },
  {
    id: 'offline-first-pos',
    title: 'Why Offline-First Architecture is Critical for Retail',
    excerpt: 'Network drops shouldn\'t mean lost sales. Discover the technology behind continuous operations.',
    category: 'Technology',
    date: 'Oct 5, 2026',
    readTime: '6 min read',
    image: '/happy_kenyan_merchant.png',
  },
  {
    id: 'bulk-pay-payroll',
    title: 'Streamlining Mass Payouts for Gig Workers',
    excerpt: 'The operational efficiency of instant, automated bulk disbursements.',
    category: 'Case Studies',
    date: 'Sep 28, 2026',
    readTime: '3 min read',
    image: '/hero-bg.png',
  }
];

const categories = ['All', 'Company News', 'Compliance', 'Industry Insights', 'Product Updates', 'Technology'];

const Blog = () => {
  const [activeCategory, setActiveCategory] = React.useState('All');
  
  const filteredArticles = articles.filter(a => activeCategory === 'All' || a.category === activeCategory);
  const featuredArticle = articles.find(a => a.featured);
  const gridArticles = filteredArticles.filter(a => !a.featured || activeCategory !== 'All');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow p-0 m-0">
        {/* Professional Dark Hero Section */}
        <section className="relative w-full overflow-hidden min-h-[450px] flex items-center text-white pt-32 pb-20 bg-[#0a0a0a]">
          {/* Background Image with High-Contrast Overlay */}
          <div className="absolute inset-0 -z-10">
            <img 
              src="/hero-bg.png" 
              alt="Premium Architecture" 
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent" />
          </div>
          
          <div className="w-full px-6 lg:px-12 relative z-10 flex flex-col items-center text-center">
            <div className="max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
                  Knowledge for the <span className="text-[#00bf63]">Modern Merchant</span>
                </h1>
                <p className="text-lg text-gray-400 leading-relaxed mb-8 max-w-xl mx-auto">
                  Authoritative research and deep technical analysis on the digital transformation of African retail and global fintech.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
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

          {/* Featured Videos Section */}
          <div className="mb-20 mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 border-l-4 border-[#00bf63] pl-4 uppercase tracking-wider text-sm">Video Insights</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Video 1 (also featured on the Home page) */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col transition-all duration-300 hover:shadow-md group">
                <div className="relative aspect-video overflow-hidden">
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src="https://www.youtube.com/embed/y2a7XuaQIfo?si=un4F7yA5yf-OYY81"
                    title="Introducing PayChain: The Merchant Operating System Built for African Businesses"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-[#00bf63] transition-colors">Introducing PayChain: The Merchant Operating System Built for African Businesses</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    One verified dashboard to collect, pay, protect, and grow, replacing the fragmented, manual tools most Kenyan businesses run on today.
                  </p>
                </div>
              </div>

              {/* Video 2 */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col transition-all duration-300 hover:shadow-md group">
                <div className="relative aspect-video overflow-hidden">
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src="https://www.youtube.com/embed/MaKDVkrlHqs?si=zGtE7jtgNrEVKsVD"
                    title="Introducing PayChain The Merchant OS Built for Kenyan SMEs" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    referrerPolicy="strict-origin-when-cross-origin" 
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-[#00bf63] transition-colors">Introducing PayChain: The Merchant OS Built for Kenyan SMEs</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Tired of SMS payment fraud, shilling depreciation eating your profits, and banks turning you away for cash advance funds?
                  </p>
                </div>
              </div>

              {/* Video 3 */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col transition-all duration-300 hover:shadow-md group">
                <div className="relative aspect-video overflow-hidden">
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src="https://www.youtube.com/embed/odoTg2BWxZc?si=XL0W2IfEdFTohUsD"
                    title="Kenya's merchant financial operating system built for serious business owners." 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    referrerPolicy="strict-origin-when-cross-origin" 
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-[#00bf63] transition-colors">Kenya's merchant financial operating system built for serious business owners.</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    From Verified Collections to Payment Links, STK Push, Bulk Pay, and Cash Advances, PayChain gives your business the financial infrastructure it deserves.
                  </p>
                </div>
              </div>
            </div>
          </div>

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
                      <Clock className="w-4 h-4 mr-2" /> {article.readTime}
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
