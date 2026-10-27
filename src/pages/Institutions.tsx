import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import { api } from '../api/client';
import type { PaginatedInstitutions, RiskBand } from '../api/types';
import { BandBadge, CustomSelect } from '../components/Badge';
import { RiskMeter } from '../components/RiskMeter';
import { Sparkline } from '../components/Charts';
import { Button } from '../components/Button';
import { PageSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { useReveal } from '../motion/reveal';

const BANDS: Array<'All' | RiskBand> = ['All', 'Critical', 'High', 'Watch', 'Low'];

const SORT_OPTIONS = [
  { value: 'score_desc', label: 'Sort: Highest risk score' },
  { value: 'name_asc', label: 'Sort: Name (A–Z)' },
];

export function Institutions() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const q = searchParams.get('q') || '';
  const band = searchParams.get('band') || 'All';
  const sort = searchParams.get('sort') || 'score_desc';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [localQ, setLocalQ] = useState(q);
  const [data, setData] = useState<PaginatedInstitutions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalQ(q);
  }, [q]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'All') next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  };

  const loadInstitutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getInstitutions({
        q,
        band: band === 'All' ? undefined : band,
        sort,
        page,
        page_size: 12,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load institutions');
    } finally {
      setLoading(false);
    }
  }, [q, band, sort, page]);

  useEffect(() => {
    loadInstitutions();
  }, [loadInstitutions]);

  useReveal(containerRef, [loading, page, band]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Filter Controls */}
      <div
        className="lattice-card"
        data-reveal
        style={{
          padding: 20,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, flex: 1 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateParam('q', localQ.trim());
            }}
            style={{ position: 'relative', minWidth: 260, flex: '0 1 320px' }}
          >
            <Search
              size={16}
              strokeWidth={1.6}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ink-3)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="search"
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              onBlur={() => {
                if (localQ.trim() !== q) updateParam('q', localQ.trim());
              }}
              placeholder="Search institution, city, or state..."
              aria-label="Search institutions"
              className="lattice-input"
              style={{ paddingLeft: 38 }}
            />
          </form>

          {/* Band Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {BANDS.map((b) => {
              const active = band === b || (b === 'All' && !searchParams.get('band'));
              return (
                <button
                  key={b}
                  type="button"
                  data-cursor="link"
                  onClick={() => updateParam('band', b)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    border: active ? '1px solid var(--ink)' : '1px solid var(--line)',
                    backgroundColor: active ? 'var(--ink)' : 'var(--card)',
                    color: active ? 'var(--paper)' : 'var(--ink-2)',
                    cursor: 'pointer',
                  }}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>

        <CustomSelect
          value={sort}
          onChange={(v) => updateParam('sort', v)}
          options={SORT_OPTIONS}
          ariaLabel="Sort institutions"
          minWidth={210}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <PageSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadInstitutions} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No institutions match your filter"
          description="Clear the search query or select a different risk band."
          actionLabel="Reset filters"
          onAction={() => {
            setLocalQ('');
            setSearchParams(new URLSearchParams());
          }}
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}
          >
            {data.items.map((inst) => (
              <div
                key={inst.id}
                data-reveal
                data-cursor="view"
                className="lattice-card lattice-card-interactive"
                onClick={() => navigate(`/institutions/${inst.id}`)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 18,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <span className="micro-label">{inst.type}</span>
                    <BandBadge band={inst.band} />
                  </div>

                  <h3 className="card-heading" style={{ fontSize: 19 }}>
                    {inst.name}
                  </h3>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
                    {inst.city}, {inst.state} · Est. {inst.established_year}
                  </div>
                </div>

                {/* Score & Sparkline Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    paddingTop: 12,
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <div>
                    <div className="micro-label" style={{ marginBottom: 4 }}>
                      Risk Score
                    </div>
                    <div
                      className="font-display tabular-nums"
                      style={{
                        fontWeight: 800,
                        fontSize: 44,
                        lineHeight: 0.95,
                        color: inst.score >= 80 ? 'var(--accent)' : 'var(--ink)',
                      }}
                    >
                      {inst.score}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      12w trajectory
                    </span>
                    <Sparkline values={inst.sparkline} band={inst.band} width={112} height={32} />
                  </div>
                </div>

                {/* Meter & Footer */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <RiskMeter score={inst.score} band={inst.band} showNumeral={false} size="sm" />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: 'var(--ink-2)',
                    }}
                  >
                    <span className="font-mono tabular-nums">
                      <strong style={{ color: 'var(--ink)' }}>{inst.open_cases}</strong> open ·{' '}
                      {inst.total_90d} in 90d
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      <span>Dossier</span>
                      <ArrowUpRight size={14} strokeWidth={1.6} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div
            data-reveal
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 4,
            }}
          >
            <div className="font-mono tabular-nums" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              Showing {(data.page - 1) * data.page_size + 1}–
              {Math.min(data.total, data.page * data.page_size)} of {data.total} institutions
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1))}
              >
                <ChevronLeft size={15} strokeWidth={1.6} />
                <span>Previous</span>
              </Button>
              <span className="font-mono tabular-nums" style={{ fontSize: 12, padding: '0 8px' }}>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParam('page', String(page + 1))}
              >
                <span>Next</span>
                <ChevronRight size={15} strokeWidth={1.6} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
