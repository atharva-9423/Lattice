import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  X,
  Link2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCheck,
  EyeOff,
  Plus,
} from 'lucide-react';
import { api, getStoredUser } from '../api/client';
import type { PaginatedComplaints } from '../api/types';
import {
  UnitBadge,
  SeverityBadge,
  StatusBadge,
  SlaIndicator,
  CustomSelect,
} from '../components/Badge';
import { Button } from '../components/Button';
import { PageSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { useReveal } from '../motion/reveal';

export function Complaints() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = getStoredUser();
  const containerRef = useRef<HTMLDivElement>(null);

  const isCaseOfficer = user?.role === 'case_officer';
  const isAdmin = user?.role === 'admin';
  const canRegister = Boolean(user?.permissions?.can_register_complaint);

  const q = searchParams.get('q') || '';
  const unit = searchParams.get('unit') || '';
  const severity = searchParams.get('severity') || '';
  const status = searchParams.get('status') || '';
  const sla = searchParams.get('sla') || '';
  const sort = searchParams.get('sort') || 'created_desc';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(q);
  const [onlyAssignedToMe, setOnlyAssignedToMe] = useState(false);
  const [data, setData] = useState<PaginatedComplaints | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  };

  const clearAllFilters = () => {
    setSearchParams({});
    setSearchInput('');
    setOnlyAssignedToMe(false);
  };

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getComplaints({
        q,
        unit,
        severity,
        status,
        sla,
        sort,
        page,
        page_size: 15,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, [q, unit, severity, status, sla, sort, page]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  useReveal(containerRef, [loading, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('q', searchInput.trim());
  };

  const hasFilters = Boolean(q || unit || severity || status || sla || onlyAssignedToMe);

  const displayedItems = data
    ? onlyAssignedToMe
      ? data.items.filter((item) => item.is_assigned_to_me)
      : data.items
    : [];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Role Access Level Banner */}
      <div
        data-reveal
        className="lattice-card"
        style={{
          padding: '14px 20px',
          backgroundColor: isAdmin ? 'var(--paper-2)' : 'var(--surface)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin ? (
            <EyeOff size={16} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
          ) : isCaseOfficer ? (
            <UserCheck size={16} strokeWidth={1.8} style={{ color: '#1F568B' }} />
          ) : (
            <Shield size={16} strokeWidth={1.8} style={{ color: 'var(--ink)' }} />
          )}
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>
            {user?.role === 'chairman' && (
              <span>
                <strong>Chairman Scope:</strong> Viewing all cases with full narrative & audit history. Status transitions restricted to <strong>Reopen Only</strong>.
              </span>
            )}
            {user?.role === 'bureau_head' && (
              <span>
                <strong>Bureau Head Scope:</strong> Full access to register complaints, assign officers, add action notes, transition status per Section 5, and resolve the link queue.
              </span>
            )}
            {user?.role === 'case_officer' && (
              <span>
                <strong>Case Officer Scope:</strong> Full case view with <strong>your assigned cases prioritized first</strong>. Action notes & Section 5 transitions enabled on cases assigned to you.
              </span>
            )}
            {user?.role === 'admin' && (
              <span>
                <strong>Admin Scope (Section 3.1 Metadata Only):</strong> Viewing all cases with narrative & action-note text redacted. Authorized to assign/reassign officers and resolve the link queue.
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isCaseOfficer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setOnlyAssignedToMe(false)}
                className="font-mono"
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--line)',
                  backgroundColor: !onlyAssignedToMe ? 'var(--ink)' : 'var(--paper)',
                  color: !onlyAssignedToMe ? 'var(--paper)' : 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                All Cases (Assigned First)
              </button>
              <button
                type="button"
                onClick={() => setOnlyAssignedToMe(true)}
                className="font-mono"
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--line)',
                  backgroundColor: onlyAssignedToMe ? 'var(--ink)' : 'var(--paper)',
                  color: onlyAssignedToMe ? 'var(--paper)' : 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                Assigned to Me ({data?.items.filter((i) => i.is_assigned_to_me).length || 0})
              </button>
            </div>
          )}

          {canRegister && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/complaints/new')}
            >
              <Plus size={14} strokeWidth={1.8} />
              <span>Register Complaint</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div
        data-reveal
        className="lattice-card"
        style={{
          padding: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: 240 }}>
            <Search
              size={15}
              strokeWidth={1.6}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ink-3)',
              }}
            />
            <input
              type="search"
              className="lattice-input"
              placeholder={isAdmin ? 'Search ref, title, institution...' : 'Filter by keyword or ref...'}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ height: 38, paddingLeft: 34, fontSize: 13 }}
            />
          </form>

          <CustomSelect
            value={unit}
            onChange={(v) => updateParam('unit', v)}
            placeholder="All Units"
            minWidth={136}
            options={[
              { value: '', label: 'All Units' },
              { value: 'SGC', label: 'SGC · Grievance' },
              { value: 'ACB', label: 'ACB · Academic' },
              { value: 'AB', label: 'AB · Approval' },
              { value: 'VC', label: 'VC · Vigilance' },
            ]}
          />

          <CustomSelect
            value={severity}
            onChange={(v) => updateParam('severity', v)}
            placeholder="All Severities"
            minWidth={148}
            options={[
              { value: '', label: 'All Severities' },
              { value: 'Critical', label: 'Critical' },
              { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' },
            ]}
          />

          <CustomSelect
            value={status}
            onChange={(v) => updateParam('status', v)}
            placeholder="All Statuses"
            minWidth={164}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'New', label: 'New' },
              { value: 'Assigned', label: 'Assigned' },
              { value: 'In Review', label: 'In Review' },
              { value: 'Awaiting Institution', label: 'Awaiting Institution' },
              { value: 'Escalated', label: 'Escalated' },
              { value: 'Resolved', label: 'Resolved' },
              { value: 'Closed', label: 'Closed' },
            ]}
          />

          <CustomSelect
            value={sla}
            onChange={(v) => updateParam('sla', v)}
            placeholder="All SLA States"
            minWidth={148}
            options={[
              { value: '', label: 'All SLA States' },
              { value: 'breached', label: 'SLA Breached' },
              { value: 'at_risk', label: 'SLA At Risk' },
              { value: 'ok', label: 'On Track' },
              { value: 'closed', label: 'Closed' },
            ]}
          />

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X size={14} strokeWidth={1.6} />
              <span>Reset</span>
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="micro-label">Sort</span>
          <CustomSelect
            value={sort}
            onChange={(v) => updateParam('sort', v)}
            minWidth={168}
            options={[
              { value: 'created_desc', label: isCaseOfficer ? 'Assigned 1st · Newest' : 'Newest Filed' },
              { value: 'due_asc', label: isCaseOfficer ? 'Assigned 1st · SLA Due' : 'SLA Due Soonest' },
              { value: 'severity_desc', label: isCaseOfficer ? 'Assigned 1st · Severity' : 'Highest Severity' },
            ]}
          />
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <PageSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchComplaints} />
      ) : !data || displayedItems.length === 0 ? (
        <EmptyState
          title="No complaints match the current filter"
          description="Try clearing one or more filters or broadening your search query across the registry."
          onReset={hasFilters ? clearAllFilters : undefined}
        />
      ) : (
        <div className="lattice-card" data-reveal style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 138 }}>Reference</th>
                <th>Complaint Title & Category</th>
                <th>Institution</th>
                <th>Assignee</th>
                <th>Severity</th>
                <th>Status</th>
                <th>SLA State</th>
                <th>Filed</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item) => (
                <tr
                  key={item.id}
                  data-cursor="view"
                  className="data-table-row"
                  onClick={() => navigate(`/complaints/${item.id}`)}
                  style={{
                    backgroundColor: item.is_assigned_to_me
                      ? 'rgba(31, 86, 139, 0.04)'
                      : undefined,
                  }}
                >
                  <td className="font-mono tabular-nums" style={{ fontSize: 13, fontWeight: 500 }}>
                    <div className="data-table-row-bg" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>{item.ref}</span>
                      {item.is_assigned_to_me && (
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            backgroundColor: '#EBF3FA',
                            color: '#1F568B',
                            width: 'fit-content',
                          }}
                        >
                          ASSIGNED TO YOU
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                        {item.title}
                      </span>
                      {item.cluster_size > 1 && (
                        <span
                          className="font-mono"
                          title="Cross-unit linked cluster size"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '1px 7px',
                            borderRadius: 999,
                            backgroundColor: 'rgba(184, 80, 30, 0.12)',
                            color: 'var(--accent)',
                          }}
                        >
                          <Link2 size={11} strokeWidth={2} />
                          {item.cluster_size}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                      {item.category}
                      {item.metadata_only && (
                        <span
                          className="font-mono"
                          style={{
                            marginLeft: 8,
                            fontSize: 10.5,
                            color: 'var(--accent)',
                          }}
                        >
                          · Narrative redacted (Admin Metadata Only)
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13.5, color: 'var(--ink)' }}>
                      {item.institution.name}
                    </div>
                  </td>
                  <td>
                    {item.assigned_officer_name ? (
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: item.is_assigned_to_me ? 600 : 400,
                          color: item.is_assigned_to_me ? '#1F568B' : 'var(--ink-2)',
                        }}
                      >
                        {item.assigned_officer_name}
                      </span>
                    ) : (
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td>
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    <SlaIndicator state={item.sla_state} probability={item.breach_probability} />
                  </td>
                  <td
                    className="font-mono tabular-nums"
                    style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}
                  >
                    {new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
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

          {/* Pagination Footer */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--paper-2)',
            }}
          >
            <div className="font-mono tabular-nums" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              Showing {(data.page - 1) * data.page_size + 1}–
              {Math.min(data.page * data.page_size, data.total)} of {data.total} cases
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => updateParam('page', String(data.page - 1))}
              >
                <ChevronLeft size={15} strokeWidth={1.6} />
                <span>Previous</span>
              </Button>
              <span className="font-mono tabular-nums" style={{ fontSize: 12, padding: '0 8px' }}>
                Page {data.page} of {Math.max(1, Math.ceil(data.total / data.page_size))}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={data.page * data.page_size >= data.total}
                onClick={() => updateParam('page', String(data.page + 1))}
              >
                <span>Next</span>
                <ChevronRight size={15} strokeWidth={1.6} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
