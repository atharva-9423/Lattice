import React from 'react';

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
}) {
  return (
    <div
      className="skeleton-block"
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="lattice-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton width={90} height={12} />
            <Skeleton width={110} height={52} />
            <Skeleton width="75%" height={14} />
          </div>
        ))}
      </div>
      <div className="lattice-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} width="100%" height={38} />
        ))}
      </div>
    </div>
  );
}
