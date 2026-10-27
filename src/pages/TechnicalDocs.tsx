import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileDown,
  ArrowLeft,
  Cpu,
  ShieldCheck,
  Database,
  GitBranch,
  Layers,
  Terminal,
  Check,
} from 'lucide-react';
import { downloadTechnicalDocPdf } from '../utils/generateTechnicalPdf';
import { Button } from '../components/Button';
import { LatticeMark } from '../components/Illustration';
import { useReveal } from '../motion/reveal';
import { getStoredUser } from '../api/client';

export function TechnicalDocs() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const [downloaded, setDownloaded] = useState(false);

  useReveal(containerRef, []);

  const handleDownloadPdf = () => {
    downloadTechnicalDocPdf('Lattice_AICTE_Technical_Documentation.pdf');
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: user ? undefined : '100vh',
        backgroundColor: 'var(--paper)',
        padding: user ? 0 : '32px 40px 64px 40px',
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* Top Action Bar */}
        <div
          data-reveal
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            paddingBottom: 16,
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!user && <LatticeMark size={28} />}
            <button
              type="button"
              onClick={() => navigate(user ? -1 as any : '/login')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--ink-2)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              <span>{user ? 'Back to workspace' : 'Back to Sign In'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a
              href="/Lattice_AICTE_Technical_Documentation.pdf"
              download="Lattice_AICTE_Technical_Documentation.pdf"
              className="font-mono"
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                backgroundColor: 'var(--surface)',
                color: 'var(--ink)',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <FileDown size={14} strokeWidth={1.8} />
              <span>Static PDF File</span>
            </a>

            <Button variant="primary" size="md" magnetic onClick={handleDownloadPdf}>
              {downloaded ? <Check size={16} strokeWidth={2} /> : <FileDown size={16} strokeWidth={1.8} />}
              <span>
                {downloaded
                  ? 'Downloaded PDF!'
                  : 'Download Technical Documentation (PDF)'}
              </span>
            </Button>
          </div>
        </div>

        {/* Hero Title Card */}
        <div
          data-reveal
          className="lattice-card"
          style={{
            padding: 32,
            backgroundColor: 'var(--ink)',
            color: 'var(--paper)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#FF5B1F',
              }}
            >
              AICTE REGULATORY ENGINEERING SPECIFICATION · v2.0
            </span>
            <span className="font-mono" style={{ fontSize: 11, color: '#D8D2C2' }}>
              FILE: Lattice_AICTE_Technical_Documentation.pdf
            </span>
          </div>

          <h1
            className="font-display"
            style={{
              fontSize: 36,
              lineHeight: 1.1,
              margin: 0,
              fontWeight: 500,
              color: '#FBF9F4',
            }}
          >
            Lattice: Complaint & Institutional Risk Intelligence
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#D8D2C2', maxWidth: 820, lineHeight: 1.55 }}>
            Complete technical architecture, mathematical formulations (TF-IDF cosine linking,
            Union-Find clustering, 5-factor composite risk index, logistic SLA breach model),
            4-role RBAC security specification, domain schemas, and REST API reference.
          </p>
        </div>

        {/* Section 1: Architecture & Stack */}
        <div data-reveal className="lattice-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
            <Layers size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
            <div>
              <span className="micro-label">Section 01</span>
              <h2 className="card-heading" style={{ margin: 0 }}>
                System Architecture & Technology Stack
              </h2>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Frontend Client (SPA)</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                <li><strong>Framework:</strong> React 19.0 + TypeScript 7 + Vite 8 + React Router v7</li>
                <li><strong>Styling & Tokens:</strong> Tailwind CSS v4 + Custom Editorial Design System (`#F6F4EF` Warm Paper, `#15140F` Deep Ink, `#FF5B1F` Signal Accent)</li>
                <li><strong>Typography:</strong> `Newsreader` (Display Serif), `Plus Jakarta Sans` (UI Sans), `JetBrains Mono` (Tabular Numerals & Formulas)</li>
                <li><strong>Motion & Charts:</strong> GSAP 3.12 (`gsap.context`, staggered reveals, SVG path drawing) + Custom SVG visualizations (`WeeklyTrendChart`, `UnitWorkloadBars`, `Sparkline`, `RiskMeter`, `LinkGraph`)</li>
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Backend & Persistence</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                <li><strong>Server Runtime:</strong> Node.js + Express 4 (`server.ts` on Port 3000)</li>
                <li><strong>Authentication:</strong> Salted SHA-256 password verification (`lattice_salt_2026`) + stateless-recoverable Bearer session tokens (`acct_&lt;id&gt;_&lt;hex&gt;`)</li>
                <li><strong>Datastore:</strong> JSON state persistence at `.data/lattice_state.json`</li>
                <li><strong>Seed Engine:</strong> Deterministic `Mulberry32` PRNG (`seed = 20260419`) generating 40 AICTE institutions, 320 complaints, 4 regulatory units (`AB`, `ACB`, `SGC`, `VC`), and 8 officers</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 2: 4-Role RBAC & Password Authentication */}
        <div data-reveal className="lattice-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
            <ShieldCheck size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
            <div>
              <span className="micro-label">Section 02</span>
              <h2 className="card-heading" style={{ margin: 0 }}>
                4-Role RBAC & Password Authentication Specification (Section 3)
              </h2>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            The application enforces strictly <strong>four roles without subroles</strong>: <code>chairman</code>, <code>bureau_head</code>, <code>case_officer</code>, and <code>admin</code>. Every API endpoint and UI view validates the active session against the Section 3 capability matrix below:
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Chairman</th>
                  <th>Bureau Head</th>
                  <th>Case Officer</th>
                  <th>Admin</th>
                </tr>
              </thead>
              <tbody className="font-mono" style={{ fontSize: 12 }}>
                <tr>
                  <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Register complaint</td>
                  <td>no</td>
                  <td style={{ color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                  <td style={{ color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                  <td>no</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>View case list and detail</td>
                  <td>all bureaus, full</td>
                  <td>full</td>
                  <td>full (assigned cases first)</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>all bureaus, metadata only (3.1)</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Assign / reassign officer</td>
                  <td>no</td>
                  <td style={{ color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                  <td>no</td>
                  <td style={{ color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Add action note</td>
                  <td>no</td>
                  <td style={{ color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                  <td>assigned cases</td>
                  <td>no</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Status transitions</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>reopen only</td>
                  <td>per section 5</td>
                  <td>per section 5 (assigned)</td>
                  <td>none</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Resolve institution-link queue</td>
                  <td>no</td>
                  <td style={{ color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                  <td>no</td>
                  <td style={{ color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Chairman dashboard</td>
                  <td style={{ color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                  <td>no</td>
                  <td>no</td>
                  <td>no</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Bureau dashboard</td>
                  <td>no</td>
                  <td style={{ color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                  <td>no</td>
                  <td>no</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            className="font-mono"
            style={{
              padding: 16,
              borderRadius: 10,
              backgroundColor: 'var(--paper-2)',
              border: '1px solid var(--line)',
              fontSize: 12,
              lineHeight: 1.65,
            }}
          >
            <div><strong>Official Role Accounts:</strong></div>
            <div>1. Chairman    : chairman@aicte.gov.in     | Password: Chairman@123</div>
            <div>2. Bureau Head : bureau_head@aicte.gov.in  | Password: Bureau@123</div>
            <div>3. Case Officer: case_officer@aicte.gov.in | Password: Officer@123 (Officer ID: 6 · Kavita Nair)</div>
            <div>4. Admin       : admin@aicte.gov.in        | Password: Admin@123</div>
          </div>
        </div>

        {/* Section 3: Core Intelligence Engines & Mathematical Models */}
        <div data-reveal className="lattice-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
            <Cpu size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
            <div>
              <span className="micro-label">Section 03</span>
              <h2 className="card-heading" style={{ margin: 0 }}>
                Core Intelligence Engines & Mathematical Formulations
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                3.1 Automated Intake Classification & Statutory SLA Windows
              </div>
              <pre
                className="font-mono"
                style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 8,
                  backgroundColor: 'var(--paper-2)',
                  border: '1px solid var(--line)',
                  fontSize: 12,
                  overflowX: 'auto',
                  lineHeight: 1.55,
                }}
              >{`confidence = clamp(0.55 + 0.08 * bestScore + 0.05 * (bestScore - secondScore), 0.55, 0.96)
SLA_DAYS   = { Critical: 3, High: 7, Medium: 15, Low: 30 }
due_at     = created_at + SLA_DAYS[severity] * 86400 seconds`}</pre>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                3.2 Sublinear TF-IDF Cosine Similarity & Union-Find Case Clustering
              </div>
              <pre
                className="font-mono"
                style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 8,
                  backgroundColor: 'var(--paper-2)',
                  border: '1px solid var(--line)',
                  fontSize: 12,
                  overflowX: 'auto',
                  lineHeight: 1.55,
                }}
              >{`tfWeight(tf)     = 1 + ln(tf)
idfWeight(df, N) = ln((N + 1) / (df + 1)) + 1
cosine(A, B)     = dot(vecA, vecB) / (||vecA|| * ||vecB||)

Link Thresholds (within same institution):
- Duplicate : cosine(A, B) >= 0.52
- Similar   : 0.28 <= cosine(A, B) < 0.52
- Context   : unit(A) !== unit(B) AND |created(A) - created(B)| <= 45 days`}</pre>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                3.3 5-Factor Composite Institution Risk Formula (90-Day Rolling Window)
              </div>
              <pre
                className="font-mono"
                style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 8,
                  backgroundColor: 'var(--paper-2)',
                  border: '1px solid var(--line)',
                  fontSize: 12,
                  overflowX: 'auto',
                  lineHeight: 1.55,
                }}
              >{`V (Volume, 30%)          = min(1.0, count_90d / 12)
S (Severity Mix, 25%)    = sum(sev_weight) / (4 * count_90d)  [Low=1, Med=2, High=3, Crit=4]
R (Recurrence, 20%)      = min(1.0, ((max_cluster - 1) / 4) * 0.6 + repeat_cat_share * 0.4)
A (SLA Breach Rate, 15%) = min(1.0, (breached_or_late_90d / count_90d) * 1.4)
X (Unit Spread, 10%)     = (distinct_units_90d - 1) / 3

Composite Score = round(100 * (0.30*V + 0.25*S + 0.20*R + 0.15*A + 0.10*X))
Risk Bands      = Low (0–34) | Watch (35–59) | High (60–79) | Critical (80–100)`}</pre>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                3.4 Logistic SLA Breach Probability & Early-Warning Rules (R1–R4)
              </div>
              <pre
                className="font-mono"
                style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 8,
                  backgroundColor: 'var(--paper-2)',
                  border: '1px solid var(--line)',
                  fontSize: 12,
                  overflowX: 'auto',
                  lineHeight: 1.55,
                }}
              >{`elapsed_ratio      = (now - created_at) / (due_at - created_at)
z                  = -2.2 + 3.2 * elapsed_ratio + 0.8 * unit_load + 0.6 * stagnation + 0.5 * is_high_crit
breach_probability = 1 / (1 + exp(-z))

Alert Rules:
- R1 (Risk Threshold)    : Institution composite risk score >= 80 (Critical) or >= 60 (High)
- R2 (Cross-Cell Pattern): >= 3 distinct regulatory units involved at same institution within 45 days
- R3 (SLA Breach Risk)   : High/Critical case with breach_probability >= 0.75 or SLA breached
- R4 (Duplicate Cluster) : >= 3 complaints linked in same TF-IDF cluster within 30 days`}</pre>
            </div>
          </div>
        </div>

        {/* Section 4: Section 5 State Machine & API Reference */}
        <div data-reveal className="lattice-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
            <Terminal size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
            <div>
              <span className="micro-label">Section 04</span>
              <h2 className="card-heading" style={{ margin: 0 }}>
                REST API Specification & Section 5 State Machine
              </h2>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Permitted Roles</th>
                  <th>Technical Behavior</th>
                </tr>
              </thead>
              <tbody className="font-mono" style={{ fontSize: 12 }}>
                <tr>
                  <td>GET /api/auth/accounts</td>
                  <td>Public</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Returns the 4 role accounts and password hints.</td>
                </tr>
                <tr>
                  <td>POST /api/auth/login</td>
                  <td>Public</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Verifies SHA-256 salted password hash; returns token & UserInfo.</td>
                </tr>
                <tr>
                  <td>GET /api/overview</td>
                  <td>chairman, bureau_head</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Returns Chairman Dashboard or Bureau Dashboard (with officer workload).</td>
                </tr>
                <tr>
                  <td>GET /api/complaints</td>
                  <td>All 4 Roles</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Paginated dockets; Case Officer sorted assigned-first; Admin metadata-only.</td>
                </tr>
                <tr>
                  <td>POST /api/complaints/analyze</td>
                  <td>bureau_head, case_officer</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Live TF-IDF similarity link detection & projected institution risk delta.</td>
                </tr>
                <tr>
                  <td>POST /api/complaints</td>
                  <td>bureau_head, case_officer</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Registers new complaint, auto-assigns if filed by Case Officer, recomputes graph.</td>
                </tr>
                <tr>
                  <td>GET /api/complaints/:id</td>
                  <td>All 4 Roles</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Full dossier & audit timeline; redacts narrative & Note bodies for Admin.</td>
                </tr>
                <tr>
                  <td>PATCH /api/complaints/:id</td>
                  <td>Role-Enforced</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Enforces officer assignment, Section 5 status transitions / Reopen, and action notes.</td>
                </tr>
                <tr>
                  <td>GET /api/link-queue</td>
                  <td>All 4 Roles</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Lists candidate Duplicate, Similar, and Context links across institutions.</td>
                </tr>
                <tr>
                  <td>POST /api/link-queue/:id/resolve</td>
                  <td>bureau_head, admin</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Confirms or dismisses a candidate case link and logs audit events on both cases.</td>
                </tr>
                <tr>
                  <td>GET /api/institutions/:id</td>
                  <td>All 4 Roles</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Explainable 5-factor risk breakdown (30V+25S+20R+15A+10X) & 12-week history.</td>
                </tr>
                <tr>
                  <td>GET /api/alerts</td>
                  <td>All 4 Roles</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>Lists R1–R4 early warning triggers; Chairman & Bureau Head can acknowledge.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
