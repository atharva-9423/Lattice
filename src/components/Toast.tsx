import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from '../motion/reveal';

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (el && !prefersReducedMotion()) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          el,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.32, ease: 'power3.out' }
        );
        if (checkRef.current) {
          const len = 24;
          gsap.fromTo(
            checkRef.current,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 0.45, delay: 0.1, ease: 'power2.out' }
          );
        }
      }, el);
      return () => ctx.revert();
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 4000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      ref={cardRef}
      role="status"
      style={{
        backgroundColor: 'var(--ink)',
        color: 'var(--paper)',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 14,
        fontWeight: 500,
        border: '1px solid var(--ink)',
        maxWidth: 420,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="8" stroke="#FF5B1F" strokeWidth="1.6" />
        <path
          ref={checkRef}
          d="M 5.5 9.2 L 8 11.7 L 12.8 6.5"
          stroke="#F3EFE6"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{item.message}</span>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 8000,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
