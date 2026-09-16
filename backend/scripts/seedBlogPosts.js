// One-time migration: carries the 6 blog posts that were hardcoded in
// apps/web/src/pages/Blog.tsx and BlogPost.tsx into the new BlogPost
// collection, as 'published', so they keep appearing on the marketing site
// once Blog.tsx/BlogPost.tsx switch to fetching from the API instead of a
// local object (see backend/controllers/blogController.js).
//
// Only 3 of the 6 ever had real article bodies in BlogPost.tsx's
// allArticlesData — the other 3 (inflation-shield-stablecoins,
// offline-first-pos, bulk-pay-payroll) only ever existed as list-page
// cards; visiting their URL today silently falls back to a different
// article's content. Here they're seeded with their excerpt as a
// placeholder body instead, which is honest rather than misleading —
// someone can fill in the real body via the new admin Blog Posts page.
//
// Safe to re-run — upserts by slug, does not create duplicates.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/seedBlogPosts.js
import mongoose from 'mongoose';
import BlogPost from '../models/BlogPost.js';

await mongoose.connect(process.env.MONGO_URI);

// `new Date("Oct 15, 2026")` parses as local midnight, which then
// serializes to UTC as the *previous* day for any server timezone behind
// UTC — losing a calendar day the moment only the date portion is read
// back. Building the UTC date directly from the local components avoids that.
function toUtcMidnight(dateStr) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

