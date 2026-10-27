import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  UserCheck,
  Settings,
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Check,
  FileDown,
  BookOpen,
} from 'lucide-react';
import { api, getDefaultHomePath } from '../api/client';
import type { DemoAccountInfo, UserInfo, UserRole } from '../api/types';
import { downloadTechnicalDocPdf } from '../utils/generateTechnicalPdf';
import { LatticeMark } from '../components/Illustration';
import { Button } from '../components/Button';
import { useReveal } from '../motion/reveal';

const FALLBACK_ACCOUNTS: DemoAccountInfo[] = [
  {
    email: 'chairman@aicte.gov.in',
    password_hint: 'Chairman@123',
    name: 'Prof. Devendra Pratap Singh',
    role: 'chairman',
    unit_code: null,
    title: 'Chairman',
  },
  {
    email: 'bureau_head@aicte.gov.in',
    password_hint: 'Bureau@123',
    name: 'Dr. Rajeshwar Rao',
    role: 'bureau_head',
    unit_code: null,
    title: 'Bureau Head',
  },
  {
    email: 'case_officer@aicte.gov.in',
    password_hint: 'Officer@123',
    name: 'Kavita Nair',
    role: 'case_officer',
    unit_code: null,
    title: 'Case Officer',
  },
  {
    email: 'admin@aicte.gov.in',
    password_hint: 'Admin@123',
    name: 'K. Subramanian',
    role: 'admin',
    unit_code: null,
    title: 'Admin',
  },
];

const ROLE_META: Record<
  UserRole,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    summary: string;
    icon: React.ComponentType<any>;
  }
> = {
  chairman: {
    label: 'Chairman',
    badgeBg: 'var(--ink)',
    badgeText: 'var(--paper)',
    summary: 'Chairman dashboard, full case view, reopen-only transitions',
    icon: ShieldCheck,
  },
  bureau_head: {
    label: 'Bureau Head',
    badgeBg: 'rgba(184, 80, 30, 0.12)',
    badgeText: 'var(--accent)',
    summary: 'Bureau dashboard, register cases, assign officers, notes, Section 5 status & link queue',
    icon: Building2,
  },
  case_officer: {
    label: 'Case Officer',
    badgeBg: '#EBF3FA',
    badgeText: '#1F568B',
    summary: 'Register cases, full view (assigned first), notes & Section 5 transitions on assigned cases',
    icon: UserCheck,
  },
  admin: {
    label: 'Admin',
    badgeBg: 'var(--paper-2)',
    badgeText: 'var(--ink-2)',
    summary: 'Metadata-only case view, assign/reassign officers, resolve institution-link queue',
    icon: Settings,
  },
};

