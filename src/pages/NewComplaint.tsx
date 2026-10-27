import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowRight, Link2, Search, Check, Lock, RotateCcw } from 'lucide-react';
import { api, getStoredUser } from '../api/client';
import type { AnalyzeResponse, InstitutionListItem, UnitCode } from '../api/types';
import {
  UnitBadge,
  SeverityBadge,
  BandBadge,
  CustomSelect,
} from '../components/Badge';
import { Button } from '../components/Button';
import { RiskMeter } from '../components/RiskMeter';
import { AnalysisIdleIllustration } from '../components/Illustration';
import { useToast } from '../components/Toast';
import { useReveal, prefersReducedMotion } from '../motion/reveal';

const CATEGORY_TO_DEFAULT_UNIT: Record<string, UnitCode> = {
  'Fee and Refund': 'SGC',
  'Student Harassment and Welfare': 'SGC',
  'Document and Certificate Issues': 'SGC',
  'Admissions and Affiliation': 'AB',
  'Infrastructure and Safety': 'AB',
  'Faculty and Staffing': 'ACB',
  'Academic Quality and Exams': 'ACB',
  'Placement and Misrepresentation': 'VC',
};

const CATEGORIES = [
  { value: '', label: 'Auto-detect category' },
  { value: 'Fee and Refund', label: 'Fee and Refund (SGC)' },
  { value: 'Student Harassment and Welfare', label: 'Student Harassment and Welfare (SGC)' },
  { value: 'Document and Certificate Issues', label: 'Document and Certificate Issues (SGC)' },
  { value: 'Admissions and Affiliation', label: 'Admissions and Affiliation (AB)' },
  { value: 'Infrastructure and Safety', label: 'Infrastructure and Safety (AB)' },
  { value: 'Faculty and Staffing', label: 'Faculty and Staffing (ACB)' },
  { value: 'Academic Quality and Exams', label: 'Academic Quality and Exams (ACB)' },
  { value: 'Placement and Misrepresentation', label: 'Placement and Misrepresentation (VC)' },
];

const UNITS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Auto-route unit' },
  { value: 'SGC', label: 'SGC — Student Grievance Cell' },
  { value: 'ACB', label: 'ACB — Academic Compliance Bureau' },
  { value: 'AB', label: 'AB — Approval Bureau' },
  { value: 'VC', label: 'VC — Vigilance Cell' },
];

const SEVERITIES = [
  { value: '', label: 'Auto-detect severity' },
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Critical', label: 'Critical' },
];

const COMPLAINANT_TYPES = [
  { value: 'Student', label: 'Student' },
  { value: 'Parent', label: 'Parent' },
  { value: 'Faculty', label: 'Faculty' },
  { value: 'Staff', label: 'Staff' },
  { value: 'Anonymous', label: 'Anonymous' },
];

