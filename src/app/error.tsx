'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log the error to an error reporting service if available
    console.error('ET Patrika Briefing Error:', error);
  }, [error]);

  return (
    <div className="error-container">
      <style>{`
        .error-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
          background: var(--color-bg);
        }
        .error-content {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 3rem 2rem;
          max-width: 480px;
          width: 100%;
          box-shadow: var(--shadow-sm);
        }
        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .error-title {
          font-family: var(--font-headline);
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-ink);
          margin-bottom: 0.75rem;
        }
        .error-desc {
          font-size: 0.95rem;
          color: var(--color-ink-muted);
          margin-bottom: 2rem;
          line-height: 1.5;
        }
        .error-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 1.5rem;
        }
        .btn-try {
          padding: 0.625rem 1.5rem;
          background: var(--color-ink);
          color: white;
          border-radius: var(--radius-full);
          font-weight: 600;
          font-size: 0.9rem;
          border: none;
          cursor: pointer;
        }
        .btn-home {
          padding: 0.625rem 1.5rem;
          background: transparent;
          color: var(--color-ink-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          font-weight: 600;
          font-size: 0.9rem;
          text-decoration: none;
        }
        .details-toggle {
          background: none;
          border: none;
          color: var(--color-ink-subtle);
          font-size: 0.8rem;
          cursor: pointer;
          text-decoration: underline;
        }
        .error-details {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--color-surface-muted);
          border-radius: var(--radius-sm);
          font-family: monospace;
          font-size: 0.75rem;
          text-align: left;
          color: var(--color-negative);
          overflow-x: auto;
        }
      `}</style>

      <div className="error-content animate-fade-in">
        <div className="error-icon">⚠️</div>
        <h1 className="error-title">Something went wrong with your briefing</h1>
        <p className="error-desc">
          We encountered an unexpected issue while retrieving your personalized intelligence timeline.
        </p>

        <div className="error-actions">
          <Link href="/dashboard" className="btn-home">
            Return to Feed
          </Link>
          <button onClick={() => reset()} className="btn-try">
            Try again
          </button>
        </div>

        <button 
          className="details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide details' : 'Show technical details'}
        </button>

        {showDetails && (
          <div className="error-details">
            {error.message || 'Unknown error occurred.'}
            {error.digest && <div>Digest: {error.digest}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
