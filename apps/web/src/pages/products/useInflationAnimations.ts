import { useEffect } from 'react';

function animateCount(el: Element, target: number) {
  const start = 0;
  const duration = 900;
  let startTime: number | null = null;

  function step(ts: number) {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const value = start + (target - start) * progress;
    if (el instanceof HTMLElement) {
      if (target >= 1000) {
        el.textContent = Math.round(value).toLocaleString();
      } else {
        el.textContent = (Math.round(value * (target % 1 ? 10 : 1)) / (target % 1 ? 10 : 1)).toString();
      }
    }
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export default function useInflationAnimations(): void {
  useEffect(() => {
    try {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const target = e.target as HTMLElement;
          if (e.isIntersecting) {
            target.classList.add('in-view');

            // play chart if present
            const chart = target.querySelector<SVGElement>('.chart-svg');
            if (chart) chart.classList.add('play');

            // animate stat numbers
            const stats = target.querySelectorAll<HTMLElement>('.stat-value');
            stats.forEach((s) => {
              if (!s.dataset.animated) {
                const t = Number(s.dataset.target);
                if (!Number.isNaN(t)) animateCount(s, t);
                s.dataset.animated = '1';
              }
            });
          }
        });
      }, { threshold: 0.12 });

      document.querySelectorAll('[data-animate]').forEach((el) => io.observe(el));

      return () => io.disconnect();
    } catch (err) {
      // ignore
    }
  }, []);
}
