import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { NotFoundIllustration } from '../components/Illustration';
import { Button } from '../components/Button';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 18,
        padding: 32,
      }}
    >
      <NotFoundIllustration />
      <div className="micro-label" style={{ color: 'var(--accent)' }}>
        Error 404
      </div>
      <h1 className="page-title">Record or route not found</h1>
      <p style={{ margin: 0, maxWidth: 420, color: 'var(--ink-2)', fontSize: 15 }}>
        The complaint dossier or institutional route you requested does not exist in the registry.
      </p>
      <div style={{ marginTop: 8 }}>
        <Button variant="primary" magnetic onClick={() => navigate('/')}>
          <ArrowLeft size={16} strokeWidth={1.8} />
          <span>Back to Command Center</span>
        </Button>
      </div>
    </div>
  );
}
