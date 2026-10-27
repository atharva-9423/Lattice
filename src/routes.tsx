import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { getDefaultHomePath } from './api/client';
import type { UserInfo } from './api/types';
import { Shell } from './components/Shell';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Complaints } from './pages/Complaints';
import { ComplaintDetail } from './pages/ComplaintDetail';
import { NewComplaint } from './pages/NewComplaint';
import { LinkQueue } from './pages/LinkQueue';
import { Institutions } from './pages/Institutions';
import { InstitutionDetail } from './pages/InstitutionDetail';
import { Alerts } from './pages/Alerts';
import { TechnicalDocs } from './pages/TechnicalDocs';
import { NotFound } from './pages/NotFound';

export function AppRoutes({
  user,
  onLogin,
  onLogout,
}: {
  user: UserInfo | null;
  onLogin: (u: UserInfo) => void;
  onLogout: () => void;
}) {
  const defaultPath = getDefaultHomePath(user);
  const canViewDashboard =
    user?.permissions?.can_view_chairman_dashboard ||
    user?.permissions?.can_view_bureau_dashboard;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={defaultPath} replace /> : <Login onLogin={onLogin} />}
      />
      <Route
        path="/docs-public"
        element={<TechnicalDocs />}
      />
      <Route
        path="/"
        element={
          user ? <Shell user={user} onLogout={onLogout} /> : <Navigate to="/login" replace />
        }
      >
        <Route
          index
          element={
            canViewDashboard ? <Overview /> : <Navigate to="/complaints" replace />
          }
        />
        <Route path="complaints" element={<Complaints />} />
        <Route path="complaints/new" element={<NewComplaint />} />
        <Route path="complaints/:id" element={<ComplaintDetail />} />
        <Route path="link-queue" element={<LinkQueue />} />
        <Route path="institutions" element={<Institutions />} />
        <Route path="institutions/:id" element={<InstitutionDetail />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="docs" element={<TechnicalDocs />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
