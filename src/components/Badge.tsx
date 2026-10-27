import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { UnitCode, SeverityLevel, RiskBand, ComplaintStatus, SlaState } from '../api/types';

export function UnitBadge({ code, showFull = false }: { code: UnitCode; showFull?: boolean }) {
  const names: Record<UnitCode, string> = {
    AB: 'Approval Bureau',
    ACB: 'Academic Bureau',
    SGC: 'Student Grievance Cell',
    VC: 'Vigilance Cell',
  };
  return (
    <span className={`badge badge-unit-${code}`} title={names[code]}>
      <span>{code}</span>
      {showFull && <span style={{ fontWeight: 400 }}>· {names[code]}</span>}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return <span className={`badge badge-sev-${severity}`}>{severity}</span>;
}

export function BandBadge({ band }: { band: RiskBand }) {
  return <span className={`badge badge-band-${band}`}>{band} Risk</span>;
}

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const extra =
    status === 'Escalated'
      ? 'badge-status-Escalated'
      : status === 'Resolved' || status === 'Closed'
      ? `badge-status-${status}`
      : '';
  return <span className={`badge badge-status ${extra}`}>{status}</span>;
}

export function SlaIndicator({ state, probability }: { state: SlaState; probability?: number }) {
  const labels: Record<SlaState, string> = {
    ok: 'On track',
    at_risk: probability ? `At risk (${Math.round(probability * 100)}%)` : 'At risk',
    breached: 'Breached',
    closed: 'Closed',
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: state === 'breached' ? 600 : 500,
        color:
          state === 'breached'
            ? 'var(--risk-critical-text)'
            : state === 'at_risk'
            ? 'var(--risk-watch-text)'
            : 'var(--ink-2)',
        whiteSpace: 'nowrap',
      }}
    >
      <span className={`sla-dot sla-dot-${state}`} />
      <span>{labels[state]}</span>
    </span>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  ariaLabel,
  minWidth = 156,
}: {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setFocusIdx(0);
      } else {
        setFocusIdx((prev) => (prev + 1) % options.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) {
        setFocusIdx((prev) => (prev - 1 + options.length) % options.length);
      }
    } else if (e.key === 'Enter' && open && focusIdx >= 0 && focusIdx < options.length) {
      e.preventDefault();
      onChange(options[focusIdx].value);
      setOpen(false);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="custom-select-wrapper"
      style={{ minWidth }}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        onClick={() => setOpen((o) => !o)}
        data-cursor="link"
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.6}
          style={{
            flexShrink: 0,
            color: 'var(--ink-2)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.18s ease',
          }}
        />
      </button>

      {open && (
        <div className="custom-select-menu" role="listbox">
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected}
                data-focused={focusIdx === idx}
                className="custom-select-option"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
