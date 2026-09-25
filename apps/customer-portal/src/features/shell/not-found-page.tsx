import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="not-found-page" data-testid="not-found-page" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
      <div className="not-found-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '3rem', margin: '0 0 1rem', color: 'var(--color-primary, #1e3a8a)' }}>404</h1>
        <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem' }}>Page Not Found</h2>
        <p style={{ color: 'var(--color-text-muted, #64748b)', marginBottom: '2rem' }}>
          The requested page or banking resource could not be found. Please check the URL or return to your account overview.
        </p>
        <Link
          to="/"
          className="btn btn--primary"
          data-testid="not-found-back-btn"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            background: 'var(--color-primary, #1e3a8a)',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '0.375rem',
            fontWeight: 500,
          }}
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};
