import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from './reveal';

let hasPlayedIntro = false;

export function IntroOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => !hasPlayedIntro && !prefersReducedMotion());

  useEffect(() => {
    if (!visible || !overlayRef.current) {
      hasPlayedIntro = true;
      return;
    }

    const el = overlayRef.current;
    const ctx = gsap.context(() => {
      const lines = el.querySelectorAll('[data-intro-line]');
      const tl = gsap.timeline({
        onComplete: () => {
          hasPlayedIntro = true;
          setVisible(false);
        },
      });

      tl.fromTo(
        lines,
        { yPercent: 110, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.48,
          stagger: 0.1,
          ease: 'power3.out',
        }
      ).to(
        el,
        {
          yPercent: -100,
          duration: 0.42,
          ease: 'power3.inOut',
        },
        '+=0.15'
      );
    }, el);

    return () => ctx.revert();
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--ink)',
        color: 'var(--paper)',
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <div
          data-intro-line
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 44,
            letterSpacing: '-0.03em',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="8" height="8" stroke="#F3EFE6" strokeWidth="1.8" />
            <rect x="14" y="2" width="8" height="8" fill="#FF5B1F" />
            <rect x="2" y="14" width="8" height="8" stroke="#F3EFE6" strokeWidth="1.8" />
            <rect x="14" y="14" width="8" height="8" stroke="#F3EFE6" strokeWidth="1.8" />
          </svg>
          <span>Lattice</span>
        </div>
      </div>
      <div style={{ overflow: 'hidden' }}>
        <div
          data-intro-line
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
          }}
        >
          AICTE Complaint Intelligence
        </div>
      </div>
    </div>
  );
}

export function SplitHeading({
  text,
  className = 'page-title',
  as: Tag = 'h1',
}: {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  const words = text.split(' ');
  return (
    <Tag className={className}>
      {words.map((word, idx) => (
        <React.Fragment key={idx}>
          <span className="word-mask">
            <span className="word-inner">{word}</span>
          </span>
          {idx < words.length - 1 ? ' ' : ''}
        </React.Fragment>
      ))}
    </Tag>
  );
}
