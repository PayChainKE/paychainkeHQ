import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_ORDER, FAQ_DATA } from './faq-data';
import {
  Compass,
  CreditCard,
  TrendingUp,
  Users,
  Banknote,
  Star,
  Shield as ShieldIcon,
  Receipt,
  Scale,
  Search,
  ChevronDown,
  Mail,
  Briefcase,
  UserPlus,
  ArrowRight,
  AlertCircle,
  Clock,
  MessageSquare,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import './faqs.css';

const ICON_MAP: Record<string, React.ComponentType<unknown>> = {
  Compass,
  CreditCard,
  TrendingUp,
  Users,
  Banknote,
  Star,
  Shield: ShieldIcon,
  Receipt,
  Scale,
};

const ALLOW_MULTIPLE_OPEN = false;

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms = 200) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${q})`, 'ig');
  return text.split(re).map((part, i) => (re.test(part) ? `<mark class="search-highlight">${part}</mark>` : part)).join('');
}

export default function FAQPage(): JSX.Element {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [activeCat, setActiveCat] = useState(CATEGORY_ORDER[0]);
  const pillsRef = useRef<HTMLDivElement | null>(null);
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});

  const flatQuestions = useMemo(() => {
    const list: Array<{ catId: string; catLabel: string; qId: string; q: string; a: string }> = [];
    for (const c of FAQ_DATA) {
      for (const q of c.questions) list.push({ catId: c.id, catLabel: c.category, qId: q.id, q: q.q, a: q.a });
    }
    return list;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    const results = flatQuestions.filter(item => (item.q + ' ' + item.a).toLowerCase().includes(q.toLowerCase()));
    return results;
  }, [query, flatQuestions]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(ent => {
          if (ent.isIntersecting) setActiveCat(ent.target.getAttribute('data-cat') || CATEGORY_ORDER[0]);
        });
      },
      { root: null, rootMargin: '0px 0px -60%', threshold: 0 }
    );
    CATEGORY_ORDER.forEach(id => {
      const el = sectionsRef.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (searchMode) {
      setOpenItems({});
    }
  }, [searchMode]);

  const onSearch = debounce((val: string) => {
    setQuery(val);
    setSearchMode(!!val.trim());
  }, 200);

  function toggleItem(id: string) {
    setOpenItems(prev => {
      const isOpen = !!prev[id];
      if (ALLOW_MULTIPLE_OPEN) return { ...prev, [id]: !isOpen };
      return isOpen ? {} : { [id]: true };
    });
  }

  function scrollToSection(id: string) {
    // If we're in search mode, exit it first so sections are rendered
    if (searchMode) {
      setSearchMode(false);
      setQuery('');
      const input = document.querySelector('.search-input') as HTMLInputElement;
      if (input) input.value = '';
      
      // Small delay to allow React to render the sections before scrolling
      setTimeout(() => performScroll(id), 50);
    } else {
      performScroll(id);
    }
  }

  function performScroll(id: string) {
    const el = sectionsRef.current[id];
    if (!el) return;
    
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    try {
      history.replaceState(null, '', `#h-${id}`);
    } catch (e) {
      location.hash = `h-${id}`;
    }
    
    setActiveCat(id);

    const pill = document.querySelector(`[data-pill="${id}"]`) as HTMLElement | null;
    if (pill) {
      pill.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  }

  function renderIcon(name: string) {
    const Comp = ICON_MAP[name as keyof typeof ICON_MAP] || Compass;
    return <Comp className="icon" />;
  }

  useEffect(() => {
    try {
      const hash = location.hash;
      if (hash && hash.startsWith('#h-')) {
        const id = hash.replace('#h-', '');
        setTimeout(() => scrollToSection(id), 300);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <div className="faqs-page">
      <Navbar />

      <header className="faqs-hero">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="faqs-hero-inner"
        >
          <span className="eyebrow">Institutional Knowledge Base</span>
          <h1 className="headline">How Can We Help You Scale?</h1>
          <p className="sub">
            Comprehensive documentation and strategic technical analysis for merchants operating on the PayChain ecosystem. 
            Can't find a solution? Reach us directly at <a href="tel:+254743283782" className="underline-link">+254 743 283 782</a> or <a href="mailto:support@paychain.co.ke" className="underline-link">support@paychain.co.ke</a>
          </p>

          <div className="search-wrapper" role="search" aria-label="Search FAQ">
            <div className="search-box">
              <Search className="search-icon" />
              <input 
                aria-label="Search knowledge base" 
                className="search-input" 
                placeholder="Search e.g. 'Cash Advance eligibility' or 'Payment Links'..."
                onChange={e => onSearch(e.target.value)} 
              />
              <AnimatePresence>
                {searchMode && (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="search-clear" 
                    onClick={() => { 
                      const input = document.querySelector('.search-input') as HTMLInputElement;
                      if (input) input.value = '';
                      onSearch(''); 
                    }}
                  >
                    Clear
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Cinematic High-End Separator */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] z-10 pointer-events-none">
          <svg viewBox="0 0 1440 120" className="relative block w-full h-[60px] md:h-[100px]" preserveAspectRatio="none">
            <path 
              d="M0,120 L1440,120 L1440,0 C1100,80 340,80 0,0 L0,120 Z" 
              fill="#ffffff"
            />
          </svg>
        </div>
      </header>

      {!searchMode && (
        <section className="category-carousel-wrapper">
          <div className="carousel-track-wrapper">
            <motion.div 
              className="carousel-track"
              animate={{
                x: [0, -1500], // Adjust based on total width of categories
              }}
              transition={{
                duration: 30,
                ease: "linear",
                repeat: Infinity,
              }}
              whileHover={{ animationPlayState: 'paused' }}
            >
              {/* Double the data for seamless looping */}
              {[...FAQ_DATA, ...FAQ_DATA].map((cat, idx) => (
                <div
                  key={`${cat.id}-${idx}`}
                  onClick={() => scrollToSection(cat.id)}
                  className={`category-card ${activeCat === cat.id ? 'active' : ''}`}
                >
                  <div className="icon-box">
                    {renderIcon(cat.icon)}
                  </div>
                  <h3>{cat.category}</h3>
                  <span className="count">{cat.questions.length} Questions</span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      )}


      <main className="faqs-main">
        <aside className="faqs-sidebar" aria-label="FAQ categories">
          <nav>
            <ul>
              {FAQ_DATA.map(cat => (
                <li 
                  key={cat.id} 
                  className={`side-item ${activeCat === cat.id ? 'active' : ''}`} 
                  onClick={() => scrollToSection(cat.id)}
                >
                  <span className="side-text">{cat.category}</span>
                  <span className="side-count">{cat.questions.length}</span>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section className="faqs-content">
          <AnimatePresence mode="wait">
            {searchMode ? (
              <motion.div 
                key="search-results"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="search-results"
              >
                <div className="results-count">Showing {filtered ? filtered.length : 0} results for "{query}"</div>
                <div className="results-list">
                  {filtered && filtered.length > 0 ? filtered.map(r => (
                    <article key={r.qId} className="accordion-item" style={{ marginBottom: '16px' }}>
                      <div className="p-6">
                        <div className="result-breadcrumb">{r.catLabel}</div>
                        <button className="question-row" onClick={() => toggleItem(r.qId)}>
                          <span className="question-text" dangerouslySetInnerHTML={{ __html: highlight(r.q, query) }} />
                          <ChevronDown className={`chev ${openItems[r.qId] ? 'rotated' : ''}`} />
                        </button>
                        <div className={`answer-panel ${openItems[r.qId] ? 'open' : ''}`}>
                          <div dangerouslySetInnerHTML={{ __html: r.a }} />
                        </div>
                      </div>
                    </article>
                  )) : (
                    <div className="no-results bg-gray-50 rounded-2xl p-12 text-center">
                      <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-gray-900 mb-2">No results match "{query}"</h3>
                      <p className="text-gray-600">Try using different keywords or contact our support team directly.</p>
                      <a href="mailto:support@paychain.co.ke" className="inline-flex items-center text-[#0B4D2E] font-semibold mt-4">
                        Contact Support <ArrowRight size={14} className="ml-2" />
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="default-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {FAQ_DATA.map(cat => (
                  <section 
                    key={cat.id} 
                    ref={el => (sectionsRef.current[cat.id] = el)} 
                    data-cat={cat.id} 
                    className="faq-category" 
                    aria-labelledby={`h-${cat.id}`}
                  >
                    <h2 id={`h-${cat.id}`} className="category-heading">
                      {renderIcon(cat.icon)}
                      <span>{cat.category}</span>
                    </h2>
                    <div className="accordion">
                      {cat.questions.map(q => (
                        <div key={q.id} className="accordion-item">
                          <button 
                            aria-expanded={!!openItems[q.id]} 
                            aria-controls={`panel-${q.id}`} 
                            id={`button-${q.id}`} 
                            className={`question-row ${openItems[q.id] ? 'open' : ''}`} 
                            onClick={() => toggleItem(q.id)}
                          >
                            <span className="question-text">{q.q}</span>
                            <ChevronDown className={`chev ${openItems[q.id] ? 'rotated' : ''}`} />
                          </button>
                          <div id={`panel-${q.id}`} className={`answer-panel ${openItems[q.id] ? 'open' : ''}`}>
                            <div dangerouslySetInnerHTML={{ __html: q.a }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <section className="faqs-cta">
        <div className="cta-inner">
          <h3>Still Have Questions?</h3>
          <p>Our Nairobi-based team is ready to assist with technical deep-dives or general inquiries.</p>
          <div className="cta-cards">
            <a href="mailto:support@paychain.co.ke" className="card">
              <div className="card-icon"><MessageSquare size={20} /></div>
              <div>
                <strong>Support & Inquiries</strong>
                <div className="card-sub">support@paychain.co.ke</div>
              </div>
            </a>
            <a href="mailto:info@paychain.co.ke" className="card">
              <div className="card-icon"><Briefcase size={20} /></div>
              <div>
                <strong>Strategic Partnerships</strong>
                <div className="card-sub">info@paychain.co.ke</div>
              </div>
            </a>
            <a href="https://app.paychain.co.ke" className="card primary">
              <div className="card-icon"><UserPlus size={20} /></div>
              <div>
                <strong>Sign Up</strong>
                <div className="card-sub">Create your merchant account</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
