import React from 'react';

export function LatticeMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="8" height="8" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
      <rect x="14" y="2" width="8" height="8" fill="#FF5B1F" stroke="#15140F" strokeWidth="1.5" />
      <rect x="2" y="14" width="8" height="8" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
      <rect x="14" y="14" width="8" height="8" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
      <line x1="10" y1="6" x2="14" y2="6" stroke="#15140F" strokeWidth="1.5" />
      <line x1="6" y1="10" x2="6" y2="14" stroke="#15140F" strokeWidth="1.5" />
      <line x1="18" y1="10" x2="18" y2="14" stroke="#15140F" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * 1. Hero (Login): rectangular papers at slight angles, connected by thin curved threads
 * that converge into one small building with a flag; one thread and one paper in accent.
 */
export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 520 300"
      fill="none"
      style={{ width: '100%', maxWidth: 520, height: 'auto', display: 'block' }}
      aria-label="Connected complaints converging into institutional oversight"
    >
      {/* Paper 1 (Top left, tilted) */}
      <g transform="translate(24, 24) rotate(-6)">
        <rect x="0" y="0" width="86" height="108" rx="6" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
        <line x1="16" y1="24" x2="68" y2="24" stroke="#15140F" strokeWidth="1.5" />
        <line x1="16" y1="40" x2="58" y2="40" stroke="#15140F" strokeWidth="1.5" />
        <line x1="16" y1="56" x2="64" y2="56" stroke="#15140F" strokeWidth="1.5" />
        <circle cx="22" cy="82" r="5" fill="#FBF9F4" stroke="#15140F" strokeWidth="1.5" />
      </g>

      {/* Paper 2 (Middle left, accent paper) */}
      <g transform="translate(42, 162) rotate(4)">
        <rect x="0" y="0" width="90" height="110" rx="6" fill="#FF5B1F" stroke="#15140F" strokeWidth="1.5" />
        <line x1="16" y1="26" x2="72" y2="26" stroke="#FBF9F4" strokeWidth="1.5" />
        <line x1="16" y1="42" x2="60" y2="42" stroke="#FBF9F4" strokeWidth="1.5" />
        <line x1="16" y1="58" x2="66" y2="58" stroke="#FBF9F4" strokeWidth="1.5" />
        <rect x="16" y="76" width="28" height="12" rx="3" fill="#FBF9F4" stroke="#15140F" strokeWidth="1.5" />
      </g>

      {/* Paper 3 (Center top, tilted) */}
      <g transform="translate(178, 16) rotate(3)">
        <rect x="0" y="0" width="84" height="104" rx="6" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
        <line x1="16" y1="24" x2="66" y2="24" stroke="#15140F" strokeWidth="1.5" />
        <line x1="16" y1="40" x2="52" y2="40" stroke="#15140F" strokeWidth="1.5" />
        <line x1="16" y1="56" x2="60" y2="56" stroke="#15140F" strokeWidth="1.5" />
        <circle cx="22" cy="78" r="5" fill="#FBF9F4" stroke="#15140F" strokeWidth="1.5" />
      </g>

      {/* Curved connecting threads */}
      <path
        data-draw
        d="M 110 74 Q 230 90 356 156"
        stroke="#15140F"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        data-draw
        d="M 258 72 Q 310 100 356 156"
        stroke="#15140F"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Accent orange thread */}
      <path
        data-draw
        d="M 130 218 Q 250 232 356 168"
        stroke="#FF5B1F"
        strokeWidth="2"
        fill="none"
      />

      {/* Institution building on the right */}
      <g transform="translate(356, 86)">
        {/* Flagpole and flag */}
        <line x1="64" y1="0" x2="64" y2="36" stroke="#15140F" strokeWidth="1.5" />
        <rect x="64" y="2" width="26" height="15" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
        {/* Pediment roof */}
        <path d="M 8 36 L 64 12 L 120 36 Z" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
        {/* Main facade */}
        <rect x="14" y="36" width="100" height="112" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
        {/* Pillars / windows */}
        <rect x="28" y="52" width="14" height="64" fill="#FBF9F4" stroke="#15140F" strokeWidth="1.5" />
        <rect x="57" y="52" width="14" height="64" fill="#FBF9F4" stroke="#15140F" strokeWidth="1.5" />
        <rect x="86" y="52" width="14" height="64" fill="#FBF9F4" stroke="#15140F" strokeWidth="1.5" />
        {/* Base plinth */}
        <rect x="4" y="148" width="120" height="12" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

/**
 * 2. Empty list: an empty tray with a single paper and a magnifier (one accent element).
 */
