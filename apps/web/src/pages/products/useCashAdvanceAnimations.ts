import { RefObject, useEffect } from 'react';

export default function useCashAdvanceAnimations(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current ?? document;

    // Reveal offer card after headline with a slight delay
    const offer = (root as Element).querySelector('.offer-card');
    const headline = (root as Element).querySelector('.hero-headline');
    if (headline && offer) {
      const hObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => offer.classList.add('visible'), 400);
            hObserver.disconnect();
          }
        });
      }, { threshold: 0.2 });
      hObserver.observe(headline);
    }

    // Timeline & reveal
    const reveals = Array.from((root as Element).querySelectorAll('.timeline .step, .feature-card, .pull-quote, .score-ring, .offer-mock'));
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          el.classList.add('is-visible');
          // if it's a score ring, animate stroke and count
          if (el.classList.contains('score-ring')) {
            const circle = el.querySelector('.circle') as SVGPathElement | null;
            const target = Number(el.getAttribute('data-target') || 78);
            if (circle) {
              const pct = target;
              const dash = `${pct},100`;
              circle.setAttribute('stroke-dasharray', dash);
            }
            const value = el.querySelector('.score-value');
            if (value) {
              let i = 0;
              const step = Math.max(1, Math.floor(target / 30));
              const t = setInterval(() => {
                i += step;
                if (i >= target) { i = target; clearInterval(t); }
                value.textContent = `${i}%`;
              }, 20);
            }
          }
        }
      });
    }, { threshold: 0.15 });
    reveals.forEach((r) => obs.observe(r));

    return () => {
      obs.disconnect();
    };
  }, [ref]);
}
