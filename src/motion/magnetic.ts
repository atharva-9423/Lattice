import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from './reveal';

export function useMagnetic<T extends HTMLElement = HTMLButtonElement>(strength = 8) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const ctx = gsap.context(() => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power3.out' });

      const onMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const relX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const relY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        xTo(Math.max(-strength, Math.min(strength, relX * strength)));
        yTo(Math.max(-strength, Math.min(strength, relY * strength)));
      };

      const onLeave = () => {
        xTo(0);
        yTo(0);
      };

      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', onLeave);

      return () => {
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
      };
    }, el);

    return () => ctx.revert();
  }, [strength]);

  return ref;
}
