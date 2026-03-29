import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="notfound-container">
      <style>{`
        .notfound-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
          background: var(--color-bg);
        }
        .nf-code {
          font-family: var(--font-headline);
          font-size: 5rem;
          font-weight: 800;
          color: var(--color-border);
          line-height: 1;
          margin-bottom: 0.5rem;
        }
        .nf-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-ink);
          margin-bottom: 0.75rem;
        }
        .nf-desc {
          font-size: 1rem;
          color: var(--color-ink-muted);
          margin-bottom: 2rem;
          max-width: 400px;
        }
        .btn-home {
          padding: 0.75rem 1.75rem;
          background: var(--color-ink);
          color: white;
          border-radius: var(--radius-full);
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 0.95rem;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn-home:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
      
      <div className="nf-code animate-slide-up">404</div>
      <h1 className="nf-title animate-fade-in stagger-1">This briefing doesn&apos;t exist</h1>
      <p className="nf-desc animate-fade-in stagger-2">
        The intelligence report or story you&apos;re looking for has been archived, moved, or never existed.
      </p>
      
      <div className="animate-fade-in stagger-3">
        <Link href="/dashboard" className="btn-home">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
