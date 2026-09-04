import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Share2, Twitter, Linkedin, Facebook } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

interface ArticleData {
  id: string;
  title: string;
  category: string;
  date: string;
  readTime: string;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  image: string;
  content: string;
}

const allArticlesData: Record<string, ArticleData> = {
  'future-of-payments-africa': {
    id: 'future-of-payments-africa',
    title: 'The Future of Digital Payments in East Africa',
    category: 'Industry Insights',
    date: 'Oct 15, 2026',
    readTime: '5 min read',
    author: {
      name: 'Sarah Kimani',
      role: 'Head of Product Strategy',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    },
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=1200',
    content: `
      <p class="lead">The retail landscape in East Africa is undergoing a profound transformation. As internet penetration deepens and mobile-first populations mature, the expectation for seamless, instant transactions is no longer a luxury. It's the baseline.</p>
      
      <h2>The Evolution of Point of Sale</h2>
      <p>Historically, merchants relied on fragmented systems: a traditional cash register, a separate card terminal, and a personal phone for mobile money transfers. This fragmentation led to reconciliation nightmares at the end of every business day.</p>
      <p>Today, we're seeing the convergence of these tools into unified platforms. The modern smart till isn't just a payment acceptor; it's a comprehensive business management tool that handles inventory, payroll, and tax compliance automatically.</p>

      <blockquote>
        "The next wave of fintech innovation isn't about creating new ways to pay. It's about unifying the ways we already pay into a single, cohesive experience for the merchant."
      </blockquote>

      <h2>Addressing Infrastructure Challenges</h2>
      <p>Despite rapid digitization, infrastructure reliability remains a challenge. Power outages and internet connectivity drops can halt business operations instantly. This is why <strong>offline-first architecture</strong> has become the critical differentiator for payment solutions in emerging markets.</p>
      <p>When a system can securely queue transactions locally and sync automatically when connectivity is restored, merchants never have to turn away a customer. It provides the reliability of cash with the security of digital rails.</p>

      <h2>Looking Ahead: What Comes After Verified Collections</h2>
      <p>Once a merchant has verified, instantly-settled collections, the next frontier is protecting the value of that revenue. Stablecoin-backed settlement, still early and largely in development across the industry, is one option being explored to hedge against currency depreciation without requiring merchants to understand crypto.</p>
      <p>As we move towards 2027, the focus will shift from consumer adoption to merchant empowerment. The platforms that win will be those that abstract the complexity of money movement and simply give business owners their time back.</p>
    `,
  },
  'paychain-data-controller-registration': {
    id: 'paychain-data-controller-registration',
    title: 'PayChain Registers as a Data Controller with the ODPC',
    category: 'Compliance',
    date: 'Jul 14, 2026',
    readTime: '3 min read',
    author: {
      name: 'Corporate Communications',
      role: 'PayChain KE',
      avatar: '/avator.png',
    },
    image: '/happy_kenyan_merchant.png',
    content: `
      <p class="lead"><strong>NAIROBI, KENYA, July 14, 2026</strong>: PayChain Financial Services Ltd has officially registered as a Data Controller with Kenya's Office of the Data Protection Commissioner (ODPC), formalizing the company's obligations under the Data Protection Act 2019 for every merchant and customer whose data passes through the platform.</p>

      <h2>Why Data Controller Registration Matters</h2>
      <p>Every PayChain merchant handles sensitive information: customer phone numbers, transaction histories, KYC documents, and revenue data. Registering as a Data Controller with the ODPC means PayChain has formally committed to the Act's core principles: lawful and transparent processing, purpose limitation, data minimization, and appropriate technical and organizational security measures.</p>
      <p>In practice, this means merchant and customer data on PayChain is processed only for the purposes disclosed at signup, protected with 256-bit AES encryption, and never transferred outside Kenya without a clear legal basis.</p>

      <blockquote>
        "Merchants trust us with the financial lifeblood of their business. Registering as a Data Controller with the ODPC is a formal, verifiable commitment to protect that trust, not just a compliance checkbox."
      </blockquote>

      <h2>What This Means for Merchants</h2>
      <p>PayChain merchants don't need to do anything differently. This registration sits behind the scenes, alongside PayChain's existing NCBA Bank-backed verification, as part of a broader commitment to operating as a fully compliant financial infrastructure provider in Kenya.</p>
      <p>Merchants can request a full export of their data at any time, and PayChain does not sell or share merchant or customer data with advertisers or third parties.</p>
    `,
  },
  'paychain-official-registration': {
    id: 'paychain-official-registration',
    title: 'PayChain Financial Services Ltd Officially Registered in Kenya',
    category: 'Company News',
    date: 'May 28, 2026',
    readTime: '3 min read',
    author: {
      name: 'Corporate Communications',
      role: 'PayChain KE',
      avatar: '/avator.png',
    },
    image: '/merchant-dashboard-teaser.png',
    content: `
      <p class="lead"><strong>NAIROBI, KENYA, May 28, 2026</strong>: PayChain Financial Services Ltd today announced its official registration and incorporation in Kenya, marking a pivotal moment in the company's mission to revolutionize the financial infrastructure for merchants across East Africa.</p>
      
      <h2>A New Era for Merchant Services</h2>
      <p>The official registration solidifies PayChain's position as a compliant and forward-thinking financial technology provider. This milestone empowers the company to accelerate the deployment of its unified merchant operating system, designed to seamlessly integrate payments, point-of-sale management, and capital advancement.</p>
      
      <blockquote>
        "Our registration in Kenya is a testament to our commitment to regulatory compliance and our dedication to the local market. We are building the rails that will power the next generation of African commerce."
      </blockquote>

      <h2>Commitment to the Kenyan Market</h2>
      <p>Kenya remains one of the most dynamic and innovative fintech markets globally. By establishing a formalized presence, PayChain Financial Services Ltd is uniquely positioned to address the complex challenges faced by modern merchants, including high transaction costs, currency volatility, and lack of access to working capital.</p>
      <p>With this regulatory milestone achieved, PayChain will begin scaling its flagship products, including the PayChain Virtual Account, Payment Links, STK Push, and Bulk Pay, providing Kenyan businesses with the secure, verified tools they need to thrive, with the Inflation Shield currently in development.</p>
    `,
  }
};

const BlogPost = () => {
  const { id } = useParams();
  
  const articleData = id && allArticlesData[id] ? allArticlesData[id] : allArticlesData['paychain-official-registration'];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
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
