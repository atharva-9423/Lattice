import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { UnitCode, RiskBand } from '../api/types';
import { prefersReducedMotion } from '../motion/reveal';
import { getBandColorVar } from './RiskMeter';

const UNIT_COLORS: Record<UnitCode, string> = {
  AB: '#C8963E',
  ACB: '#2F7F79',
  SGC: '#7A3E6B',
  VC: '#3E5C8A',
};

const UNIT_NAMES: Record<UnitCode, string> = {
  AB: 'Approval Bureau',
  ACB: 'Academic Bureau',
  SGC: 'Student Grievance Cell',
  VC: 'Vigilance Cell',
};

export function Sparkline({
  values,
  band = 'Low',
  width = 116,
  height = 34,
  fillArea = true,
}: {
  values: number[];
  band?: RiskBand;
  width?: number;
  height?: number;
  fillArea?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pts = values.length > 0 ? values : [0, 0];
  const minVal = 0;
  const maxVal = Math.max(100, ...pts);
  const padX = 3;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = pts.map((v, idx) => {
    const x = padX + (idx / Math.max(1, pts.length - 1)) * innerW;
    const y = padY + innerH - ((v - minVal) / Math.max(1, maxVal - minVal)) * innerH;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });

  const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaD = `${lineD} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`;
  const strokeColor = getBandColorVar(band);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || prefersReducedMotion()) return;
    const pathEl = el.querySelector('path[data-spark-line]') as SVGPathElement | null;
    if (!pathEl) return;

    const ctx = gsap.context(() => {
      try {
        const len = pathEl.getTotalLength();
        gsap.fromTo(
          pathEl,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration: 1.0, ease: 'power3.out' }
        );
      } catch {
        // ignore
      }
    }, el);

    return () => ctx.revert();
  }, [lineD]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      {fillArea && <path d={areaD} fill={strokeColor} fillOpacity="0.08" />}
      <path
        data-spark-line
        d={lineD}
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function WeeklyTrendChart({
  data,
}: {
  data: Array<{ week_start: string; AB: number; ACB: number; SGC: number; VC: number }>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 720;
  const height = 248;
  const padLeft = 36;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 34;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const units: UnitCode[] = ['SGC', 'ACB', 'AB', 'VC'];
  const maxVal = Math.max(
    6,
    ...data.flatMap((d) => [d.AB, d.ACB, d.SGC, d.VC])
  );

  const getX = (i: number) =>
    padLeft + (i / Math.max(1, data.length - 1)) * innerW;
  const getY = (v: number) =>
    padTop + innerH - (v / maxVal) * innerH;

  useEffect(() => {
    const el = svgRef.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const paths = el.querySelectorAll('path[data-trend-line]');
      paths.forEach((p) => {
        const geom = p as SVGPathElement;
        try {
          const len = geom.getTotalLength();
          gsap.fromTo(
            geom,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 1.2, ease: 'power3.out' }
          );
        } catch {
          // ignore
        }
      });
    }, el);

    return () => ctx.revert();
  }, [data]);

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 18,
          marginBottom: 14,
          fontSize: 12,
          color: 'var(--ink-2)',
        }}
      >
        {units.map((u) => (
          <div key={u} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 12,
                height: 3,
                backgroundColor: UNIT_COLORS[u],
                display: 'inline-block',
                borderRadius: 2,
              }}
            />
            <span className="font-mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>
              {u}
            </span>
            <span>{UNIT_NAMES[u]}</span>
          </div>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Horizontal Grid Rules */}
        {yTicks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#D8D2C2"
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill="#8A8578"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X Axis labels */}
        {data.map((d, idx) => {
          if (idx % 2 !== 0 && idx !== data.length - 1) return null;
          const x = getX(idx);
          return (
            <text
              key={d.week_start + idx}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill="#8A8578"
            >
              {d.week_start}
            </text>
          );
        })}

        {/* 4 Unit Lines */}
        {units.map((u) => {
          const dStr = data
            .map((row, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(row[u]).toFixed(1)}`)
            .join(' ');
          return (
            <path
              key={u}
              data-trend-line
              d={dStr}
              stroke={UNIT_COLORS[u]}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          );
        })}

        {/* Hover Vertical Rule & Dots */}
        {hoverIdx !== null && data[hoverIdx] && (
          <g>
            <line
              x1={getX(hoverIdx)}
              y1={padTop}
              x2={getX(hoverIdx)}
              y2={height - padBottom}
              stroke="#15140F"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {units.map((u) => (
              <circle
                key={u}
                cx={getX(hoverIdx)}
                cy={getY(data[hoverIdx][u])}
                r="4.5"
                fill={UNIT_COLORS[u]}
                stroke="#FBF9F4"
                strokeWidth="1.5"
              />
            ))}
          </g>
        )}

        {/* Invisible Hover Columns */}
        {data.map((d, idx) => {
          const colW = innerW / Math.max(1, data.length);
          const x = getX(idx) - colW / 2;
          return (
            <rect
              key={d.week_start + idx}
              x={Math.max(padLeft, x)}
              y={padTop}
              width={colW}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(idx)}
            />
          );
        })}
      </svg>

      {/* Hover Tooltip */}
      {hoverIdx !== null && data[hoverIdx] && (
        <div
          style={{
            position: 'absolute',
            top: 36,
            right: 16,
            backgroundColor: 'var(--card)',
            border: '1px solid var(--ink)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div
            className="font-mono"
            style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}
          >
            Week of {data[hoverIdx].week_start}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px' }}>
            {units.map((u) => (
              <div
                key={u}
                className="font-mono tabular-nums"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
              >
                <span style={{ color: UNIT_COLORS[u], fontWeight: 600 }}>{u}:</span>
                <span>{data[hoverIdx][u]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function UnitWorkloadBars({
  items,
}: {
  items: Array<{ code: UnitCode; open: number; at_risk: number }>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const maxOpen = Math.max(10, ...items.map((i) => i.open));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const bars = el.querySelectorAll('[data-workload-bar]');
      gsap.fromTo(
        bars,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.9,
          stagger: 0.08,
          ease: 'power3.out',
          transformOrigin: 'left center',
        }
      );
    }, el);

    return () => ctx.revert();
  }, [items]);

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {items.map((item) => {
        const openPct = Math.min(100, Math.round((item.open / maxOpen) * 100));
        const riskPct = Math.min(100, Math.round((item.at_risk / maxOpen) * 100));
        return (
          <div key={item.code} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge badge-unit-${item.code}`}>{item.code}</span>
                <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{UNIT_NAMES[item.code]}</span>
              </div>
              <div className="font-mono tabular-nums" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{item.open}</span> open ·{' '}
                <span style={{ color: item.at_risk > 0 ? 'var(--risk-critical-text)' : 'var(--ink-3)' }}>
                  {item.at_risk} at risk
                </span>
              </div>
            </div>
            <div
              style={{
                width: '100%',
                height: 12,
                backgroundColor: 'var(--paper-2)',
                borderRadius: 6,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                data-workload-bar
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${openPct}%`,
                  backgroundColor: UNIT_COLORS[item.code],
                  borderRadius: 6,
                }}
              />
              {item.at_risk > 0 && (
                <div
                  data-workload-bar
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${riskPct}%`,
                    backgroundColor: 'var(--risk-critical)',
                    borderRadius: 6,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingTop: 8,
          borderTop: '1px solid var(--line)',
          fontSize: 12,
          color: 'var(--ink-2)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--ink-2)' }} />
          Total open cases
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--risk-critical)' }} />
          At risk / breached SLA
        </span>
      </div>
    </div>
  );
}
