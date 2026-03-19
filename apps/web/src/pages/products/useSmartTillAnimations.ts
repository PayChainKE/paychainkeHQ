import { useEffect } from 'react';

export default function useSmartTillAnimations(): void {
  useEffect(() => {
    try {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const target = e.target as HTMLElement;
          if (e.isIntersecting) {
            target.classList.add('in-view');
            const svg = target.querySelector<SVGElement>('.till-svg');
            if (svg) svg.classList.add('play');
          }
        });
      }, { threshold: 0.12 });

      const animated = document.querySelectorAll<HTMLElement>('[data-animate]');
      animated.forEach((el) => io.observe(el));

      const heroSvg = document.querySelector<SVGElement>('.till-svg');
      if (heroSvg) setTimeout(() => heroSvg.classList.add('play'), 300);

      return () => {
        try {
          io.disconnect();
        } catch (e) {
          // ignore
        }
      };
    } catch (err) {
      // graceful failure in older browsers
    }
  }, []);
}
