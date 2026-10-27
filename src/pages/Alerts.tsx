import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, ArrowRight, FileText, Building2 } from 'lucide-react';
import { api, getStoredUser } from '../api/client';
import type { AlertItem } from '../api/types';
import { SeverityBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { PageSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { useReveal } from '../motion/reveal';
import { useToast } from '../components/Toast';

const RULE_TITLES: Record<string, string> = {
  R1: 'Volume Spike Trigger',
  R2: 'Cross-Unit Convergence',
  R3: 'SLA Breach Imminent',
  R4: 'Risk Threshold Crossing',
};

export function Alerts() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = getStoredUser();
  const isGlobalScope = user?.role === 'chairman' || user?.role === 'admin';
  const canAcknowledge = user?.role === 'chairman' || user?.role === 'bureau_head';

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'Critical' | 'High'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ackId, setAckId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const loadAlerts = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getAlerts('all');
      setAlerts(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useReveal(containerRef, [loading, filter]);

  const handleAck = async (id: number) => {
    setAckId(id);
    try {
      await api.acknowledgeAlert(id);
      showToast('Alert acknowledged', 'success');
      await loadAlerts();
    } catch (err: any) {
      showToast(err?.message || 'Acknowledge failed', 'error');
    } finally {
      setAckId(null);
    }
  };

  if (loading) return <PageSkeleton rows={4} />;
  if (error) return <ErrorState message={error} onRetry={loadAlerts} />;

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'unacknowledged') return !a.acknowledged;
    if (filter === 'Critical') return a.severity === 'Critical';
    if (filter === 'High') return a.severity === 'High';
    return true;
  });

  const unackCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Bar */}
      <div
        className="lattice-card"
        data-reveal
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="micro-label">Early Warning Feed · Rule-Based Triggers (R1–R4)</span>
            {unackCount > 0 && (
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 6,
                  backgroundColor: 'var(--risk-critical-bg)',
                  color: 'var(--risk-critical-text)',
                }}
              >
                {unackCount} UNACKNOWLEDGED
              </span>
            )}
          </div>
          <h2 className="section-heading" style={{ marginTop: 4 }}>
            Pattern spikes, SLA breaches & threshold crossings
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--ink-2)' }}>
            {isGlobalScope
              ? 'Showing national alerts across all AICTE bureaus and monitored institutions.'
              : 'Monitoring active pattern triggers, SLA risks, and institutional threshold crossings.'}
          </p>
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 4,
            borderRadius: 10,
            backgroundColor: 'var(--paper-2)',
            border: '1px solid var(--line)',
          }}
        >
          {(['all', 'unacknowledged', 'Critical', 'High'] as const).map((tab) => {
            const active = filter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className="font-mono"
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  border: 'none',
                  backgroundColor: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--paper)' : 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                {tab === 'all'
                  ? `All (${alerts.length})`
                  : tab === 'unacknowledged'
                  ? `Unread (${unackCount})`
                  : tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alert Cards */}
      {filteredAlerts.length === 0 ? (
        <EmptyState
          title="No alerts match this filter"
          description="All pattern triggers and SLA monitors are clear for the selected scope."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredAlerts.map((alert) => {
            const isCrit = alert.severity === 'Critical';
            const ruleDisplay = alert.rule_label || RULE_TITLES[alert.rule] || alert.rule || 'ALERT';
            return (
              <div
                key={alert.id}
                className="lattice-card"
                data-reveal
                style={{
                  opacity: alert.acknowledged ? 0.72 : 1,
                  borderColor:
                    !alert.acknowledged && isCrit ? 'var(--risk-critical-dot)' : 'var(--line)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: '1 1 420px' }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: isCrit
                          ? 'var(--risk-critical-bg)'
                          : 'var(--risk-watch-bg)',
                        color: isCrit ? 'var(--risk-critical-text)' : 'var(--risk-watch-text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <AlertTriangle size={18} strokeWidth={1.8} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <SeverityBadge severity={alert.severity} />
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 5,
                            backgroundColor: 'var(--paper-2)',
                            border: '1px solid var(--line)',
                          }}
                        >
                          {alert.rule} · {ruleDisplay.toUpperCase()}
                        </span>
                        {alert.institution_id && alert.institution_name && (
                          <button
                            type="button"
                            onClick={() => navigate(`/institutions/${alert.institution_id}`)}
                            className="font-mono"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--accent)',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                            }}
                          >
                            <Building2 size={13} strokeWidth={1.8} />
                            <span>{alert.institution_name}</span>
                          </button>
                        )}
                        {alert.complaint_id && alert.complaint_ref && (
                          <button
                            type="button"
                            onClick={() => navigate(`/complaints/${alert.complaint_id}`)}
                            className="font-mono"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--ink)',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                            }}
                          >
                            <FileText size={13} strokeWidth={1.8} />
                            <span>{alert.complaint_ref}</span>
                          </button>
                        )}
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          ·{' '}
                          {new Date(alert.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', lineHeight: 1.45 }}>
                        {alert.message}
                      </div>

                      {alert.acknowledged && alert.acknowledged_by && (
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          Acknowledged by {alert.acknowledged_by}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {alert.institution_id && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/institutions/${alert.institution_id}`)}
                      >
                        <span>Inspect Institution</span>
                        <ArrowRight size={14} strokeWidth={1.8} />
                      </Button>
                    )}

                    {alert.complaint_id && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/complaints/${alert.complaint_id}`)}
                      >
                        <span>View Case</span>
                        <ArrowRight size={14} strokeWidth={1.8} />
                      </Button>
                    )}

                    {alert.acknowledged ? (
                      <span
                        className="font-mono"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: 'var(--risk-low-bg)',
                          color: 'var(--risk-low-text)',
                        }}
                      >
                        <Check size={14} strokeWidth={2} />
                        <span>ACKED</span>
                      </span>
                    ) : canAcknowledge ? (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={ackId === alert.id}
                        onClick={() => handleAck(alert.id)}
                      >
                        <span>{ackId === alert.id ? '...' : 'Acknowledge'}</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
