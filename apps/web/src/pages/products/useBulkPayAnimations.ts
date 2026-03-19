import { useEffect } from 'react';

function playChecks(root: Element) {
  const checks = root.querySelectorAll<HTMLElement>('.check');
  checks.forEach((c, i) => {
    setTimeout(() => {
      c.classList.add('play');
    }, i * 250);
  });
}

export default function useBulkPayAnimations(): void {
  useEffect(() => {
    try {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const target = e.target as HTMLElement;
          if (e.isIntersecting) {
            target.classList.add('in-view');
            playChecks(target);
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
