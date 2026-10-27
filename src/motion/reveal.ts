import { useEffect } from 'react';
import gsap from 'gsap';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReveal(containerRef: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      const items = el.querySelectorAll('[data-reveal]');
      gsap.set(items, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      const items = el.querySelectorAll('[data-reveal]');
      if (items.length > 0) {
        gsap.fromTo(
          items,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.055,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      }

      const wordInners = el.querySelectorAll('.word-inner');
      if (wordInners.length > 0) {
        gsap.fromTo(
          wordInners,
          { yPercent: 105 },
          {
            yPercent: 0,
            duration: 0.65,
            stagger: 0.04,
            ease: 'power3.out',
          }
        );
      }

      const drawPaths = el.querySelectorAll('path[data-draw], line[data-draw], circle[data-draw], rect[data-draw]');
      drawPaths.forEach((node) => {
        const svgGeom = node as SVGGeometryElement;
        if (typeof svgGeom.getTotalLength === 'function') {
          try {
            const len = svgGeom.getTotalLength();
            gsap.fromTo(
              svgGeom,
              { strokeDasharray: len, strokeDashoffset: len },
              { strokeDashoffset: 0, duration: 1.1, ease: 'power3.out' }
            );
          } catch {
            // ignore unmeasurable SVG path
          }
        }
      });
    }, el);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
