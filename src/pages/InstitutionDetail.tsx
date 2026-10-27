import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowLeft, AlertTriangle, Plus, ArrowRight } from 'lucide-react';
import { api, getStoredUser } from '../api/client';
import type { InstitutionDetailResponse, GraphResponse } from '../api/types';
import {
  BandBadge,
  UnitBadge,
  SeverityBadge,
  StatusBadge,
  SlaIndicator,
} from '../components/Badge';
import { RiskMeter } from '../components/RiskMeter';
import { LinkGraph } from '../components/LinkGraph';
import { Sparkline } from '../components/Charts';
import { Button } from '../components/Button';
import { PageSkeleton } from '../components/Skeleton';
import { ErrorState } from '../components/EmptyState';
import { useReveal, prefersReducedMotion } from '../motion/reveal';
import { useCountUp } from '../motion/countup';

export function InstitutionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = getStoredUser();
  const canRegisterComplaint = Boolean(user?.permissions?.can_register_complaint);
  const containerRef = useRef<HTMLDivElement>(null);

  const [inst, setInst] = useState<InstitutionDetailResponse | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scoreRef = useCountUp(inst?.score || 0, 1.2);

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [instData, graphData] = await Promise.all([
        api.getInstitution(Number(id)),
        api.getInstitutionGraph(Number(id)),
      ]);
      setInst(instData);
      setGraph(graphData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load institution dossier');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useReveal(containerRef, [loading, id]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || loading || !inst || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const factorBars = el.querySelectorAll('[data-factor-bar]');
      gsap.fromTo(
        factorBars,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.85,
          stagger: 0.07,
          ease: 'power3.out',
          transformOrigin: 'left center',
        }
      );
    }, el);
    return () => ctx.revert();
  }, [loading, inst]);

  if (loading) return <PageSkeleton rows={6} />;
  if (error || !inst || !graph) {
    return <ErrorState message={error || 'Institution not found'} onRetry={loadAll} />;
  }

  const totalPointsSum = Math.round(
    inst.factors.reduce((acc, f) => acc + f.points, 0)
  );

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Top Link */}
      <div data-reveal>
        <Link
          to="/institutions"
          data-cursor="link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--ink-2)',
          }}
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
          <span>Back to institutions directory</span>
        </Link>
      </div>

      {/* High / Critical Callout Banner */}
      {inst.pattern_summary && (
        <div
          data-reveal
          style={{
            padding: '16px 22px',
            borderRadius: 14,
            backgroundColor:
              inst.band === 'Critical' ? 'var(--risk-critical-bg)' : 'var(--risk-high-bg)',
            border: '1px solid var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle
              size={20}
              strokeWidth={1.8}
              style={{
                color:
                  inst.band === 'Critical'
                    ? 'var(--risk-critical-text)'
                    : 'var(--risk-high-text)',
                flexShrink: 0,
              }}
            />
            <div>
              <span
                className="micro-label"
                style={{
                  color:
                    inst.band === 'Critical'
                      ? 'var(--risk-critical-text)'
                      : 'var(--risk-high-text)',
                }}
              >
                Cross-Bureau Risk Pattern Detected
              </span>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginTop: 2 }}>
                {inst.pattern_summary}
              </div>
            </div>
          </div>

          {canRegisterComplaint && (
            <Button
              variant="primary"
              size="sm"
              magnetic
              onClick={() => navigate(`/complaints/new?institution_id=${inst.id}`)}
            >
              <Plus size={15} strokeWidth={1.8} />
              <span>File complaint for {inst.name.split(' ')[0]}</span>
            </Button>
          )}
        </div>
      )}

      {/* Institution Header Card */}
      <div
        className="lattice-card"
        data-reveal
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="micro-label">{inst.type} Institution</span>
            <span>·</span>
            <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              Est. {inst.established_year} · Approved Intake {inst.intake}
            </span>
          </div>
          <h1 className="page-title" style={{ fontSize: 36 }}>
            {inst.name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>
              {inst.city}, {inst.state}
            </span>
            <span>·</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Units involved:</span>
              {inst.units_involved.map((u) => (
                <UnitBadge key={u} code={u} />
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            paddingLeft: 24,
            borderLeft: '1px solid var(--line)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="micro-label">Composite Score</span>
              <BandBadge band={inst.band} />
            </div>
            <RiskMeter score={inst.score} band={inst.band} showNumeral={false} size="lg" />
          </div>
          <div
            className="stat-numeral"
            style={{
              fontSize: 64,
              color: inst.score >= 80 ? 'var(--accent)' : 'var(--ink)',
            }}
          >
            <span ref={scoreRef}>{inst.score}</span>
          </div>
        </div>
      </div>

      {/* Row: Why This Score (7 cols) + 12-Week Score History (5 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 24, alignItems: 'stretch' }}>
        {/* Why This Score */}
        <div className="lattice-card" data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              paddingBottom: 12,
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div>
              <span className="micro-label">Explainable Formula (90-Day Window)</span>
              <h2 className="card-heading" style={{ marginTop: 2 }}>
                Why this score is {inst.score}
              </h2>
            </div>
            <span className="font-mono tabular-nums" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              30V + 25S + 20R + 15A + 10X = {totalPointsSum} pts
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {inst.factors.map((f) => {
              const maxPts = Math.round(f.weight * 100);
              const pct = Math.min(100, Math.round(f.value * 100));
              return (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="font-mono"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          backgroundColor: 'var(--paper-2)',
                          border: '1px solid var(--line)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {f.key}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</span>
                      <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        (weight {Math.round(f.weight * 100)}%)
                      </span>
                    </div>
                    <div className="font-mono tabular-nums" style={{ fontSize: 13, fontWeight: 600 }}>
                      <span style={{ color: 'var(--ink)' }}>{f.points.toFixed(1)}</span>
                      <span style={{ color: 'var(--ink-3)' }}> / {maxPts} pts</span>
                    </div>
                  </div>

                  {/* Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: 8,
                      backgroundColor: 'var(--paper-2)',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      data-factor-bar
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: pct >= 75 ? 'var(--accent)' : 'var(--ink)',
                        borderRadius: 4,
                      }}
                    />
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{f.explanation}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 12-Week Score History */}
        <div className="lattice-card" data-reveal style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <span className="micro-label">Historical Trajectory</span>
            <h2 className="card-heading" style={{ marginTop: 2 }}>
              12-week risk score history
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: 13, color: 'var(--ink-2)' }}>
              Weekly rolling evaluation of the 90-day risk formula across all bureaus and cells.
            </p>
          </div>

          <div style={{ padding: '12px 0' }}>
            <Sparkline
              values={inst.sparkline}
              band={inst.band}
              width={440}
              height={160}
              fillArea
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              paddingTop: 12,
              borderTop: '1px solid var(--line)',
            }}
          >
            {inst.history.filter((_, idx) => idx % 3 === 2).map((h) => (
              <div key={h.week} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {h.week}
                </span>
                <span className="font-mono tabular-nums" style={{ fontSize: 15, fontWeight: 600 }}>
                  {h.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cross-Unit Case Link Graph */}
      <div className="lattice-card" data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <span className="micro-label" style={{ color: 'var(--accent)' }}>
            Cross-Cell Case Linking Topology
          </span>
          <h2 className="section-heading" style={{ marginTop: 4 }}>
            Institutional complaint link graph
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: 'var(--ink-2)' }}>
            Complaints filed in separate bureaus and cells are linked by TF-IDF similarity
            (Duplicate and Similar clusters) and 45-day cross-unit context edges.
          </p>
        </div>

        <LinkGraph institutionName={inst.name} graph={graph} />
      </div>

      {/* Institution Complaints Table */}
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
            <span className="micro-label">Case History</span>
            <h2 className="card-heading" style={{ marginTop: 2 }}>
              Complaints filed against {inst.name} ({inst.complaints.length})
            </h2>
          </div>
          {canRegisterComplaint && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/complaints/new?institution_id=${inst.id}`)}
            >
              <Plus size={14} strokeWidth={1.8} />
              <span>File new complaint</span>
            </Button>
          )}
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Title & Category</th>
              <th>Unit</th>
              <th>Severity</th>
              <th>Status</th>
              <th>SLA</th>
              <th>Filed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inst.complaints.map((c) => (
              <tr
                key={c.id}
                data-cursor="view"
                className="data-table-row"
                onClick={() => navigate(`/complaints/${c.id}`)}
              >
                <td className="font-mono tabular-nums" style={{ fontSize: 13, fontWeight: 500 }}>
                  <div className="data-table-row-bg" />
                  {c.ref}
                </td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                    {c.category}
                  </div>
                </td>
                <td>
                  <UnitBadge code={c.unit_code} />
                </td>
                <td>
                  <SeverityBadge severity={c.severity} />
                </td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>
                  <SlaIndicator state={c.sla_state} probability={c.breach_probability} />
                </td>
                <td className="font-mono tabular-nums" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                  {new Date(c.created_at).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </td>
                <td style={{ textAlign: 'right' }}>
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
    </div>
  );
}
