import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Link2,
  AlertTriangle,
  Lock,
  Building2,
  Send,
  RotateCcw,
  EyeOff,
  Check,
  X,
} from 'lucide-react';
import { api, getStoredUser } from '../api/client';
import type { ComplaintDetail as ComplaintDetailType } from '../api/types';
import {
  UnitBadge,
  SeverityBadge,
  StatusBadge,
  BandBadge,
  SlaIndicator,
  CustomSelect,
} from '../components/Badge';
import { Button } from '../components/Button';
import { RiskMeter } from '../components/RiskMeter';
import { Timeline } from '../components/Timeline';
import { PageSkeleton } from '../components/Skeleton';
import { ErrorState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useReveal } from '../motion/reveal';

export function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<ComplaintDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOfficer, setSelectedOfficer] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [noteText, setNoteText] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const user = getStoredUser();

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getComplaint(Number(id));
      setData(res);
      setSelectedOfficer(res.assigned_officer ? String(res.assigned_officer.id) : '');
      setSelectedStatus(res.status);
    } catch (err: any) {
      setError(err?.message || 'Unable to load complaint detail');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useReveal(containerRef, [loading, id]);

  if (loading) return <PageSkeleton rows={6} />;
  if (error || !data) return <ErrorState message={error || 'Complaint not found'} onRetry={loadDetail} />;

  // Exact role capability flags from backend
  const canAssign = data.allowed_actions.includes('assign');
  const canStatus = data.allowed_actions.includes('status');
  const canNote = data.allowed_actions.includes('note');
  const canEscalate = data.allowed_actions.includes('escalate');
  const canResolveLinks = data.allowed_actions.includes('resolve_links');

  const handleAssignOfficer = async (officerIdStr: string) => {
    setSelectedOfficer(officerIdStr);
    if (!officerIdStr || !canAssign) return;
    setSubmitting(true);
    try {
      const updated = await api.patchComplaint(data.id, {
        assigned_officer_id: Number(officerIdStr),
      });
      setData(updated);
      setSelectedStatus(updated.status);
      showToast('Officer assigned to case');
    } catch (err: any) {
      showToast(err?.message || 'Could not assign officer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setSelectedStatus(newStatus);
    if (!newStatus || newStatus === data.status || !canStatus) return;
    setSubmitting(true);
    try {
      const updated = await api.patchComplaint(data.id, { status: newStatus });
      setData(updated);
      setSelectedStatus(updated.status);
      showToast(`Case status updated to ${newStatus}`);
    } catch (err: any) {
      setSelectedStatus(data.status);
      showToast(err?.message || 'Could not update status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !canNote) return;
    setSubmitting(true);
    try {
      const updated = await api.patchComplaint(data.id, { note: noteText.trim() });
      setData(updated);
      setNoteText('');
      showToast('Action note added to case timeline');
    } catch (err: any) {
      showToast(err?.message || 'Could not add note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    if (!canEscalate) return;
    setSubmitting(true);
    try {
      const updated = await api.escalateComplaint(data.id);
      setData(updated);
      setSelectedStatus(updated.status);
      showToast(`Case ${data.ref} escalated for priority intervention`);
    } catch (err: any) {
      showToast(err?.message || 'Could not escalate case');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveLink = async (
    e: React.MouseEvent,
    linkId: number | undefined,
    resolution: 'confirmed' | 'dismissed'
  ) => {
    e.stopPropagation();
    if (!linkId || !canResolveLinks) return;
    setSubmitting(true);
    try {
      await api.resolveLinkQueueItem(linkId, resolution);
      showToast(`Institution link ${resolution}`);
      await loadDetail();
    } catch (err: any) {
      showToast(err?.message || 'Could not resolve institution link');
    } finally {
      setSubmitting(false);
    }
  };

  const dueFormatted = new Date(data.due_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const filedFormatted = new Date(data.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const elapsedPct = Math.round(data.sla.elapsed_ratio * 100);
  const probPct = Math.round(data.sla.breach_probability * 100);

  // Build status dropdown options based on current status + allowed_status_transitions
  const statusOptions = [
    { value: data.status, label: `${data.status} (Current)` },
    ...(data.allowed_status_transitions || []).map((st) => ({
      value: st,
      label:
        (data.status === 'Resolved' || data.status === 'Closed') && st === 'In Review'
          ? 'In Review (Reopen Case)'
          : `Transition → ${st}`,
    })),
  ];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Back link & Header */}
      <div data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Link
          to="/complaints"
          data-cursor="link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--ink-2)',
            width: 'fit-content',
          }}
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
          <span>Back to complaints registry</span>
        </Link>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            className="font-mono tabular-nums"
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}
          >
            {data.ref}
          </span>
          <span style={{ color: 'var(--line)' }}>·</span>
          <UnitBadge code={data.unit_code} showFull />
          <SeverityBadge severity={data.severity} />
          <StatusBadge status={data.status} />
          {data.is_assigned_to_me && (
            <span
              className="badge"
              style={{
                backgroundColor: 'var(--accent-tint)',
                color: 'var(--accent)',
                fontWeight: 700,
              }}
            >
              Assigned to you
            </span>
          )}
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Filed {filedFormatted} by {data.complainant_type}
          </span>
        </div>

        <h1 className="page-title" style={{ fontSize: 34 }}>
          {data.title}
        </h1>
      </div>

      {/* Two Columns (8/4) */}
      <div style={{ display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 24, alignItems: 'start' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Description Card (or Section 3.1 Metadata-Only Notice for Admin) */}
          <div className="lattice-card" data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="micro-label">Complaint Statement</span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                Category: <strong style={{ color: 'var(--ink)' }}>{data.category}</strong>
              </span>
            </div>

            {data.metadata_only ? (
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 10,
                  backgroundColor: 'var(--paper-2)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <EyeOff size={18} strokeWidth={1.8} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--ink)' }}>
                    Metadata-Only View (Section 3.1 — Admin Role):
                  </strong>{' '}
                  Free-text complaint narrative and investigation note contents are redacted for the
                  Admin role. You have full access to routing metadata, officer assignment, and
                  institution-link queue resolution.
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: 'var(--ink)' }}>
                {data.description}
              </p>
            )}
          </div>

          {/* Linked Cases Section */}
          <div className="lattice-card" data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 14,
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Link2 size={20} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
                <div>
                  <span className="micro-label">Cross-Cell Case Linking</span>
                  <h2 className="card-heading" style={{ marginTop: 2 }}>
                    Linked cases at {data.institution?.name || 'this institution'} ({data.links.length})
                  </h2>
                </div>
              </div>
              {data.cluster.size > 1 && (
                <span className="font-mono" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                  Similarity cluster of {data.cluster.size} cases
                </span>
              )}
            </div>

            {data.links.length === 0 ? (
              <div style={{ padding: '16px 0', color: 'var(--ink-2)', fontSize: 14 }}>
                No linked complaints found for this institution within the similarity or 45-day cross-unit window.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.links.map((lk) => {
                  const simPct = Math.round(lk.similarity * 100);
                  const isDup = lk.type === 'Duplicate';
                  const isSim = lk.type === 'Similar';
                  const canNavigateLinked =
                    user?.role === 'chairman' ||
                    user?.role === 'admin' ||
                    user?.unit_code === lk.unit_code;

                  return (
                    <div
                      key={lk.id}
                      data-cursor={canNavigateLinked ? 'view' : undefined}
                      onClick={() => {
                        if (canNavigateLinked) navigate(`/complaints/${lk.id}`);
                      }}
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        border: '1px solid var(--line)',
                        backgroundColor: 'var(--paper)',
                        cursor: canNavigateLinked ? 'pointer' : 'default',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                            {lk.ref}
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
                            {isDup ? 'Possible duplicate' : lk.type}
                          </span>
                          <UnitBadge code={lk.unit_code} />
                          <SeverityBadge severity={lk.severity} />
                          {lk.resolution_status && lk.resolution_status !== 'pending' && (
                            <span
                              className="font-mono"
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color:
                                  lk.resolution_status === 'confirmed'
                                    ? 'var(--risk-low)'
                                    : 'var(--ink-3)',
                              }}
                            >
                              · {lk.resolution_status}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div
                              style={{
                                width: 64,
                                height: 6,
                                backgroundColor: 'var(--paper-2)',
                                borderRadius: 3,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.max(8, simPct)}%`,
                                  height: '100%',
                                  backgroundColor: isDup
                                    ? 'var(--accent)'
                                    : isSim
                                    ? 'var(--ink)'
                                    : 'var(--ink-3)',
                                }}
                              />
                            </div>
                            <span className="font-mono tabular-nums" style={{ fontSize: 12, fontWeight: 600 }}>
                              {simPct}%
                            </span>
                          </div>
                          {canNavigateLinked && (
                            <ArrowUpRight size={15} strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                          {lk.title}
                        </div>

                        {/* Inline Institution-Link Resolution for Bureau Head (own bureau) and Admin */}
                        {canResolveLinks &&
                          lk.link_id &&
                          (!lk.resolution_status || lk.resolution_status === 'pending') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <button
                                type="button"
                                data-cursor="link"
                                disabled={submitting}
                                onClick={(e) => handleResolveLink(e, lk.link_id, 'confirmed')}
                                className="btn btn-secondary btn-sm"
                                style={{ height: 28, padding: '0 10px', fontSize: 11 }}
                              >
                                <Check size={12} strokeWidth={1.8} />
                                <span>Confirm link</span>
                              </button>
                              <button
                                type="button"
                                data-cursor="link"
                                disabled={submitting}
                                onClick={(e) => handleResolveLink(e, lk.link_id, 'dismissed')}
                                className="btn btn-ghost btn-sm"
                                style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                              >
                                <X size={12} strokeWidth={1.8} />
                                <span>Dismiss</span>
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Case Timeline */}
          <div className="lattice-card" data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
              <span className="micro-label">Audit Trail</span>
              <h2 className="card-heading" style={{ marginTop: 2 }}>
                Case timeline ({data.events.length})
              </h2>
            </div>
            <Timeline events={data.events} />
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* SLA Card */}
          <div className="lattice-card" data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="micro-label">SLA & Breach Prediction</span>
              <SlaIndicator state={data.sla.state} probability={data.sla.breach_probability} />
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Target deadline</span>
              <span className="font-mono tabular-nums" style={{ fontWeight: 600, fontSize: 14 }}>
                {dueFormatted}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-2)' }}>
                <span>SLA window elapsed</span>
                <span className="font-mono tabular-nums">{elapsedPct}%</span>
              </div>
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
                  style={{
                    width: `${elapsedPct}%`,
                    height: '100%',
                    backgroundColor:
                      data.sla.state === 'breached'
                        ? 'var(--risk-critical)'
                        : data.sla.state === 'at_risk'
                        ? 'var(--risk-watch)'
                        : 'var(--risk-low)',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                backgroundColor: 'var(--paper)',
                border: '1px solid var(--line)',
                fontSize: 13,
                color: 'var(--ink-2)',
              }}
            >
              {data.sla.state === 'closed'
                ? 'Case is resolved and SLA clock is closed.'
                : data.sla.state === 'breached'
                ? 'This case has exceeded its statutory SLA window and requires immediate resolution.'
                : `Predicted breach probability is ${probPct}% based on elapsed time, unit queue load, and current status.`}
            </div>
          </div>

          {/* Routing Card */}
          <div className="lattice-card" data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="micro-label">Automated Routing</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Routed unit</span>
              <UnitBadge code={data.unit_code} showFull />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Classifier confidence</span>
              <span className="font-mono tabular-nums" style={{ fontWeight: 600 }}>
                {Math.round(data.auto_confidence * 100)}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Assigned officer</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {data.assigned_officer ? data.assigned_officer.name : 'Unassigned'}
              </span>
            </div>
          </div>

          {/* Institution Card */}
          {data.institution && (
            <div
              className="lattice-card lattice-card-interactive"
              data-reveal
              data-cursor="view"
              onClick={() => navigate(`/institutions/${data.institution!.id}`)}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="micro-label">Institution Risk Profile</span>
                <BandBadge band={data.institution.band} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={18} strokeWidth={1.6} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                  {data.institution.name}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                <RiskMeter score={data.institution.score} band={data.institution.band} size="sm" />
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--ink-2)',
                  }}
                >
                  <span>Open dossier</span>
                  <ArrowUpRight size={14} strokeWidth={1.6} />
                </span>
              </div>
            </div>
          )}

          {/* Role-Enforced Case Actions Card */}
          <div className="lattice-card" data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="micro-label">Role-Based Case Actions</span>
              <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
                {user?.role.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            {/* 1. Assign / Reassign Officer (Bureau Head own bureau, Admin all bureaus) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                opacity: canAssign ? 1 : 0.55,
                pointerEvents: canAssign ? 'auto' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                  Assign / reassign officer
                </label>
                {!canAssign && (
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={11} /> Bureau Head / Admin only
                  </span>
                )}
              </div>
              <CustomSelect
                value={selectedOfficer}
                onChange={handleAssignOfficer}
                options={[
                  { value: '', label: 'Select bureau officer...' },
                  ...data.unit_officers.map((o) => ({
                    value: String(o.id),
                    label: `${o.name} (${o.title})`,
                  })),
                ]}
                ariaLabel="Assign officer"
              />
            </div>

            {/* 2. Status Transitions */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                opacity: canStatus ? 1 : 0.55,
                pointerEvents: canStatus ? 'auto' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                  Status transition
                </label>
                {!canStatus && (
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={11} />
                    {user?.role === 'chairman'
                      ? 'Reopen only (when Resolved/Closed)'
                      : user?.role === 'admin'
                      ? 'None (Admin)'
                      : 'Assigned cases only'}
                  </span>
                )}
              </div>

              {user?.role === 'chairman' && canStatus ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => handleStatusChange('In Review')}
                  style={{ width: '100%' }}
                >
                  <RotateCcw size={15} strokeWidth={1.8} />
                  <span>Reopen Case (Transition to In Review)</span>
                </Button>
              ) : (
                <CustomSelect
                  value={selectedStatus}
                  onChange={handleStatusChange}
                  options={statusOptions}
                  ariaLabel="Change status"
                />
              )}
            </div>

            {/* 3. Add Action Note (Bureau Head own bureau, Case Officer assigned cases) */}
            <form
              onSubmit={handleAddNote}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                opacity: canNote ? 1 : 0.55,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                  Add action note
                </label>
                {!canNote && (
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={11} />
                    {user?.role === 'case_officer'
                      ? 'Assigned cases only'
                      : 'Bureau Head / Assigned Officer'}
                  </span>
                )}
              </div>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={!canNote || submitting}
                placeholder={
                  canNote
                    ? 'Record verification findings or directive...'
                    : 'Action notes are restricted for your role on this case.'
                }
                className="lattice-textarea"
                style={{ minHeight: 84, fontSize: 13 }}
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={!canNote || submitting || !noteText.trim()}
              >
                <Send size={14} strokeWidth={1.6} />
                <span>Add action note</span>
              </Button>
            </form>

            {/* Escalate Button (part of Section 5 status transitions) */}
            {canEscalate && (
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                <Button
                  type="button"
                  variant="primary"
                  magnetic
                  disabled={submitting}
                  onClick={handleEscalate}
                  style={{ width: '100%' }}
                >
                  <AlertTriangle size={16} strokeWidth={1.8} />
                  <span>Escalate case ({data.escalation_count})</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
