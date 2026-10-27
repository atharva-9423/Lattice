import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import {
  LayoutGrid,
  FileText,
  Building2,
  Bell,
  Plus,
  Search,
  LogOut,
  Link2,
  Shield,
  BookOpen,
  FileDown,
} from 'lucide-react';
import type { UserInfo, UserRole } from '../api/types';
import { api, clearAuthSession } from '../api/client';
import { downloadTechnicalDocPdf } from '../utils/generateTechnicalPdf';
import { LatticeMark } from './Illustration';
import { Button } from './Button';
import { prefersReducedMotion } from '../motion/reveal';

interface ShellProps {
  user: UserInfo;
  onLogout: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  chairman: 'CHAIRMAN',
  bureau_head: 'BUREAU HEAD',
  case_officer: 'CASE OFFICER',
  admin: 'ADMIN',
};

export function Shell({ user, onLogout }: ShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mainRef = useRef<HTMLDivElement>(null);

  const [openAlertCount, setOpenAlertCount] = useState<number>(0);
  const [pendingLinksCount, setPendingLinksCount] = useState<number>(0);
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');

  const canViewDashboard =
    user.permissions?.can_view_chairman_dashboard ||
    user.permissions?.can_view_bureau_dashboard;
  const canRegisterComplaint = Boolean(user.permissions?.can_register_complaint);
  const canResolveLinks = user.permissions?.can_resolve_link_queue !== 'none';

  useEffect(() => {
    setSearchText(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const fetchCounts = () => {
      api
        .getAlerts('open')
        .then((list) => {
          if (mounted) setOpenAlertCount(list.length);
        })
        .catch(() => {});

      api
        .getLinkQueue('pending')
        .then((list) => {
          if (mounted) setPendingLinksCount(list.length);
        })
        .catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 12000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [location.pathname, user.role]);

  // Page route transition
  useEffect(() => {
    const el = mainRef.current;
    if (!el || prefersReducedMotion()) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out', clearProps: 'transform' }
    );
  }, [location.pathname]);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchText.trim();
    if (trimmed) {
      navigate(`/complaints?q=${encodeURIComponent(trimmed)}`);
    } else if (location.pathname === '/complaints') {
      navigate('/complaints');
    }
  };

  const handleSignOut = () => {
    clearAuthSession();
    onLogout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const p = location.pathname;
    if (p === '/') {
      return user.role === 'bureau_head'
        ? 'Bureau Dashboard'
        : 'Chairman Dashboard';
    }
    if (p === '/complaints/new') return 'Register Complaint';
    if (p.startsWith('/complaints/')) return 'Complaint Dossier';
    if (p === '/complaints') {
      if (user.role === 'admin') return 'Complaints Registry (Metadata Only)';
      if (user.role === 'case_officer') return 'Complaints (Assigned First)';
      return 'Complaints Registry';
    }
    if (p === '/link-queue') return 'Institution-Link Queue';
    if (p.startsWith('/institutions/')) return 'Institution Risk Profile';
    if (p === '/institutions') return 'Institutions Directory';
    if (p === '/alerts') return 'Early Warning Alerts';
    if (p === '/docs') return 'Technical Documentation & PDF';
    return 'Lattice';
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '248px 1fr',
        minHeight: '100vh',
        backgroundColor: 'var(--paper)',
      }}
    >
      {/* Left Sidebar */}
      <aside
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          backgroundColor: 'var(--paper-2)',
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px 16px',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Brand Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 8px',
            }}
          >
            <LatticeMark size={28} />
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                  fontSize: 16,
                  letterSpacing: '-0.02em',
                  color: 'var(--ink)',
                  lineHeight: 1.1,
                }}
              >
                Lattice
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                  marginTop: 2,
                }}
              >
                AICTE Intelligence
              </div>
            </div>
          </div>

          {/* Primary Navigation */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {canViewDashboard && (
              <NavItem
                to="/"
                end
                icon={<LayoutGrid size={18} strokeWidth={1.6} />}
                label={
                  user.role === 'chairman'
                    ? 'Chairman Dashboard'
                    : 'Bureau Dashboard'
                }
              />
            )}
            <NavItem
              to="/complaints"
              icon={<FileText size={18} strokeWidth={1.6} />}
              label="Complaints"
            />
            <NavItem
              to="/link-queue"
              icon={<Link2 size={18} strokeWidth={1.6} />}
              label="Link Queue"
              badge={pendingLinksCount > 0 && canResolveLinks ? pendingLinksCount : undefined}
            />
            <NavItem
              to="/institutions"
              icon={<Building2 size={18} strokeWidth={1.6} />}
              label="Institutions"
            />
            <NavItem
              to="/alerts"
              icon={<Bell size={18} strokeWidth={1.6} />}
              label="Alerts"
              badge={openAlertCount > 0 ? openAlertCount : undefined}
            />
            <NavItem
              to="/docs"
              icon={<BookOpen size={18} strokeWidth={1.6} />}
              label="Technical Docs (PDF)"
            />
          </nav>

          {/* Role Permission Summary Box */}
          <div
            style={{
              margin: '0 4px',
              padding: '12px',
              borderRadius: 10,
              backgroundColor: 'var(--paper)',
              border: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={13} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
              <span className="micro-label" style={{ fontSize: 10, color: 'var(--ink)' }}>
                Active Role Scope
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>
              {user.role === 'chairman' &&
                'Full visibility across all cases. Status transitions restricted to Reopen Only.'}
              {user.role === 'bureau_head' &&
                'Bureau Dashboard, complaint intake, officer assignment, action notes, Section 5 status transitions & link queue.'}
              {user.role === 'case_officer' &&
                'Assigned cases sorted first. Action notes & Section 5 transitions enabled on assigned cases.'}
              {user.role === 'admin' &&
                'Metadata-only view (Section 3.1). Authorized for officer assignment & link queue resolution.'}
            </div>
          </div>
        </div>

        {/* User Footer Card */}
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 4,
                backgroundColor:
                  user.role === 'chairman'
                    ? 'var(--ink)'
                    : user.role === 'bureau_head'
                    ? 'rgba(184, 80, 30, 0.14)'
                    : user.role === 'case_officer'
                    ? '#EBF3FA'
                    : 'var(--paper-2)',
                color:
                  user.role === 'chairman'
                    ? 'var(--paper)'
                    : user.role === 'bureau_head'
                    ? 'var(--accent)'
                    : user.role === 'case_officer'
                    ? '#1F568B'
                    : 'var(--ink-2)',
              }}
            >
              {ROLE_LABELS[user.role]}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>
              {user.name}
            </div>
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              {user.email}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            data-cursor="link"
            style={{
              marginTop: 2,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid var(--line)',
              backgroundColor: 'var(--paper)',
              color: 'var(--ink-2)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <LogOut size={13} strokeWidth={1.6} />
            <span>Switch Role / Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header
          style={{
            height: 64,
            position: 'sticky',
            top: 0,
            zIndex: 15,
            backgroundColor: 'rgba(246, 244, 239, 0.88)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid var(--line)',
            padding: '0 40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                color: 'var(--ink)',
              }}
            >
              {getPageTitle()}
            </h1>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                backgroundColor: 'var(--paper-2)',
                border: '1px solid var(--line)',
                color: 'var(--ink-2)',
              }}
            >
              {ROLE_LABELS[user.role]}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <form
              onSubmit={handleGlobalSearch}
              style={{ position: 'relative', width: 280 }}
            >
              <Search
                size={15}
                strokeWidth={1.6}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-3)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="search"
                className="lattice-input"
                placeholder="Search complaints or institutions..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  height: 36,
                  paddingLeft: 34,
                  fontSize: 13,
                  backgroundColor: 'var(--surface)',
                }}
              />
            </form>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadTechnicalDocPdf('Lattice_AICTE_Technical_Documentation.pdf')}
              title="Download Technical Documentation as PDF"
            >
              <FileDown size={15} strokeWidth={1.8} />
              <span>Tech Doc PDF</span>
            </Button>

            {/* Register Complaint button: only Bureau Head and Case Officer */}
            {canRegisterComplaint && (
              <Button
                variant="primary"
                size="sm"
                magnetic
                onClick={() => navigate('/complaints/new')}
              >
                <Plus size={15} strokeWidth={1.8} />
                <span>Register Complaint</span>
              </Button>
            )}
          </div>
        </header>

        {/* Page Container */}
        <main
          ref={mainRef}
          style={{
            maxWidth: 1440,
            width: '100%',
            margin: '0 auto',
            padding: '32px 40px 64px 40px',
            flex: 1,
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  badge,
  end,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      data-cursor="link"
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: isActive ? 600 : 500,
        color: isActive ? 'var(--ink)' : 'var(--ink-2)',
        backgroundColor: isActive ? 'var(--surface)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        boxShadow: isActive ? '0 1px 2px rgba(20, 20, 19, 0.04)' : 'none',
        transition: 'background-color 0.15s ease, color 0.15s ease',
      })}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon}
        <span>{label}</span>
      </span>
      {badge !== undefined && (
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '1px 7px',
            borderRadius: 999,
            backgroundColor: 'var(--risk-critical-bg)',
            color: 'var(--risk-critical-text)',
          }}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}
