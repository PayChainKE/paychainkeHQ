import { RefObject, useEffect } from "react";

export default function useOperationAnimations(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current ?? document;
    const els: Element[] = Array.from((root as Element).querySelectorAll?.(".reveal") ?? []);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.15 }
    );

    els.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [ref]);
}
