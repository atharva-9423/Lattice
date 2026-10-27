import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from './reveal';

export function useCountUp(targetValue: number, duration = 1.2) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.textContent = String(Math.round(targetValue));
      return;
    }

    const state = { val: 0 };
    const ctx = gsap.context(() => {
      gsap.to(state, {
        val: targetValue,
        duration,
        ease: 'power2.out',
        snap: { val: 1 },
        onUpdate: () => {
          if (el) {
            el.textContent = String(Math.round(state.val));
          }
        },
      });
    });

    return () => ctx.revert();
  }, [targetValue, duration]);

  return ref;
}