export function NewComplaint() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const analysisPanelRef = useRef<HTMLDivElement>(null);
  const deltaNumRef = useRef<HTMLSpanElement>(null);

  const user = getStoredUser();
  const canRegister =
    user?.role === 'bureau_head' || user?.role === 'case_officer';

  const [institutions, setInstitutions] = useState<InstitutionListItem[]>([]);
  const [instQuery, setInstQuery] = useState('');
  const [instDropdownOpen, setInstDropdownOpen] = useState(false);
  const [selectedInstId, setSelectedInstId] = useState<number>(
    Number(searchParams.get('institution_id')) || 1
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [complainantType, setComplainantType] = useState('Student');
  const [categoryOverride, setCategoryOverride] = useState('');
  const [unitOverride, setUnitOverride] = useState('');
  const [severityOverride, setSeverityOverride] = useState('');

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const instWrapRef = useRef<HTMLDivElement>(null);

  // Handler for changing category (syncs default unit if unit was manually set or keeps auto-unit aligned)
  const handleCategoryChange = (newCategory: string) => {
    setCategoryOverride(newCategory);
    if (newCategory && CATEGORY_TO_DEFAULT_UNIT[newCategory]) {
      setUnitOverride(CATEGORY_TO_DEFAULT_UNIT[newCategory]);
    } else if (!newCategory) {
      setUnitOverride('');
    }
  };

  const handleUnitChange = (newUnit: string) => {
    setUnitOverride(newUnit);
  };

  const handleResetOverrides = () => {
    setCategoryOverride('');
    setUnitOverride('');
    setSeverityOverride('');
  };

  const hasOverrides = Boolean(categoryOverride || unitOverride || severityOverride);

  useEffect(() => {
    if (!canRegister) return;
    api
      .getInstitutions({ page: 1, page_size: 60, sort: 'name_asc' })
      .then((res) => {
        setInstitutions(res.items);
      })
      .catch(() => {});
  }, [canRegister]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (instWrapRef.current && !instWrapRef.current.contains(e.target as Node)) {
        setInstDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useReveal(containerRef, []);

  // Live analysis triggered by title/description or category/unit/severity overrides
  useEffect(() => {
    const hasEnoughText =
      description.trim().length >= 15 ||
      title.trim().length >= 6 ||
      Boolean(categoryOverride) ||
      Boolean(unitOverride) ||
      Boolean(severityOverride);

    if (!canRegister || !selectedInstId || !hasEnoughText) {
      setAnalysis(null);
      return;
    }

    const timer = setTimeout(async () => {
      setAnalyzing(true);
      try {
        const res = await api.analyzeComplaint({
          institution_id: selectedInstId,
          title: title.trim(),
          description: description.trim(),
          category: categoryOverride || undefined,
          unit_code: unitOverride || undefined,
          severity: severityOverride || undefined,
        });
        setAnalysis(res);
      } catch {
        // ignore transient error
      } finally {
        setAnalyzing(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    canRegister,
    selectedInstId,
    title,
    description,
    categoryOverride,
    unitOverride,
    severityOverride,
  ]);

  // Animate live analysis panel when results arrive
  useEffect(() => {
    if (!analysis || !analysisPanelRef.current || prefersReducedMotion()) return;
    const el = analysisPanelRef.current;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0.4, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }
      );
      if (deltaNumRef.current) {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: analysis.projected_risk.delta,
          duration: 0.7,
          ease: 'power2.out',
          snap: { val: 1 },
          onUpdate: () => {
            if (deltaNumRef.current) {
              const v = Math.round(obj.val);
              deltaNumRef.current.textContent = v >= 0 ? `+${v}` : String(v);
            }
          },
        });
      }
    }, el);
    return () => ctx.revert();
  }, [analysis]);

  if (!canRegister) {
    return (
      <div ref={containerRef} className="lattice-card" style={{ padding: 36, maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--risk-critical-text)' }}>
          <Lock size={20} strokeWidth={1.8} />
          <span className="micro-label" style={{ color: 'var(--risk-critical-text)' }}>
            Section 3 Role Restriction
          </span>
        </div>
        <h2 className="section-heading" style={{ marginTop: 10 }}>
          Complaint registration is restricted for {user?.role.replace('_', ' ')}
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.55, marginTop: 8 }}>
          Per Section 3 permissions, only <strong>Bureau Head</strong> and{' '}
          <strong>Case Officer</strong> roles are permitted to register new complaints. Chairman and
          Admin roles do not have complaint registration privileges.
        </p>
        <div style={{ marginTop: 20 }}>
          <Button variant="secondary" onClick={() => navigate('/complaints')}>
            <span>Return to complaints registry</span>
          </Button>
        </div>
      </div>
    );
  }

  const selectedInst = institutions.find((i) => i.id === selectedInstId);
  const filteredInsts = institutions.filter((i) => {
    if (!instQuery.trim()) return true;
    const q = instQuery.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      i.city.toLowerCase().includes(q) ||
      i.state.toLowerCase().includes(q)
    );
  });

  const prefillMeridianDemo = () => {
    const meridian = institutions.find((i) =>
      i.name.toLowerCase().includes('meridian institute of technology')
    );
    if (meridian) setSelectedInstId(meridian.id);
    else setSelectedInstId(1);
    setTitle('Fee refund not returned after withdrawing admission');
    setDescription(
      'I withdrew my admission within the AICTE counselling deadline at Meridian Institute of Technology, but the accounts office has withheld my tuition fee refund and original receipt for over five weeks.'
    );
    setComplainantType('Student');
    setCategoryOverride('');
    setUnitOverride('');
    setSeverityOverride('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstId || !title.trim() || !description.trim()) {
      showToast('Please select an institution and enter a title and description');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createComplaint({
        institution_id: selectedInstId,
        title: title.trim(),
        description: description.trim(),
        complainant_type: complainantType,
        category: categoryOverride || undefined,
        unit_code: unitOverride || undefined,
        severity: severityOverride || undefined,
      });
      showToast(`Complaint ${created.ref} registered and routed to ${created.unit_code}`);
      navigate(`/complaints/${created.id}`);
    } catch (err: any) {
      showToast(err?.message || 'Unable to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const autoCatLabel = analysis?.auto_category || analysis?.category;
  const autoUnitLabel = analysis?.auto_unit_code || analysis?.unit_code;
  const autoSevLabel = analysis?.auto_severity || analysis?.severity;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'grid',
        gridTemplateColumns: '7fr 5fr',
        gap: 28,
        alignItems: 'start',
      }}
    >
      {/* Left Column: Intake Form */}
      <form
        onSubmit={handleSubmit}
        className="lattice-card"
        data-reveal
        style={{ display: 'flex', flexDirection: 'column', gap: 22 }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingBottom: 16,
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div>
            <span className="micro-label">
              Authorized Intake ({user?.role.replace('_', ' ')})
            </span>
            <h2 className="section-heading" style={{ marginTop: 4 }}>
              Register institutional complaint
            </h2>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={prefillMeridianDemo}
            title="Fill sample Meridian refund complaint for live demonstration"
          >
            <span>Fill Meridian refund sample</span>
          </Button>
        </div>

        {/* Searchable Institution Select */}
        <div ref={instWrapRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Institution
          </label>
          <button
            type="button"
            data-cursor="link"
            className="custom-select-trigger"
            onClick={() => setInstDropdownOpen((o) => !o)}
          >
            <span style={{ fontWeight: 600 }}>
              {selectedInst
                ? `${selectedInst.name} (${selectedInst.city}, ${selectedInst.state})`
                : 'Select institution...'}
            </span>
            <Search size={15} strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
          </button>

          {instDropdownOpen && (
            <div className="custom-select-menu" style={{ padding: 10, maxHeight: 320 }}>
              <input
                type="search"
                value={instQuery}
                onChange={(e) => setInstQuery(e.target.value)}
                placeholder="Type institution name or city..."
                className="lattice-input"
                style={{ height: 36, marginBottom: 8, fontSize: 13 }}
                autoFocus
              />
              <div style={{ maxHeight: 230, overflowY: 'auto' }}>
                {filteredInsts.map((inst) => (
                  <button
                    key={inst.id}
                    type="button"
                    className="custom-select-option"
                    data-selected={inst.id === selectedInstId}
                    onClick={() => {
                      setSelectedInstId(inst.id);
                      setInstDropdownOpen(false);
                      setInstQuery('');
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{inst.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                        {inst.city}, {inst.state} · Risk score {inst.score} ({inst.band})
                      </div>
                    </div>
                    {inst.id === selectedInstId && (
                      <Check size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="comp-title" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Complaint summary title
          </label>
          <input
            id="comp-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Tuition fee refund not returned after withdrawing admission"
            className="lattice-input"
          />
        </div>

        {/* Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label htmlFor="comp-desc" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Detailed statement
            </label>
            <span className="font-mono tabular-nums" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {description.trim().length} chars (live routing & cross-cell analysis active)
            </span>
          </div>
          <textarea
            id="comp-desc"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the incident, dates, amounts, or safety concerns in detail..."
            className="lattice-textarea"
          />
        </div>

        {/* Complainant Type & Live Category / Unit / Severity Assignment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="micro-label">Classification & Unit Routing Assignment</span>
            {hasOverrides && (
              <button
                type="button"
                onClick={handleResetOverrides}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <RotateCcw size={12} strokeWidth={2} />
                <span>Reset to auto-detected</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                Category assignment
              </label>
              <CustomSelect
                value={categoryOverride}
                onChange={handleCategoryChange}
                options={[
                  {
                    value: '',
                    label: autoCatLabel
                      ? `Auto: ${autoCatLabel}`
                      : 'Auto-detect category',
                  },
                  ...CATEGORIES.slice(1),
                ]}
                minWidth={160}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                Unit assignment
              </label>
              <CustomSelect
                value={unitOverride}
                onChange={handleUnitChange}
                options={[
                  {
                    value: '',
                    label: autoUnitLabel
                      ? `Auto-routed: ${autoUnitLabel}`
                      : 'Auto-route unit',
                  },
                  ...UNITS.slice(1),
                ]}
                minWidth={160}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                Complainant type
              </label>
              <CustomSelect
                value={complainantType}
                onChange={setComplainantType}
                options={COMPLAINANT_TYPES}
                minWidth={140}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                Severity assignment
              </label>
              <CustomSelect
                value={severityOverride}
                onChange={setSeverityOverride}
                options={[
                  {
                    value: '',
                    label: autoSevLabel
                      ? `Auto-detected: ${autoSevLabel}`
                      : 'Auto-detect severity',
                  },
                  ...SEVERITIES.slice(1),
                ]}
                minWidth={140}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            paddingTop: 12,
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Filing persists the case, updates institution risk, and evaluates alerts R1–R4.
          </span>
          <Button type="submit" variant="primary" magnetic disabled={submitting}>
            <span>{submitting ? 'Registering complaint...' : 'Register complaint'}</span>
            <ArrowRight size={16} strokeWidth={1.8} />
          </Button>
        </div>
      </form>

      {/* Right Column: Sticky Live Analysis Panel */}
      <div
        data-reveal
        style={{
          position: 'sticky',
          top: 24,
        }}
      >
        <div className="lattice-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div>
              <span className="micro-label" style={{ color: 'var(--accent)' }}>
                Real-Time Intelligence Preview
              </span>
              <h2 className="card-heading" style={{ marginTop: 2 }}>
                Live cross-cell analysis
              </h2>
            </div>
            {analyzing && (
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                Analyzing...
              </span>
            )}
          </div>

          {!analysis ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '24px 16px',
                gap: 16,
              }}
            >
              <AnalysisIdleIllustration />
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                Awaiting complaint details or manual unit/category selection
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', maxWidth: 360 }}>
                Enter a title/description (or click &ldquo;Fill Meridian refund sample&rdquo;) or
                assign a category and unit below to preview live cross-cell routing, duplicate
                links, and projected risk impact.
              </p>

              {/* Allow pre-assigning Category & Unit directly inside Real-Time Intelligence Preview even while idle */}
              <div
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: 'var(--paper)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  textAlign: 'left',
                }}
              >
                <span className="micro-label">Live Routing Assignment</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
                    Category
                  </span>
                  <CustomSelect
                    value={categoryOverride}
                    onChange={handleCategoryChange}
                    options={CATEGORIES}
                    minWidth={180}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
                    Routed Unit
                  </span>
                  <CustomSelect
                    value={unitOverride}
                    onChange={handleUnitChange}
                    options={UNITS}
                    minWidth={180}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={analysisPanelRef}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              {/* Interactive Classification & Live Unit/Category Routing inside Real-Time Intelligence Preview */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: 'var(--paper)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 8,
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="micro-label">
                      {hasOverrides ? 'Manual Routing Override' : 'Auto-Classified Routing'}
                    </span>
                    <span
                      className="font-mono tabular-nums"
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-2)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: 'var(--paper-2)',
                      }}
                    >
                      {Math.round(analysis.confidence * 100)}% NLP conf.
                    </span>
                  </div>

                  {hasOverrides && (
                    <button
                      type="button"
                      onClick={handleResetOverrides}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--accent)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <RotateCcw size={11} strokeWidth={2} />
                      <span>Reset auto</span>
                    </button>
                  )}
                </div>

                {/* Live Category Selector in Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
                      Assigned Category
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {categoryOverride
                        ? `Overridden (Auto: ${autoCatLabel})`
                        : 'Auto-detected from text'}
                    </span>
                  </div>
                  <CustomSelect
                    value={categoryOverride}
                    onChange={handleCategoryChange}
                    options={[
                      {
                        value: '',
                        label: `Auto-detected: ${autoCatLabel}`,
                      },
                      ...CATEGORIES.slice(1),
                    ]}
                    minWidth={200}
                  />
                </div>

                {/* Live Unit Selector in Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
                      Assigned Unit
                    </span>
                    <UnitBadge code={analysis.unit_code} showFull />
                  </div>
                  <CustomSelect
                    value={unitOverride}
                    onChange={handleUnitChange}
                    options={[
                      {
                        value: '',
                        label: `Auto-routed: ${
                          categoryOverride
                            ? CATEGORY_TO_DEFAULT_UNIT[categoryOverride] || autoUnitLabel
                            : autoUnitLabel
                        }`,
                      },
                      ...UNITS.slice(1),
                    ]}
                    minWidth={200}
                  />
                </div>

                {/* Live Severity Selector in Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
                      Assigned Severity
                    </span>
                    <SeverityBadge severity={analysis.severity} />
                  </div>
                  <CustomSelect
                    value={severityOverride}
                    onChange={setSeverityOverride}
                    options={[
                      {
                        value: '',
                        label: `Auto-detected: ${autoSevLabel}`,
                      },
                      ...SEVERITIES.slice(1),
                    ]}
                    minWidth={200}
                  />
                </div>
              </div>

              {/* Projected Risk Before / After */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: 'var(--paper)',
                  border: '1px solid var(--ink)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="micro-label">Projected Institution Risk Impact</span>
                  <span
                    ref={deltaNumRef}
                    className="font-mono tabular-nums"
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      color: 'var(--accent)',
                      borderBottom: '2px solid var(--accent)',
                    }}
                  >
                    +{analysis.projected_risk.delta}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 4 }}>
                      Current ({analysis.projected_risk.band_before})
                    </div>
                    <RiskMeter
                      score={analysis.projected_risk.current}
                      band={analysis.projected_risk.band_before}
                      size="sm"
                    />
                  </div>
                  <ArrowRight size={18} strokeWidth={1.8} style={{ color: 'var(--ink-2)' }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600, marginBottom: 4 }}>
                      Projected ({analysis.projected_risk.band_after})
                    </div>
                    <RiskMeter
                      score={analysis.projected_risk.projected}
                      band={analysis.projected_risk.band_after}
                      size="sm"
                    />
                  </div>
                </div>

                {analysis.projected_risk.band_before !== analysis.projected_risk.band_after && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 8,
                      borderTop: '1px solid var(--line)',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--risk-critical-text)',
                    }}
                  >
                    <span>Risk band threshold crossed:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BandBadge band={analysis.projected_risk.band_before} />
                      <span>→</span>
                      <BandBadge band={analysis.projected_risk.band_after} />
                    </div>
                  </div>
                )}
              </div>

              {/* Matched Linked Cases */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="micro-label">
                    Matched Linked Cases ({analysis.links.length})
                  </span>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    TF-IDF + Cross-Unit Window
                  </span>
                </div>

                {analysis.links.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    No existing complaints at this institution match within similarity or context thresholds.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {analysis.links.slice(0, 5).map((lk) => {
                      const simPct = Math.round(lk.similarity * 100);
                      const isDup = lk.type === 'Duplicate';
                      return (
                        <div
                          key={lk.id}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--line)',
                            backgroundColor: 'var(--paper)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Link2 size={13} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
                              <span className="font-mono" style={{ fontSize: 11, fontWeight: 600 }}>
                                {lk.ref}
                              </span>
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: isDup ? 'var(--risk-critical-bg)' : 'var(--paper-2)',
                                  color: isDup ? 'var(--risk-critical-text)' : 'var(--ink)',
                                }}
                              >
                                {isDup ? 'Possible duplicate' : lk.type}
                              </span>
                              <UnitBadge code={lk.unit_code} />
                            </div>
                            <span className="font-mono tabular-nums" style={{ fontSize: 11, fontWeight: 600 }}>
                              {simPct}% sim
                            </span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                            {lk.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
