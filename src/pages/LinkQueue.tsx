import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Check, X, ArrowUpRight, Lock } from 'lucide-react';
import { api, getStoredUser } from '../api/client';
import type { LinkQueueItem } from '../api/types';
import { UnitBadge, SeverityBadge, StatusBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { PageSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useReveal } from '../motion/reveal';

export function LinkQueue() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<'pending' | 'resolved'>('pending');
  const [items, setItems] = useState<LinkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const user = getStoredUser();

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLinkQueue(tab);
      setItems(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load institution-link queue');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useReveal(containerRef, [loading, tab]);

  const handleResolve = async (id: number, resolution: 'confirmed' | 'dismissed') => {
    setResolvingId(id);
    try {
      await api.resolveLinkQueueItem(id, resolution);
      showToast(
        resolution === 'confirmed'
          ? 'Institution case link confirmed and recorded in audit trail'
          : 'Institution case link dismissed from queue'
      );
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      showToast(err?.message || 'Unable to resolve institution-link queue item');
    } finally {
      setResolvingId(null);
    }
  };

  const canRoleResolve =
    user?.role === 'admin' || user?.role === 'bureau_head';

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Role Scope & Tabs Bar */}
      <div
        data-reveal
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 16,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            data-cursor="link"
            onClick={() => setTab('pending')}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 14,
              border: tab === 'pending' ? '1px solid var(--ink)' : '1px solid var(--line)',
              backgroundColor: tab === 'pending' ? 'var(--ink)' : 'var(--card)',
              color: tab === 'pending' ? 'var(--paper)' : 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            Pending Resolution
          </button>
          <button
            type="button"
            data-cursor="link"
            onClick={() => setTab('resolved')}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 14,
              border: tab === 'resolved' ? '1px solid var(--ink)' : '1px solid var(--line)',
              backgroundColor: tab === 'resolved' ? 'var(--ink)' : 'var(--card)',
              color: tab === 'resolved' ? 'var(--paper)' : 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            Resolved Links
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
          {user?.role === 'admin' ? (
            <span>
              <strong style={{ color: 'var(--ink)' }}>Admin Privilege:</strong> Authorized to resolve
              the institution-link queue.
            </span>
          ) : user?.role === 'bureau_head' ? (
            <span>
              <strong style={{ color: 'var(--ink)' }}>Bureau Head Privilege:</strong> Authorized to
              resolve the institution-link queue.
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Lock size={14} strokeWidth={1.8} />
              <span>
                Read-only: Only Bureau Head and Admin roles can resolve the institution-link queue.
              </span>
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <PageSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadQueue} />
      ) : items.length === 0 ? (
        <EmptyState
          title={
            tab === 'pending'
              ? 'No pending institution-link items in queue'
              : 'No resolved link items yet'
          }
          description={
            tab === 'pending'
              ? 'All detected duplicate, similar, and cross-cell complaint links in your scope have been reviewed.'
              : 'Confirmed or dismissed institution links will appear here for audit.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((item) => {
            const simPct = Math.round(item.similarity * 100);
            const isDup = item.type === 'Duplicate';
            const isSim = item.type === 'Similar';

            return (
              <div
                key={item.id}
                data-reveal
                className="lattice-card"
                style={{
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    paddingBottom: 12,
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Link2 size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
                    <button
                      type="button"
                      data-cursor="link"
                      onClick={() => navigate(`/institutions/${item.institution.id}`)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        fontWeight: 700,
                        fontSize: 15,
                        color: 'var(--ink)',
                        cursor: 'pointer',
                      }}
                    >
                      {item.institution.name}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                      ({item.institution.city}, {item.institution.state})
                    </span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: isDup
                          ? 'var(--risk-critical-bg)'
                          : isSim
                          ? 'var(--risk-watch-bg)'
                          : 'var(--paper-2)',
                        color: isDup
                          ? 'var(--risk-critical-text)'
                          : isSim
                          ? 'var(--risk-watch-text)'
                          : 'var(--ink-2)',
                      }}
                    >
                      {isDup ? 'Duplicate Cluster' : item.type} · {simPct}% similarity
                    </span>
                  </div>

                  {item.resolution_status === 'pending' ? (
                    item.can_resolve && canRoleResolve ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={resolvingId === item.id}
                          onClick={() => handleResolve(item.id, 'confirmed')}
                        >
                          <Check size={14} strokeWidth={1.8} />
                          <span>Confirm link</span>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={resolvingId === item.id}
                          onClick={() => handleResolve(item.id, 'dismissed')}
                        >
                          <X size={14} strokeWidth={1.8} />
                          <span>Dismiss</span>
                        </Button>
                      </div>
                    ) : (
                      <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        Pending resolution
                      </span>
                    )
                  ) : (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color:
                          item.resolution_status === 'confirmed'
                            ? 'var(--risk-low)'
                            : 'var(--ink-2)',
                      }}
                    >
                      {item.resolution_status.toUpperCase()} by {item.resolved_by}
                    </span>
                  )}
                </div>

                {/* Two linked cases side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[item.case_a, item.case_b].map((c) => {
                    const canViewCase =
                      user?.role === 'chairman' ||
                      user?.role === 'admin' ||
                      user?.unit_code === c.unit_code;
                    return (
                      <div
                        key={c.id}
                        data-cursor={canViewCase ? 'view' : undefined}
                        onClick={() => {
                          if (canViewCase) navigate(`/complaints/${c.id}`);
                        }}
                        style={{
                          padding: 14,
                          borderRadius: 10,
                          border: '1px solid var(--line)',
                          backgroundColor: 'var(--paper)',
                          cursor: canViewCase ? 'pointer' : 'default',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                              {c.ref}
                            </span>
                            <UnitBadge code={c.unit_code} />
                            <SeverityBadge severity={c.severity} />
                            <StatusBadge status={c.status} />
                          </div>
                          {canViewCase && (
                            <ArrowUpRight size={14} strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
                          )}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                          {c.title}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