export function Login({ onLogin }: { onLogin: (user: UserInfo) => void }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [accounts, setAccounts] = useState<DemoAccountInfo[]>(FALLBACK_ACCOUNTS);
  const [email, setEmail] = useState('chairman@aicte.gov.in');
  const [password, setPassword] = useState('Chairman@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useReveal(containerRef, []);

  useEffect(() => {
    api
      .getAccounts()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setAccounts(list);
        }
      })
      .catch(() => {
        // fallback accounts already set
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email.trim(), password);
      onLogin(res.user);
      navigate(getDefaultHomePath(res.user));
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (acc: DemoAccountInfo) => {
    setEmail(acc.email);
    setPassword(acc.password_hint);
    setError(null);
  };

  const handleQuickLogin = async (acc: DemoAccountInfo) => {
    setEmail(acc.email);
    setPassword(acc.password_hint);
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(acc.email, acc.password_hint);
      onLogin(res.user);
      navigate(getDefaultHomePath(res.user));
    } catch (err: any) {
      setError(err?.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '28px 40px',
      }}
    >
      {/* Top Bar */}
      <header
        data-reveal
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--line)',
          paddingBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LatticeMark size={30} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
              Lattice · AICTE Complaint Intelligence
            </div>
            <div className="micro-label">
              Role-Based Access Control · 4 Roles & Password Authentication
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/docs-public')}
          >
            <BookOpen size={14} strokeWidth={1.8} />
            <span>View Technical Docs</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => downloadTechnicalDocPdf('Lattice_AICTE_Technical_Documentation.pdf')}
          >
            <FileDown size={14} strokeWidth={1.8} />
            <span>Download Technical Doc (PDF)</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main
        style={{
          maxWidth: 1240,
          width: '100%',
          margin: '32px auto',
          display: 'grid',
          gridTemplateColumns: '5fr 7fr',
          gap: 36,
          alignItems: 'start',
        }}
      >
        {/* Left Column: Password Sign-In Form + Section 3 Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            data-reveal
            className="lattice-card"
            style={{
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              border: '1px solid var(--ink)',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(184, 80, 30, 0.1)',
                  color: 'var(--accent)',
                  marginBottom: 10,
                }}
              >
                <Lock size={13} strokeWidth={2} />
                <span className="font-mono" style={{ fontSize: 11, fontWeight: 600 }}>
                  AUTHENTICATED PORTAL SIGN-IN
                </span>
              </div>
              <h1
                className="font-display"
                style={{
                  fontSize: 30,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                Sign in with your role credentials
              </h1>
              <p style={{ margin: '8px 0 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Enter your official AICTE email and password below, or select one of the four roles
                on the right (`Chairman`, `Bureau Head`, `Case Officer`, `Admin`).
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: '11px 14px',
                  borderRadius: 8,
                  backgroundColor: 'var(--risk-critical-bg)',
                  color: 'var(--risk-critical-text)',
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid rgba(180, 35, 24, 0.25)',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  htmlFor="login-email"
                  className="micro-label"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Official Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    strokeWidth={1.7}
                    style={{
                      position: 'absolute',
                      left: 13,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--ink-3)',
                    }}
                  />
                  <input
                    id="login-email"
                    type="email"
                    className="lattice-input font-mono"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="role@aicte.gov.in"
                    style={{ paddingLeft: 38, fontSize: 13 }}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="micro-label"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    strokeWidth={1.7}
                    style={{
                      position: 'absolute',
                      left: 13,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--ink-3)',
                    }}
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="lattice-input font-mono"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    style={{ paddingLeft: 38, paddingRight: 40, fontSize: 13 }}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--ink-3)',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                magnetic
                disabled={loading}
                style={{ width: '100%', justifyContent: 'space-between', marginTop: 4 }}
              >
                <span>{loading ? 'Authenticating credentials...' : 'Sign In to Workspace'}</span>
                <ArrowRight size={18} strokeWidth={1.8} />
              </Button>
            </form>
          </div>

          {/* Section 3 Role & Capability Matrix Reference */}
          <div
            data-reveal
            className="lattice-card"
            style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="micro-label" style={{ color: 'var(--ink)' }}>
                Section 3 · Role & Capability Matrix (4 Roles)
              </span>
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                STRICT ENFORCEMENT
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 11.5,
                  lineHeight: 1.35,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 6px 6px 0', color: 'var(--ink-3)', fontWeight: 600 }}>
                      Capability
                    </th>
                    <th style={{ padding: 6, fontWeight: 600 }}>Chairman</th>
                    <th style={{ padding: 6, fontWeight: 600 }}>Bureau Head</th>
                    <th style={{ padding: 6, fontWeight: 600 }}>Case Officer</th>
                    <th style={{ padding: '6px 0 6px 6px', fontWeight: 600 }}>Admin</th>
                  </tr>
                </thead>
                <tbody className="font-mono" style={{ fontSize: 11 }}>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '7px 6px 7px 0', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                      Register complaint
                    </td>
                    <td style={{ padding: 6, color: 'var(--ink-3)' }}>no</td>
                    <td style={{ padding: 6, color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                    <td style={{ padding: 6, color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                    <td style={{ padding: '7px 0 7px 6px', color: 'var(--ink-3)' }}>no</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '7px 6px 7px 0', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                      View cases & detail
                    </td>
                    <td style={{ padding: 6 }}>full</td>
                    <td style={{ padding: 6 }}>full</td>
                    <td style={{ padding: 6 }}>full (assigned 1st)</td>
                    <td style={{ padding: '7px 0 7px 6px', color: 'var(--accent)' }}>metadata only</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '7px 6px 7px 0', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                      Assign officer
                    </td>
                    <td style={{ padding: 6, color: 'var(--ink-3)' }}>no</td>
                    <td style={{ padding: 6, color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                    <td style={{ padding: 6, color: 'var(--ink-3)' }}>no</td>
                    <td style={{ padding: '7px 0 7px 6px', color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '7px 6px 7px 0', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                      Add action note
                    </td>
                    <td style={{ padding: 6, color: 'var(--ink-3)' }}>no</td>
                    <td style={{ padding: 6, color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                    <td style={{ padding: 6 }}>assigned cases</td>
                    <td style={{ padding: '7px 0 7px 6px', color: 'var(--ink-3)' }}>no</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '7px 6px 7px 0', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                      Status transitions
                    </td>
                    <td style={{ padding: 6, color: 'var(--accent)' }}>reopen only</td>
                    <td style={{ padding: 6 }}>per sec 5</td>
                    <td style={{ padding: 6 }}>per sec 5</td>
                    <td style={{ padding: '7px 0 7px 6px', color: 'var(--ink-3)' }}>none</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '7px 6px 7px 0', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                      Resolve link queue
                    </td>
                    <td style={{ padding: 6, color: 'var(--ink-3)' }}>no</td>
                    <td style={{ padding: 6, color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                    <td style={{ padding: 6, color: 'var(--ink-3)' }}>no</td>
                    <td style={{ padding: '7px 0 7px 6px', color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '7px 6px 7px 0', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                      Chairman dashboard
                    </td>
                    <td style={{ padding: 6, color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                    <td style={{ padding: 6, color: 'var(--ink-3)' }}>no</td>
                    <td style={{ padding: 6, color: 'var(--ink-3)' }}>no</td>
                    <td style={{ padding: '7px 0 7px 6px', color: 'var(--ink-3)' }}>no</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '7px 6px 7px 0', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                      Bureau dashboard
                    </td>
                    <td style={{ padding: 6, color: 'var(--ink-3)' }}>no</td>
                    <td style={{ padding: 6, color: 'var(--risk-low-text)', fontWeight: 600 }}>yes</td>
                    <td style={{ padding: 6, color: 'var(--ink-3)' }}>no</td>
                    <td style={{ padding: '7px 0 7px 6px', color: 'var(--ink-3)' }}>no</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: The 4 Role Accounts (No Subroles) */}
        <div data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <span className="micro-label">4 Role Accounts · Click to Fill or Sign In</span>
            <h2 className="section-heading" style={{ marginTop: 2 }}>
              Select one of the 4 system roles
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13.5, color: 'var(--ink-2)' }}>
              Each role below enforces the exact capabilities specified in the Section 3 table.
            </p>
          </div>

          {/* 4 Role Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 14,
            }}
          >
            {accounts.map((acc) => {
              const meta = ROLE_META[acc.role];
              const IconComp = meta.icon;
              const isSelected = email.toLowerCase() === acc.email.toLowerCase();

              return (
                <div
                  key={acc.email}
                  onClick={() => handleSelectAccount(acc)}
                  style={{
                    padding: '18px 20px',
                    borderRadius: 12,
                    border: isSelected ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                    backgroundColor: isSelected ? 'var(--paper-2)' : 'var(--surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 9,
                          backgroundColor: meta.badgeBg,
                          color: meta.badgeText,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconComp size={18} strokeWidth={1.8} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="font-mono"
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 5,
                              backgroundColor: meta.badgeBg,
                              color: meta.badgeText,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                            }}
                          >
                            {meta.label}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                            {acc.name}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3 }}>
                          {meta.summary}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: 'var(--risk-low-text)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <Check size={13} strokeWidth={2.2} />
                        FILLED IN FORM
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      paddingTop: 10,
                      borderTop: '1px solid var(--line-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div className="font-mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                      Email: <strong style={{ color: 'var(--ink)' }}>{acc.email}</strong>
                      <span style={{ margin: '0 10px', color: 'var(--line)' }}>|</span>
                      Password: <strong style={{ color: 'var(--ink)' }}>{acc.password_hint}</strong>
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickLogin(acc);
                      }}
                      className="font-mono"
                      style={{
                        padding: '6px 14px',
                        borderRadius: 7,
                        fontSize: 11.5,
                        fontWeight: 600,
                        border: '1px solid var(--ink)',
                        backgroundColor: 'var(--ink)',
                        color: 'var(--paper)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>Sign in as {meta.label}</span>
                      <ArrowRight size={13} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--ink-3)',
        }}
      >
        <span>All India Council for Technical Education · Internal Regulatory System</span>
        <span className="font-mono">RBAC v2.0 · 4 Roles Only (Chairman, Bureau Head, Case Officer, Admin)</span>
      </footer>
    </div>
  );
}
