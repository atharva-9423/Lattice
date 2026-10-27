import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  FilePlus2,
  GitBranch,
  UserCheck,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import type { CaseEventItem } from '../api/types';
import { prefersReducedMotion } from '../motion/reveal';

function getEventIcon(type: string) {
  switch (type) {
    case 'Created':
      return <FilePlus2 size={16} strokeWidth={1.6} />;
    case 'Routed':
      return <GitBranch size={16} strokeWidth={1.6} />;
    case 'Assigned':
      return <UserCheck size={16} strokeWidth={1.6} />;
    case 'StatusChanged':
      return <RefreshCw size={16} strokeWidth={1.6} />;
    case 'Escalated':
      return <AlertTriangle size={16} strokeWidth={1.6} style={{ color: 'var(--risk-critical)' }} />;
    case 'Linked':
      return <Link2 size={16} strokeWidth={1.6} style={{ color: 'var(--accent)' }} />;
    default:
      return <MessageSquare size={16} strokeWidth={1.6} />;
  }
}

export function Timeline({ events }: { events: CaseEventItem[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(events.length);

  useEffect(() => {
    const el = listRef.current;
    if (!el || prefersReducedMotion()) {
      prevCountRef.current = events.length;
      return;
    }

    if (events.length > prevCountRef.current) {
      const items = el.querySelectorAll('[data-timeline-row]');
      const newest = items[items.length - 1];
      if (newest) {
        const ctx = gsap.context(() => {
          gsap.fromTo(
            newest,
            { x: 24, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }
          );
        }, el);
        prevCountRef.current = events.length;
        return () => ctx.revert();
      }
    }
    prevCountRef.current = events.length;
  }, [events.length]);

  return (
    <div ref={listRef} style={{ display: 'flex', flexDirection: 'column' }}>
      {events.map((ev, idx) => {
        const isLast = idx === events.length - 1;
        const dt = new Date(ev.created_at);
        const formatted = dt.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div
            key={ev.id}
            data-timeline-row
            style={{
              display: 'flex',
              gap: 16,
              position: 'relative',
              paddingBottom: isLast ? 0 : 20,
            }}
          >
            {!isLast && (
              <div
                style={{
                  position: 'absolute',
                  left: 15,
                  top: 32,
                  bottom: 0,
                  width: 1,
                  backgroundColor: 'var(--line)',
                }}
              />
            )}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--paper-2)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--ink)',
              }}
            >
              {getEventIcon(ev.type)}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  {ev.actor}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>· {ev.type}</span>
                </div>
                <span className="font-mono tabular-nums" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {formatted}
                </span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{ev.message}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