const posts = [
  {
    slug: 'paychain-official-registration',
    title: 'PayChain Financial Services Ltd Officially Registered in Kenya',
    excerpt: 'Marking a significant milestone in East African fintech, PayChain announces its official incorporation as a registered entity in Kenya, paving the way for next-generation merchant solutions.',
    category: 'Company News',
    date: 'May 28, 2026',
    readTime: '3 min read',
    image: '/merchant-dashboard-teaser.png',
    author: { name: 'Corporate Communications', role: 'PayChain KE', avatar: '/avator.png' },
    content: `
      <p class="lead"><strong>NAIROBI, KENYA, May 28, 2026</strong>: PayChain Financial Services Ltd today announced its official registration and incorporation in Kenya, marking a pivotal moment in the company's mission to revolutionize the financial infrastructure for merchants across East Africa.</p>
      <h2>A New Era for Merchant Services</h2>
      <p>The official registration solidifies PayChain's position as a compliant and forward-thinking financial technology provider. This milestone empowers the company to accelerate the deployment of its unified merchant operating system, designed to seamlessly integrate payments, point-of-sale management, and capital advancement.</p>
      <blockquote>"Our registration in Kenya is a testament to our commitment to regulatory compliance and our dedication to the local market. We are building the rails that will power the next generation of African commerce."</blockquote>
      <h2>Commitment to the Kenyan Market</h2>
      <p>Kenya remains one of the most dynamic and innovative fintech markets globally. By establishing a formalized presence, PayChain Financial Services Ltd is uniquely positioned to address the complex challenges faced by modern merchants, including high transaction costs, currency volatility, and lack of access to working capital.</p>
      <p>With this regulatory milestone achieved, PayChain will begin scaling its flagship products, including the PayChain Virtual Account, Payment Links, STK Push, and Bulk Pay, providing Kenyan businesses with the secure, verified tools they need to thrive, with the Inflation Shield currently in development.</p>
    `,
  },
  {
    slug: 'future-of-payments-africa',
    title: 'The Future of Digital Payments in East Africa',
    excerpt: 'How mobile money and smart POS systems are transforming the retail landscape across Kenya and beyond.',
    category: 'Industry Insights',
    date: 'Oct 15, 2026',
    readTime: '5 min read',
    image: '/happy_kenyan_merchant.png',
    author: { name: 'Sarah Kimani', role: 'Head of Product Strategy', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
    content: `
      <p class="lead">The retail landscape in East Africa is undergoing a profound transformation. As internet penetration deepens and mobile-first populations mature, the expectation for seamless, instant transactions is no longer a luxury. It's the baseline.</p>
      <h2>The Evolution of Point of Sale</h2>
      <p>Historically, merchants relied on fragmented systems: a traditional cash register, a separate card terminal, and a personal phone for mobile money transfers. This fragmentation led to reconciliation nightmares at the end of every business day.</p>
      <p>Today, we're seeing the convergence of these tools into unified platforms. The modern smart till isn't just a payment acceptor; it's a comprehensive business management tool that handles inventory, payroll, and tax compliance automatically.</p>
      <blockquote>"The next wave of fintech innovation isn't about creating new ways to pay. It's about unifying the ways we already pay into a single, cohesive experience for the merchant."</blockquote>
      <h2>Addressing Infrastructure Challenges</h2>
      <p>Despite rapid digitization, infrastructure reliability remains a challenge. Power outages and internet connectivity drops can halt business operations instantly. This is why <strong>offline-first architecture</strong> has become the critical differentiator for payment solutions in emerging markets.</p>
      <p>When a system can securely queue transactions locally and sync automatically when connectivity is restored, merchants never have to turn away a customer. It provides the reliability of cash with the security of digital rails.</p>
      <h2>Looking Ahead: What Comes After Verified Collections</h2>
      <p>Once a merchant has verified, instantly-settled collections, the next frontier is protecting the value of that revenue. Stablecoin-backed settlement, still early and largely in development across the industry, is one option being explored to hedge against currency depreciation without requiring merchants to understand crypto.</p>
      <p>As we move towards 2027, the focus will shift from consumer adoption to merchant empowerment. The platforms that win will be those that abstract the complexity of money movement and simply give business owners their time back.</p>
    `,
  },
  {
    slug: 'paychain-data-controller-registration',
    title: 'PayChain Registers as a Data Controller with the ODPC',
    excerpt: "PayChain Financial Services Ltd is now a registered Data Controller with Kenya's Office of the Data Protection Commissioner, formalizing how merchant and customer data is protected under the Data Protection Act 2019.",
    category: 'Compliance',
    date: 'Jul 14, 2026',
    readTime: '3 min read',
    image: '/happy_kenyan_merchant.png',
    author: { name: 'Corporate Communications', role: 'PayChain KE', avatar: '/avator.png' },
    content: `
      <p class="lead"><strong>NAIROBI, KENYA, July 14, 2026</strong>: PayChain Financial Services Ltd has officially registered as a Data Controller with Kenya's Office of the Data Protection Commissioner (ODPC), formalizing the company's obligations under the Data Protection Act 2019 for every merchant and customer whose data passes through the platform.</p>
      <h2>Why Data Controller Registration Matters</h2>
      <p>Every PayChain merchant handles sensitive information: customer phone numbers, transaction histories, KYC documents, and revenue data. Registering as a Data Controller with the ODPC means PayChain has formally committed to the Act's core principles: lawful and transparent processing, purpose limitation, data minimization, and appropriate technical and organizational security measures.</p>
      <p>In practice, this means merchant and customer data on PayChain is processed only for the purposes disclosed at signup, protected with 256-bit AES encryption, and never transferred outside Kenya without a clear legal basis.</p>
      <blockquote>"Merchants trust us with the financial lifeblood of their business. Registering as a Data Controller with the ODPC is a formal, verifiable commitment to protect that trust, not just a compliance checkbox."</blockquote>
      <h2>What This Means for Merchants</h2>
      <p>PayChain merchants don't need to do anything differently. This registration sits behind the scenes, alongside PayChain's existing NCBA Bank-backed verification, as part of a broader commitment to operating as a fully compliant financial infrastructure provider in Kenya.</p>
      <p>Merchants can request a full export of their data at any time, and PayChain does not sell or share merchant or customer data with advertisers or third parties.</p>
    `,
  },
  {
    slug: 'inflation-shield-stablecoins',
    title: "The Inflation Shield: What We're Building and Why",
    excerpt: 'A look at the stablecoin protection feature currently in development, and how it will help merchants hedge shilling depreciation once it launches.',
    category: 'Product Updates',
    date: 'Oct 10, 2026',
    readTime: '4 min read',
    image: '/Home page/merchant 3.png',
    author: { name: 'PayChain KE', role: 'Product Team', avatar: '/avator.png' },
    content: `<p>A look at the stablecoin protection feature currently in development, and how it will help merchants hedge shilling depreciation once it launches.</p>`,
  },
  {
    slug: 'offline-first-pos',
    title: 'Why Offline-First Architecture is Critical for Retail',
    excerpt: "Network drops shouldn't mean lost sales. Discover the technology behind continuous operations.",
    category: 'Technology',
    date: 'Oct 5, 2026',
    readTime: '6 min read',
    image: '/happy_kenyan_merchant.png',
    author: { name: 'PayChain KE', role: 'Engineering Team', avatar: '/avator.png' },
    content: `<p>Network drops shouldn't mean lost sales. Discover the technology behind continuous operations.</p>`,
  },
  {
    slug: 'bulk-pay-payroll',
    title: 'Streamlining Mass Payouts for Gig Workers',
    excerpt: 'The operational efficiency of instant, automated bulk disbursements.',
    category: 'Case Studies',
    date: 'Sep 28, 2026',
    readTime: '3 min read',
    image: '/hero-bg.png',
    author: { name: 'PayChain KE', role: 'PayChain KE', avatar: '/avator.png' },
    content: `<p>The operational efficiency of instant, automated bulk disbursements.</p>`,
  },
];

for (const p of posts) {
  const { date, ...rest } = p;
  const publishedAt = toUtcMidnight(date);
  const result = await BlogPost.updateOne(
    { slug: p.slug },
    { $setOnInsert: { ...rest, status: 'published', publishedAt } },
    { upsert: true }
  );
  console.log(`${p.slug} — ${result.upsertedCount ? 'created' : 'already existed, skipped'}`);
}

await mongoose.disconnect();
process.exit(0);
