import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reducedMotion) {
      setEnabled(false);
      document.body.classList.remove('custom-cursor-active');
      return;
    }
    setEnabled(true);
    document.body.classList.add('custom-cursor-active');

    return () => {
      document.body.classList.remove('custom-cursor-active');
    };
  }, []);

  useEffect(() => {
    if (!enabled || !dotRef.current || !ringRef.current) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    const label = labelRef.current;

    const ctx = gsap.context(() => {
      gsap.set([dot, ring], { xPercent: -50, yPercent: -50, opacity: 0 });

      const xDot = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3.out' });
      const yDot = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3.out' });
      const xRing = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3.out' });
      const yRing = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3.out' });

      let isVisible = false;
      let currentMode: 'default' | 'link' | 'view' | 'input' = 'default';

      const applyMode = (mode: 'default' | 'link' | 'view' | 'input') => {
        if (currentMode === mode) return;
        currentMode = mode;

        if (mode === 'input') {
          gsap.to([dot, ring], { opacity: 0, duration: 0.15, overwrite: 'auto' });
          return;
        }

        if (isVisible) {
          gsap.to(dot, { opacity: mode === 'view' ? 0 : 1, duration: 0.15, overwrite: 'auto' });
          gsap.to(ring, { opacity: 1, duration: 0.15, overwrite: 'auto' });
        }

        if (mode === 'link') {
          gsap.to(ring, {
            scale: 56 / 36,
            backgroundColor: 'rgba(255, 91, 31, 0.15)',
            borderColor: '#FF5B1F',
            duration: 0.22,
            ease: 'power3.out',
          });
          if (label) gsap.to(label, { opacity: 0, duration: 0.12 });
        } else if (mode === 'view') {
          gsap.to(ring, {
            scale: 60 / 36,
            backgroundColor: '#15140F',
            borderColor: '#15140F',
            duration: 0.22,
            ease: 'power3.out',
          });
          if (label) gsap.to(label, { opacity: 1, duration: 0.18 });
        } else {
          gsap.to(ring, {
            scale: 1,
            backgroundColor: 'transparent',
            borderColor: '#15140F',
            duration: 0.22,
            ease: 'power3.out',
          });
          if (label) gsap.to(label, { opacity: 0, duration: 0.12 });
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        xDot(e.clientX);
        yDot(e.clientY);
        xRing(e.clientX);
        yRing(e.clientY);

        if (!isVisible) {
          isVisible = true;
          if (currentMode !== 'input') {
            gsap.to(dot, { opacity: currentMode === 'view' ? 0 : 1, duration: 0.15 });
            gsap.to(ring, { opacity: 1, duration: 0.15 });
          }
        }

        const target = e.target as HTMLElement | null;
        if (!target) return;

        if (target.closest('input, textarea, [contenteditable="true"]')) {
          applyMode('input');
          return;
        }
        const viewEl = target.closest('[data-cursor="view"]');
        if (viewEl) {
          applyMode('view');
          return;
        }
        const linkEl = target.closest('a, button, [role="button"], [data-cursor="link"]');
        if (linkEl) {
          applyMode('link');
          return;
        }
        applyMode('default');
      };

      const onMouseDown = () => {
        if (currentMode === 'input') return;
        gsap.to(ring, { scale: 0.8, duration: 0.12, ease: 'power2.out' });
      };

      const onMouseUp = () => {
        if (currentMode === 'input') return;
        const targetScale = currentMode === 'link' ? 56 / 36 : currentMode === 'view' ? 60 / 36 : 1;
        gsap.to(ring, { scale: targetScale, duration: 0.2, ease: 'power3.out' });
      };

      const onMouseLeaveWindow = (e: MouseEvent) => {
        if (!e.relatedTarget) {
          isVisible = false;
          gsap.to([dot, ring], { opacity: 0, duration: 0.2 });
        }
      };

      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('mousedown', onMouseDown, { passive: true });
      window.addEventListener('mouseup', onMouseUp, { passive: true });
      document.addEventListener('mouseout', onMouseLeaveWindow, { passive: true });

      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mouseout', onMouseLeaveWindow);
      };
    });

    return () => ctx.revert();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'var(--ink)',
          pointerEvents: 'none',
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '1px solid var(--ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          ref={labelRef}
          style={{
            opacity: 0,
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--paper)',
            fontFamily: 'var(--font-mono)',
            userSelect: 'none',
          }}
        >
          View
        </span>
      </div>
    </div>
  );
}
