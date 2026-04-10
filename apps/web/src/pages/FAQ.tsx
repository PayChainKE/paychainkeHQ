import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
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
      // collapse all
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
    const el = sectionsRef.current[id];
    if (!el) return;
    // smooth scroll the section into view
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // update URL hash for deep-linking
    try {
      history.replaceState(null, '', `#h-${id}`);
    } catch (e) {
      location.hash = `h-${id}`;
    }
    // set active category in UI
    setActiveCat(id);

    // scroll the pill into view
    const pill = document.querySelector(`[data-pill="${id}"]`) as HTMLElement | null;
    if (pill) {
      pill.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }

    // open first question in the category and focus the question button
    const cat = FAQ_DATA.find(c => c.id === id);
    const firstQ = cat && cat.questions && cat.questions[0] && cat.questions[0].id;
    if (firstQ) {
      setOpenItems({ [firstQ]: true });
      setTimeout(() => {
        const btn = document.getElementById(`button-${firstQ}`) as HTMLElement | null;
        if (btn) {
          btn.focus();
        }
      }, 450);
    }
  }

  function renderIcon(name: string) {
    const Comp = ICON_MAP[name as keyof typeof ICON_MAP] || Compass;
    return <Comp className="icon" />;
  }

  // Handle deep links on initial load (e.g., /faqs#h-bulk-pay)
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
        <div className="faqs-hero-inner">
          <div className="eyebrow">Help Centre</div>
          <h1 className="headline">Everything You Need to Know About PayChain.</h1>
          <p className="sub">Simple answers to the questions Kenyan merchants ask us most. Can't find what you're looking for? Reach us directly at <a href="tel:+254790889066" className="underline-link">+254 790 889 066</a></p>

          <div className="search-wrapper" role="search" aria-label="Search FAQ">
            <div className="search-box">
              <Search className="search-icon" />
              <input aria-label="Search questions" className="search-input" placeholder="Search questions e.g. 'How does Cash Advance work?'" onChange={e => onSearch(e.target.value)} />
              <button className="search-clear" onClick={() => { (document.querySelector('.search-input') as HTMLInputElement).value = ''; onSearch(''); }} style={{ display: undefined }}>Clear</button>
            </div>
          </div>
        </div>
      </header>

      <div className="pills-sticky" style={{ position: 'sticky', top: 'var(--header-height)', zIndex: 40 }}>
        <div className="pills-row" ref={pillsRef}>
          {FAQ_DATA.map(cat => {
            const count = filtered ? filtered.filter(r => r.catId === cat.id).length : cat.questions.length;
            return (
              <button key={cat.id} data-pill={cat.id} className={`pill ${activeCat === cat.id ? 'active' : ''}`} onClick={() => { setSearchMode(false); scrollToSection(cat.id); }}>
                <span className="pill-label">{cat.category}</span>
                <span className="pill-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="faqs-main">
        <aside className="faqs-sidebar" aria-label="FAQ categories">
          <nav>
            <ul>
              {FAQ_DATA.map(cat => (
                <li key={cat.id} className={`side-item ${activeCat === cat.id ? 'active' : ''}`} onClick={() => scrollToSection(cat.id)}>
                  <span className="side-text">{cat.category}</span>
                  <span className="side-count">{cat.questions.length}</span>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section className="faqs-content">
          {searchMode && (
            <div className="search-results">
              <div className="results-count">Showing {filtered ? filtered.length : 0} results for '{query}'</div>
              <div className="results-list">
                {filtered && filtered.length > 0 ? filtered.map(r => (
                  <article key={r.qId} className="result-item" onClick={() => toggleItem(r.qId)}>
                    <div className="result-breadcrumb">{r.catLabel}</div>
                    <button className="result-question" dangerouslySetInnerHTML={{ __html: highlight(r.q, query) }} />
                    <div className={`result-answer ${openItems[r.qId] ? 'open' : ''}`} dangerouslySetInnerHTML={{ __html: r.a }} />
                  </article>
                )) : <div className="no-results">No questions match '{query}'. Email us at <a href="mailto:support@paychain.co.ke">support@paychain.co.ke</a></div>}
              </div>
            </div>
          )}

          {!searchMode && FAQ_DATA.map(cat => (
            <section key={cat.id} ref={el => (sectionsRef.current[cat.id] = el)} data-cat={cat.id} className="faq-category" aria-labelledby={`h-${cat.id}`} role="region">
              <h2 id={`h-${cat.id}`} className="category-heading">{renderIcon(cat.icon)}<span>{cat.category}</span></h2>
              <div className="accordion">
                {cat.questions.map(q => (
                  <div key={q.id} className="accordion-item">
                    <button aria-expanded={!!openItems[q.id]} aria-controls={`panel-${q.id}`} id={`button-${q.id}`} className={`question-row ${openItems[q.id] ? 'open' : ''}`} onClick={() => toggleItem(q.id)}>
                      <span className="question-text">{q.q}</span>
                      <ChevronDown className={`chev ${openItems[q.id] ? 'rotated' : ''}`} />
                    </button>
                    <div id={`panel-${q.id}`} role="region" aria-labelledby={`button-${q.id}`} className={`answer-panel ${openItems[q.id] ? 'open' : ''}`} dangerouslySetInnerHTML={{ __html: q.a }} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </section>
      </main>

      <section className="faqs-cta">
        <div className="cta-inner">
          <h3>Still Have a Question We Haven't Answered?</h3>
          <p>Our team is based in Nairobi and responds to every message personally. No bots. No automated responses. Just the PayChain team answering your questions directly.</p>
          <div className="cta-cards">
            <a href="mailto:support@paychain.co.ke" className="card"><Mail className="card-icon" /> <div><strong>General & Support</strong><div className="card-sub">support@paychain.co.ke</div></div></a>
            <a href="mailto:partnerships@paychain.co.ke" className="card"><Briefcase className="card-icon" /> <div><strong>Partnership Enquiries</strong><div className="card-sub">partnerships@paychain.co.ke</div></div></a>
            <Link to="/waitlist" className="card primary"><UserPlus className="card-icon" /> <div><strong>Join the Waitlist</strong><div className="card-sub">Limited beta spots</div></div></Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