export function EmptyListIllustration() {
  return (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
      {/* Tray */}
      <path
        data-draw
        d="M 24 68 L 38 42 L 122 42 L 136 68 L 136 96 L 24 96 Z"
        fill="#EAE5D8"
        stroke="#15140F"
        strokeWidth="1.5"
      />
      <line x1="24" y1="68" x2="58" y2="68" stroke="#15140F" strokeWidth="1.5" />
      <line x1="102" y1="68" x2="136" y2="68" stroke="#15140F" strokeWidth="1.5" />
      <path d="M 58 68 Q 80 82 102 68" stroke="#15140F" strokeWidth="1.5" fill="none" />

      {/* Single paper */}
      <rect x="54" y="20" width="46" height="42" rx="4" fill="#FBF9F4" stroke="#15140F" strokeWidth="1.5" />
      <line x1="64" y1="32" x2="88" y2="32" stroke="#15140F" strokeWidth="1.5" />
      <line x1="64" y1="42" x2="82" y2="42" stroke="#15140F" strokeWidth="1.5" />

      {/* Magnifier in accent */}
      <circle cx="104" cy="46" r="14" fill="#EAE5D8" stroke="#FF5B1F" strokeWidth="2" />
      <line x1="114" y1="56" x2="126" y2="68" stroke="#FF5B1F" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 3. No alerts: a bell resting on a flat surface with a small check mark in accent.
 */
export function NoAlertsIllustration() {
  return (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <line x1="24" y1="92" x2="136" y2="92" stroke="#15140F" strokeWidth="1.5" />
      <path
        data-draw
        d="M 52 82 L 108 82 L 100 66 L 100 50 C 100 36 91 26 80 26 C 69 26 60 36 60 50 L 60 66 Z"
        fill="#EAE5D8"
        stroke="#15140F"
        strokeWidth="1.5"
      />
      <path d="M 74 82 C 74 87 86 87 86 82" stroke="#15140F" strokeWidth="1.5" />
      <circle cx="104" cy="36" r="13" fill="#FF5B1F" stroke="#15140F" strokeWidth="1.5" />
      <path
        data-draw
        d="M 98 36 L 102 40 L 110 32"
        stroke="#FBF9F4"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 4. Analysis idle (New Complaint): three nodes joined by dashed lines awaiting a fourth in accent.
 */
export function AnalysisIdleIllustration() {
  return (
    <svg width="200" height="130" viewBox="0 0 200 130" fill="none" aria-hidden="true">
      <line
        x1="46"
        y1="40"
        x2="102"
        y2="34"
        stroke="#15140F"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <line
        x1="46"
        y1="40"
        x2="78"
        y2="92"
        stroke="#15140F"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <line
        x1="102"
        y1="34"
        x2="78"
        y2="92"
        stroke="#15140F"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <line
        x1="102"
        y1="34"
        x2="152"
        y2="72"
        stroke="#FF5B1F"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <line
        x1="78"
        y1="92"
        x2="152"
        y2="72"
        stroke="#15140F"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      <circle cx="46" cy="40" r="14" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
      <circle cx="102" cy="34" r="14" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />
      <circle cx="78" cy="92" r="14" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.5" />

      {/* Fourth node in accent */}
      <circle cx="152" cy="72" r="16" fill="#FF5B1F" stroke="#15140F" strokeWidth="1.5" />
      <line x1="146" y1="72" x2="158" y2="72" stroke="#FBF9F4" strokeWidth="1.5" />
      <line x1="152" y1="66" x2="152" y2="78" stroke="#FBF9F4" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * 5. 404: a paper with a torn corner and a compass.
 */
export function NotFoundIllustration() {
  return (
    <svg width="180" height="140" viewBox="0 0 180 140" fill="none" aria-hidden="true">
      {/* Paper with torn top-right corner */}
      <path
        data-draw
        d="M 38 18 L 102 18 L 122 38 L 122 118 L 38 118 Z"
        fill="#EAE5D8"
        stroke="#15140F"
        strokeWidth="1.5"
      />
      <path d="M 102 18 L 102 38 L 122 38" fill="#FBF9F4" stroke="#15140F" strokeWidth="1.5" />
      <line x1="54" y1="48" x2="96" y2="48" stroke="#15140F" strokeWidth="1.5" />
      <line x1="54" y1="64" x2="88" y2="64" stroke="#15140F" strokeWidth="1.5" />
      <line x1="54" y1="80" x2="80" y2="80" stroke="#15140F" strokeWidth="1.5" />

      {/* Compass overlapping bottom right */}
      <circle cx="122" cy="92" r="26" fill="#FBF9F4" stroke="#15140F" strokeWidth="1.5" />
      <circle cx="122" cy="92" r="20" fill="#EAE5D8" stroke="#15140F" strokeWidth="1.2" />
      {/* Compass needle in accent */}
      <polygon points="122,74 127,92 122,110 117,92" fill="#FF5B1F" stroke="#15140F" strokeWidth="1.2" />
      <circle cx="122" cy="92" r="3" fill="#15140F" />
    </svg>
  );
}
