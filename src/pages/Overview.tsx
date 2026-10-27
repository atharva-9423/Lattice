import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, Link2, Users } from 'lucide-react';
import { api, getStoredUser } from '../api/client';
import type { OverviewResponse } from '../api/types';
import { StatTile } from '../components/Stat';
import { WeeklyTrendChart, UnitWorkloadBars, Sparkline } from '../components/Charts';
import { RiskMeter } from '../components/RiskMeter';
import { BandBadge, SeverityBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { PageSkeleton } from '../components/Skeleton';
import { ErrorState } from '../components/EmptyState';
import { useReveal } from '../motion/reveal';
import { useToast } from '../components/Toast';

export function Overview() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = getStoredUser();
  const containerRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ackingId, setAckingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getOverview();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useReveal(containerRef, [loading]);

  const handleAcknowledge = async (e: React.MouseEvent, alertId: number) => {
    e.stopPropagation();
    setAckingId(alertId);
    try {
      await api.acknowledgeAlert(alertId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              recent_alerts: prev.recent_alerts.filter((a) => a.id !== alertId),
            }
          : prev
      );
      showToast('Alert acknowledged and logged', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not acknowledge alert', 'error');
    } finally {
      setAckingId(null);
    }
  };

  if (loading) return <PageSkeleton rows={4} />;
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={loadData} />;

  const isBureauDashboard = data.dashboard_type === 'bureau' || user?.role === 'bureau_head';
  const totalCatCount = data.category_split.reduce((acc, c) => acc + c.count, 0) || 1;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Role-Specific Dashboard Header Banner */}
      <div
        data-reveal
        className="lattice-card"
        style={{
          padding: '18px 24px',
          backgroundColor: isBureauDashboard ? 'var(--surface)' : 'var(--paper-2)',
          borderLeft: `4px solid ${isBureauDashboard ? 'var(--accent)' : 'var(--ink)'}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: isBureauDashboard ? 'rgba(184, 80, 30, 0.14)' : 'var(--ink)',
                color: isBureauDashboard ? 'var(--accent)' : 'var(--paper)',
              }}
            >
              {isBureauDashboard ? 'BUREAU DASHBOARD' : 'CHAIRMAN DASHBOARD'}
            </span>
          </div>
          <h2 className="section-heading" style={{ marginTop: 6 }}>
            {isBureauDashboard
              ? 'Bureau Head Operational Command & Officer Workload'
              : 'National Regulatory Command & Cross-Bureau Risk Intelligence'}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13.5, color: 'var(--ink-2)' }}>
            {isBureauDashboard
              ? 'Manage case officer assignments, monitor SLA deadlines, and resolve institution-link candidates.'
              : 'Executive oversight across all AICTE complaints, institutional risk trajectories, and SLA compliance.'}
          </p>
        </div>

        {isBureauDashboard && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/link-queue')}
            >
              <Link2 size={14} strokeWidth={1.8} />
              <span>Link Queue ({data.stats.pending_links || 0} Pending)</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/complaints')}
            >
              <span>Manage Dockets</span>
              <ArrowRight size={14} strokeWidth={1.8} />
            </Button>
          </div>
        )}
      </div>

      {/* Row 1: 4 Stat Cards */}
      <div
        data-reveal
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 20,
        }}
      >
        <StatTile
          label={isBureauDashboard ? 'Open Cases' : 'Open Complaints'}
          value={data.stats.open}
          caption={`${data.stats.resolved_30d} resolved in last 30 days`}
        />
        <StatTile
          label="SLA At Risk / Breached"
          value={data.stats.at_risk + data.stats.breached}
          highlight={data.stats.breached > 0}
          caption={`${data.stats.breached} breached · ${data.stats.at_risk} approaching window`}
        />
        {isBureauDashboard ? (
          <StatTile
            label="Pending Link Queue"
            value={data.stats.pending_links || 0}
            highlight={(data.stats.pending_links || 0) > 0}
            caption="Candidate duplicate/context links awaiting Bureau Head review"
          />
        ) : (
          <StatTile
            label="High-Risk Institutions"
            value={data.stats.high_risk_institutions}
            caption="Composite score ≥ 60 (High & Critical)"
          />
        )}
        <StatTile
          label="Median Resolution Days"
          value={Math.round(data.stats.avg_resolution_days)}
          caption={`Avg ${data.stats.avg_resolution_days}d · 90-day rolling turnaround`}
        />
      </div>

      {/* Row 2: 12-Week Trend (7 cols) + Workload / Officer Distribution (5 cols) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '7fr 5fr',
          gap: 24,
          alignItems: 'stretch',
        }}
      >
        {/* 12-Week Intake Trend */}
        <div
          className="lattice-card"
          data-reveal
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <span className="micro-label">12-Week Intake Trajectory</span>
              <h2 className="card-heading" style={{ marginTop: 4 }}>
                Weekly complaint volume
              </h2>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[
                { code: 'SGC', color: '#8A3B12', label: 'SGC' },
                { code: 'ACB', color: '#1F568B', label: 'ACB' },
                { code: 'AB', color: '#5A3E85', label: 'AB' },
                { code: 'VC', color: '#946200', label: 'VC' },
              ].map((item) => (
                <span
                  key={item.code}
                  className="font-mono"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: 'var(--ink-2)',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: item.color,
                    }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <WeeklyTrendChart data={data.trend} />
        </div>

        {/* Right Card: Bureau Dashboard shows Officer Workload; Chairman Dashboard shows Unit Workload + Category Split */}
        {isBureauDashboard && data.officer_workload ? (
          <div
            className="lattice-card"
            data-reveal
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18 }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
                <span className="micro-label">Bureau Case Officer Roster</span>
              </div>
              <h2 className="card-heading" style={{ marginTop: 4 }}>
                Officer assignment & SLA load
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: 'var(--ink-2)' }}>
                As Bureau Head, you can assign or reassign any complaint to these officers.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.officer_workload.slice(0, 5).map((off) => (
                <div
                  key={off.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    backgroundColor: 'var(--paper)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                      {off.name}
                    </div>
                    <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                      {off.title}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-mono tabular-nums" style={{ fontSize: 15, fontWeight: 600 }}>
                        {off.assigned_open}
                      </div>
                      <div className="micro-label" style={{ fontSize: 9.5 }}>Open</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        className="font-mono tabular-nums"
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: off.at_risk > 0 ? 'var(--risk-critical-text)' : 'var(--ink-2)',
                        }}
                      >
                        {off.at_risk}
                      </div>
                      <div className="micro-label" style={{ fontSize: 9.5 }}>At Risk</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        className="font-mono tabular-nums"
                        style={{ fontSize: 15, fontWeight: 600, color: 'var(--risk-low-text)' }}
                      >
                        {off.resolved_30d}
                      </div>
                      <div className="micro-label" style={{ fontSize: 9.5 }}>30d Res</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                borderTop: '1px solid var(--line)',
                paddingTop: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span className="micro-label">Top Complaint Categories</span>
              {data.category_split.slice(0, 3).map((cat) => {
                const pct = Math.round((cat.count / totalCatCount) * 100);
                return (
                  <div
                    key={cat.category}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12.5,
                    }}
                  >
                    <span style={{ color: 'var(--ink-2)' }}>{cat.category}</span>
                    <span className="font-mono tabular-nums" style={{ fontWeight: 600 }}>
                      {cat.count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            className="lattice-card"
            data-reveal
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}
          >
            <div>
              <span className="micro-label">Active Docket Distribution</span>
              <h2 className="card-heading" style={{ marginTop: 4 }}>
                Unit workload & SLA risk
              </h2>
            </div>

            <UnitWorkloadBars items={data.unit_workload} />

            <div
              style={{
                borderTop: '1px solid var(--line)',
                paddingTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span className="micro-label">Top Categories (90d)</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.category_split.slice(0, 4).map((cat) => {
                  const pct = Math.round((cat.count / totalCatCount) * 100);
                  return (
                    <div
                      key={cat.category}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: 'var(--ink-2)' }}>{cat.category}</span>
                      <span className="font-mono tabular-nums" style={{ fontSize: 12, fontWeight: 500 }}>
                        {cat.count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 3: Watchlist Table (7 cols) + Early Warning Alerts (5 cols) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '7fr 5fr',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* High-Risk Watchlist */}
        <div className="lattice-card" data-reveal style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span className="micro-label">Composite Risk Index</span>
              <h2 className="card-heading" style={{ marginTop: 2 }}>
                Institution watchlist
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/institutions')}
            >
              <span>All institutions</span>
              <ArrowRight size={14} strokeWidth={1.6} />
            </Button>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Risk Score</th>
                <th>Band</th>
                <th style={{ textAlign: 'right' }}>Open</th>
                <th>12w Trend</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.watchlist.map((inst) => (
                <tr
                  key={inst.id}
                  data-cursor="view"
                  className="data-table-row"
                  onClick={() => navigate(`/institutions/${inst.id}`)}
                >
                  <td>
                    <div className="data-table-row-bg" />
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                      {inst.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                      {inst.city}, {inst.state}
                    </div>
                  </td>
                  <td>
                    <RiskMeter score={inst.score} band={inst.band} size="sm" />
                  </td>
                  <td>
                    <BandBadge band={inst.band} />
                  </td>
                  <td
                    className="font-mono tabular-nums"
                    style={{ textAlign: 'right', fontWeight: 600 }}
                  >
                    {inst.open_cases}
                  </td>
                  <td>
                    <Sparkline values={inst.sparkline} band={inst.band} width={96} height={26} />
                  </td>
                  <td style={{ textAlign: 'right', width: 32 }}>
                    <ArrowRight
                      size={16}
                      strokeWidth={1.6}
                      className="data-table-row-arrow"
                      style={{ color: 'var(--ink-2)' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Early Warning Alerts Feed */}
        <div className="lattice-card" data-reveal style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span className="micro-label">Rule Engine R1–R4</span>
              <h2 className="card-heading" style={{ marginTop: 2 }}>
                Early-warning alerts
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/alerts')}>
              <span>Full feed</span>
              <ArrowRight size={14} strokeWidth={1.6} />
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.recent_alerts.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-2)', fontSize: 14 }}>
                All active alerts have been acknowledged.
              </div>
            ) : (
              data.recent_alerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => {
                    if (alert.institution_id) navigate(`/institutions/${alert.institution_id}`);
                    else if (alert.complaint_id) navigate(`/complaints/${alert.complaint_id}`);
                  }}
                  style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--line-soft)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <AlertTriangle
                      size={17}
                      strokeWidth={1.8}
                      style={{
                        color:
                          alert.severity === 'Critical'
                            ? 'var(--risk-critical-text)'
                            : 'var(--risk-watch-text)',
                        marginTop: 2,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--ink-2)',
                          }}
                        >
                          {alert.rule} · {alert.rule_label}
                        </span>
                        <SeverityBadge severity={alert.severity} />
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>
                        {alert.message}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={ackingId === alert.id}
                    onClick={(e) => handleAcknowledge(e, alert.id)}
                    title="Acknowledge alert"
                  >
                    <Check size={14} strokeWidth={1.8} />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
