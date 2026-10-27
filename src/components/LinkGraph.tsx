import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import type { GraphResponse, UnitCode, SeverityLevel } from '../api/types';
import { prefersReducedMotion } from '../motion/reveal';
import { UnitBadge, SeverityBadge } from './Badge';

const UNIT_COLORS: Record<UnitCode, string> = {
  AB: '#C8963E',
  ACB: '#2F7F79',
  SGC: '#7A3E6B',
  VC: '#3E5C8A',
};

const SEVERITY_RADIUS: Record<SeverityLevel, number> = {
  Low: 10,
  Medium: 12,
  High: 14,
  Critical: 16,
};

const UNIT_SECTORS: Record<UnitCode, [number, number]> = {
  SGC: [-Math.PI * 0.85, -Math.PI * 0.15],
  ACB: [-Math.PI * 0.1, Math.PI * 0.4],
  AB: [Math.PI * 0.45, Math.PI * 0.85],
  VC: [Math.PI * 0.9, Math.PI * 1.12],
};

export function LinkGraph({
  institutionName,
  graph,
}: {
  institutionName: string;
  graph: GraphResponse;
}) {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [activeUnits, setActiveUnits] = useState<Record<UnitCode, boolean>>({
    AB: true,
    ACB: true,
    SGC: true,
    VC: true,
  });

  const cx = 400;
  const cy = 260;
  const ringR = 178;

  const filteredNodes = useMemo(
    () => graph.nodes.filter((n) => activeUnits[n.unit_code]),
    [graph.nodes, activeUnits]
  );

  const nodePositions = useMemo(() => {
    const posMap: Record<
      number,
      {
        x: number;
        y: number;
        node: GraphResponse['nodes'][number];
      }
    > = {};

    const byUnit: Record<UnitCode, GraphResponse['nodes']> = {
      SGC: [],
      ACB: [],
      AB: [],
      VC: [],
    };
    for (const n of filteredNodes) {
      byUnit[n.unit_code].push(n);
    }

    (Object.keys(byUnit) as UnitCode[]).forEach((u) => {
      const list = byUnit[u];
      const [startAngle, endAngle] = UNIT_SECTORS[u];
      list.forEach((n, idx) => {
        const t = list.length === 1 ? 0.5 : idx / (list.length - 1);
        const angle = startAngle + t * (endAngle - startAngle);
        const rOffset = idx % 2 === 0 ? ringR : ringR - 18;
        posMap[n.id] = {
          x: cx + Math.cos(angle) * rOffset,
          y: cy + Math.sin(angle) * rOffset,
          node: n,
        };
      });
    });

    return posMap;
  }, [filteredNodes]);

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        (e) => nodePositions[e.source] !== undefined && nodePositions[e.target] !== undefined
      ),
    [graph.edges, nodePositions]
  );

  useEffect(() => {
    const el = svgRef.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const nodes = el.querySelectorAll('[data-graph-node]');
      const edges = el.querySelectorAll('path[data-graph-edge]');

      gsap.fromTo(
        nodes,
        { scale: 0, transformOrigin: 'center center' },
        {
          scale: 1,
          duration: 0.55,
          stagger: 0.04,
          ease: 'back.out(1.6)',
        }
      );

      edges.forEach((edge) => {
        const pathEl = edge as SVGPathElement;
        try {
          const len = pathEl.getTotalLength();
          gsap.fromTo(
            pathEl,
            { strokeDasharray: pathEl.getAttribute('data-dashed') === 'true' ? '4 4' : len, strokeDashoffset: len, opacity: 0 },
            { strokeDashoffset: 0, opacity: 1, duration: 0.65, delay: 0.25, ease: 'power3.out' }
          );
        } catch {
          // ignore
        }
      });
    }, el);

    return () => ctx.revert();
  }, [filteredNodes.length, visibleEdges.length]);

  const hoveredNode = hoveredId ? nodePositions[hoveredId]?.node : null;
  const connectedIds = useMemo(() => {
    if (!hoveredId) return new Set<number>();
    const s = new Set<number>([hoveredId]);
    for (const e of visibleEdges) {
      if (e.source === hoveredId) s.add(e.target);
      if (e.target === hoveredId) s.add(e.source);
    }
    return s;
  }, [hoveredId, visibleEdges]);

  const toggleUnit = (u: UnitCode) => {
    setActiveUnits((prev) => ({ ...prev, [u]: !prev[u] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Legend and Unit Toggles */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 14,
          borderBottom: '1px solid var(--line)',
        }}
      >
        {/* Edge Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, fontSize: 12, color: 'var(--ink-2)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="#15140F" strokeWidth="2.2" /></svg>
            <span>Duplicate (≥60%)</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="#55524A" strokeWidth="1.5" /></svg>
            <span>Similar (30–59%)</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="#8A8578" strokeWidth="1.2" strokeDasharray="4 3" /></svg>
            <span>Cross-unit context (≤45d)</span>
          </span>
        </div>

        {/* Unit Filter Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['SGC', 'ACB', 'AB', 'VC'] as UnitCode[]).map((u) => {
            const active = activeUnits[u];
            return (
              <button
                key={u}
                type="button"
                data-cursor="link"
                onClick={() => toggleUnit(u)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid var(--line)',
                  backgroundColor: active ? 'var(--paper-2)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  opacity: active ? 1 : 0.55,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: UNIT_COLORS[u],
                  }}
                />
                <span>{u}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          ref={svgRef}
          viewBox="0 0 800 520"
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            backgroundColor: 'var(--paper)',
            borderRadius: 12,
            border: '1px solid var(--line)',
          }}
        >
          {/* Orbit reference ring */}
          <circle
            cx={cx}
            cy={cy}
            r={ringR}
            fill="none"
            stroke="#D8D2C2"
            strokeWidth="1"
            strokeDasharray="3 5"
          />

          {/* Spokes from hub to nodes */}
          {Object.values(nodePositions).map(({ x, y, node }) => (
            <line
              key={`spoke-${node.id}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="#D8D2C2"
              strokeWidth="0.75"
              opacity={hoveredId && !connectedIds.has(node.id) ? 0.2 : 0.55}
            />
          ))}

          {/* Case Link Edges */}
          {visibleEdges.map((edge, idx) => {
            const pA = nodePositions[edge.source];
            const pB = nodePositions[edge.target];
            if (!pA || !pB) return null;

            const isHighlighted =
              hoveredId !== null && (edge.source === hoveredId || edge.target === hoveredId);
            const isDimmed = hoveredId !== null && !isHighlighted;

            const mx = (pA.x + pB.x) / 2;
            const my = (pA.y + pB.y) / 2;
            const ctrlX = mx + (cx - mx) * 0.28;
            const ctrlY = my + (cy - my) * 0.28;
            const d = `M ${pA.x.toFixed(1)} ${pA.y.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${pB.x.toFixed(1)} ${pB.y.toFixed(1)}`;

            const stroke =
              isHighlighted
                ? '#FF5B1F'
                : edge.type === 'Duplicate'
                ? '#15140F'
                : edge.type === 'Similar'
                ? '#55524A'
                : '#8A8578';
            const strokeWidth =
              edge.type === 'Duplicate' ? 2.2 : edge.type === 'Similar' ? 1.5 : 1.1;

            return (
              <path
                key={`${edge.source}-${edge.target}-${idx}`}
                data-graph-edge
                data-dashed={edge.type === 'Context' ? 'true' : 'false'}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={isHighlighted ? strokeWidth + 0.6 : strokeWidth}
                strokeDasharray={edge.type === 'Context' ? '4 4' : undefined}
                opacity={isDimmed ? 0.14 : 0.9}
              />
            );
          })}

          {/* Central Institution Hub */}
          <g transform={`translate(${cx}, ${cy})`}>
            <circle r="34" fill="#FBF9F4" stroke="#15140F" strokeWidth="1.5" />
            <circle r="28" fill="#EAE5D8" />
            <text
              y="-3"
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fontFamily="var(--font-mono)"
              fill="#15140F"
            >
              HUB
            </text>
            <text
              y="10"
              textAnchor="middle"
              fontSize="9"
              fontFamily="var(--font-body)"
              fill="#55524A"
            >
              {filteredNodes.length} cases
            </text>
          </g>

          {/* Complaint Nodes */}
          {Object.values(nodePositions).map(({ x, y, node }) => {
            const r = SEVERITY_RADIUS[node.severity] || 12;
            const isOpen = node.status !== 'Resolved' && node.status !== 'Closed';
            const isDimmed = hoveredId !== null && !connectedIds.has(node.id);
            const isHovered = hoveredId === node.id;

            return (
              <g
                key={node.id}
                data-graph-node
                data-cursor="view"
                transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}
                style={{ cursor: 'pointer', opacity: isDimmed ? 0.22 : 1, transition: 'opacity 0.18s ease' }}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => navigate(`/complaints/${node.id}`)}
              >
                {isOpen && (
                  <circle
                    r={r + 4}
                    fill="none"
                    stroke={node.status === 'Escalated' ? '#B3261E' : '#FF5B1F'}
                    strokeWidth={isHovered ? 2.2 : 1.4}
                  />
                )}
                <circle
                  r={r}
                  fill={UNIT_COLORS[node.unit_code]}
                  stroke="#15140F"
                  strokeWidth={isHovered ? 2 : 1.2}
                />
                <text
                  y={r + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fontWeight="500"
                  fill="#15140F"
                >
                  {node.ref.replace('AICTE-2026-', '#')}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredNode && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              maxWidth: 320,
              backgroundColor: 'var(--card)',
              border: '1px solid var(--ink)',
              borderRadius: 12,
              padding: '12px 14px',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <span className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                {hoveredNode.ref}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UnitBadge code={hoveredNode.unit_code} />
                <SeverityBadge severity={hoveredNode.severity} />
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
              {hoveredNode.title}
            </div>
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
              Status: {hoveredNode.status} · Click node to inspect case
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--ink-3)',
          }}
        >
          <span>Center hub: {institutionName}</span>
          <span>Outer ring around node indicates an open case · Node radius scales by severity</span>
        </div>
      </div>
    </div>
  );
}
