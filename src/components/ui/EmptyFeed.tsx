import React from 'react';
import Link from 'next/link';

export default function EmptyFeed() {
  return (
    <div className="empty-feed-container">
      <style>{`
        .empty-feed-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          text-align: center;
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-lg);
          margin-bottom: 1.5rem;
        }

        .pulse-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--color-brand-glow);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
          animation: pulse-glow 2s infinite ease-in-out;
        }

        .pulse-inner {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--color-brand);
        }

        .empty-title {
          font-family: var(--font-headline);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-ink);
          margin-bottom: 0.5rem;
        }

        .empty-desc {
          font-size: 0.95rem;
          color: var(--color-ink-muted);
          max-width: 320px;
          margin-bottom: 2rem;
          line-height: 1.5;
        }

        .empty-cta {
          display: inline-flex;
          align-items: center;
          padding: 0.625rem 1.5rem;
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-ink-secondary);
          text-decoration: none;
          transition: all 0.2s;
        }

        .empty-cta:hover {
          border-color: var(--color-ink-subtle);
          background: var(--color-surface);
        }
      `}</style>
      
      <div className="pulse-icon">
        <div className="pulse-inner" />
      </div>
      
      <h3 className="empty-title">Your briefing is being prepared</h3>
      <p className="empty-desc">
        We&apos;re currently analyzing and synthesizing the most relevant stories for your role. Check back in a few minutes.
      </p>
      
      <Link href="/dashboard" className="empty-cta">
        Explore trending topics →
      </Link>
    </div>
  );
}
