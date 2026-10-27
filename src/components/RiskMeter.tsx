import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { RiskBand } from '../api/types';
import { prefersReducedMotion } from '../motion/reveal';

export function getBandColorVar(band: RiskBand): string {
  switch (band) {
    case 'Critical':
      return 'var(--risk-critical)';
    case 'High':
      return 'var(--risk-high)';
    case 'Watch':
      return 'var(--risk-watch)';
    default:
      return 'var(--risk-low)';
  }
}

export function RiskMeter({
  score,
  band,
  showNumeral = true,
  size = 'md',
}: {
  score: number;
  band: RiskBand;
  showNumeral?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const filledCount = Math.max(0, Math.min(10, Math.round(score / 10)));
  const activeColor = getBandColorVar(band);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const segs = el.querySelectorAll('[data-seg-filled="true"]');
      if (segs.length > 0) {
        gsap.fromTo(
          segs,
          { scaleY: 0.25, opacity: 0.2 },
          {
            scaleY: 1,
            opacity: 1,
            duration: 0.35,
            stagger: 0.02,
            ease: 'power3.out',
          }
        );
      }
    }, el);

    return () => ctx.revert();
  }, [score, filledCount]);

  const segHeight = size === 'lg' ? 18 : size === 'sm' ? 10 : 14;
  const segWidth = size === 'lg' ? 12 : size === 'sm' ? 7 : 9;

  return (
    <div
      ref={wrapRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
      }}
      aria-label={`Risk score ${score} out of 100 (${band} band)`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {Array.from({ length: 10 }).map((_, idx) => {
          const isFilled = idx < filledCount;
          return (
            <span
              key={idx}
              data-seg-filled={isFilled ? 'true' : 'false'}
              style={{
                width: segWidth,
                height: segHeight,
                borderRadius: 2,
                backgroundColor: isFilled ? activeColor : 'var(--paper-2)',
                border: isFilled ? 'none' : '1px solid var(--line)',
                display: 'inline-block',
                transformOrigin: 'bottom center',
              }}
            />
          );
        })}
      </div>
      {showNumeral && (
        <span
          className="font-mono tabular-nums"
          style={{
            fontWeight: 600,
            fontSize: size === 'lg' ? 18 : 14,
            color: 'var(--ink)',
          }}
        >
          {score}
        </span>
      )}
    </div>
  );
}
