import React from 'react';
import { useCountUp } from '../motion/countup';

export function StatTile({
  label,
  value,
  caption,
  highlight = false,
}: {
  label: string;
  value: number;
  caption: string;
  highlight?: boolean;
}) {
  const numRef = useCountUp(value, 1.2);

  return (
    <div className="lattice-card" data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span className="micro-label">{label}</span>
      <div
        className="stat-numeral"
        style={{ color: highlight ? 'var(--accent)' : 'var(--ink)' }}
      >
        <span ref={numRef}>{value}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{caption}</div>
    </div>
  );
}
