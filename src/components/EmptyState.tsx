import React from 'react';
import { Button } from './Button';
import { EmptyListIllustration, NoAlertsIllustration } from './Illustration';

export function EmptyState({
  title,
  description,
  kind = 'list',
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  kind?: 'list' | 'alerts';
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="lattice-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 14,
      }}
    >
      {kind === 'alerts' ? <NoAlertsIllustration /> : <EmptyListIllustration />}
      <h3 className="card-heading">{title}</h3>
      <p style={{ margin: 0, maxWidth: 420, color: 'var(--ink-2)', fontSize: 14 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <div style={{ marginTop: 6 }}>
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="lattice-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 12,
      }}
    >
      <div className="micro-label" style={{ color: 'var(--risk-critical)' }}>
        Unable to load data
      </div>
      <h3 className="card-heading">{message}</h3>
      <div style={{ marginTop: 8 }}>
        <Button variant="secondary" onClick={onRetry}>
          Retry request
        </Button>
      </div>
    </div>
  );
}
