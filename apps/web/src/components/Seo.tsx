import { useEffect } from 'react';

// The site's actual live domain — index.html's own default og:image
// previously pointed at paychainke.com, which doesn't resolve at all (no
// DNS record); paychain.co.ke is the domain used everywhere else in this
// app (Navbar/Footer/Docs links, contact emails, PrivacyPolicy's own
// self-reference).
const SITE_URL = 'https://paychain.co.ke';
// No dedicated opengraph-image.png exists in public/ (index.html's own tags
// pointed at one that 404s) — reusing an existing real screenshot instead of
// linking a broken image on every social share until a proper 1200x630
// design exists.
const DEFAULT_IMAGE = `${SITE_URL}/merchant-dashboard-teaser.png`;

type SeoProps = {
  /** Full page title, e.g. "Cash Advance | PayChain" — no auto-suffixing. */
  title: string;
  description: string;
  /** Route path starting with "/", used to build the canonical + og:url. */
  path: string;
  image?: string;
  /** Keeps this route out of search results (app proxies, dev-only pages). */
  noindex?: boolean;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Overrides index.html's site-wide default title/meta on mount, per route —
// index.html's own tags only ever cover the very first page a visitor (or a
// crawler that doesn't execute JS) lands on. There's deliberately no
// react-helmet-async dependency here: this is a client-only SPA rendering
// exactly one page at a time, so a handful of direct DOM writes in an effect
// covers every case react-helmet's provider/dedup machinery exists for.
export default function Seo({ title, description, path, image, noindex }: SeoProps) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    const ogImage = image || DEFAULT_IMAGE;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:image', ogImage);
    upsertMeta('property', 'og:url', url);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', ogImage);
    upsertLink('canonical', url);

    let robotsEl = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) {
      if (!robotsEl) {
        robotsEl = document.createElement('meta');
        robotsEl.setAttribute('name', 'robots');
        document.head.appendChild(robotsEl);
      }
      robotsEl.setAttribute('content', 'noindex, nofollow');
    } else if (robotsEl) {
      robotsEl.remove();
    }
  }, [title, description, path, image, noindex]);

  return null;
}
