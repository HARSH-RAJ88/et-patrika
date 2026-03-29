import React from 'react';

export default function BriefingPageSkeleton() {
  return (
    <div className="briefing-skeleton-layout">
      <style>{`
        .briefing-skeleton-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 2rem;
          max-width: 1280px;
          margin: 0 auto;
          padding: 2rem;
        }
        @media (max-width: 1024px) {
          .briefing-skeleton-layout {
            grid-template-columns: 1fr;
            padding: 1.5rem;
          }
        }
        .sk-main { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; }
        .sk-sidebar { display: flex; flex-direction: column; gap: 1.25rem; }
        .sk-block { background: var(--color-surface); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); padding: 2rem; }
        .sk-h1 { width: 60%; height: 36px; border-radius: var(--radius-sm); margin-bottom: 2rem; }
        .sk-p { width: 100%; height: 16px; border-radius: var(--radius-sm); margin-bottom: 0.75rem; }
        .sk-p-short { width: 85%; height: 16px; border-radius: var(--radius-sm); margin-bottom: 1.5rem; }
        .sk-side-card { background: var(--color-surface); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; }
        .sk-side-title { width: 50%; height: 20px; border-radius: var(--radius-sm); margin-bottom: 1.5rem; }
        .sk-stat { width: 100%; height: 12px; border-radius: var(--radius-sm); margin-bottom: 0.75rem; }
      `}</style>
      
      <main className="sk-main">
        <div className="sk-block">
          <div className="sk-h1 skeleton-shimmer" />
          <div className="sk-p skeleton-shimmer" />
          <div className="sk-p skeleton-shimmer" />
          <div className="sk-p-short skeleton-shimmer" />
          <div className="sk-p skeleton-shimmer" />
          <div className="sk-p-short skeleton-shimmer" />
        </div>
        <div className="sk-block">
          <div className="sk-p skeleton-shimmer" />
          <div className="sk-p-short skeleton-shimmer" />
        </div>
      </main>

      <aside className="sk-sidebar">
        <div className="sk-side-card" style={{ padding: '2.5rem 1.5rem' }}>
          <div className="sk-side-title skeleton-shimmer" style={{ margin: '0 0 1rem 0' }} />
          <div className="sk-stat skeleton-shimmer" style={{ height: '32px' }} />
        </div>
        <div className="sk-side-card">
          <div className="sk-side-title skeleton-shimmer" />
          <div className="sk-stat skeleton-shimmer" />
          <div className="sk-stat skeleton-shimmer" />
          <div className="sk-stat skeleton-shimmer" />
          <div className="sk-stat skeleton-shimmer" />
        </div>
        <div className="sk-side-card">
          <div className="sk-side-title skeleton-shimmer" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
             <div className="sk-stat skeleton-shimmer" style={{ height: '32px' }} />
             <div className="sk-stat skeleton-shimmer" style={{ height: '32px' }} />
          </div>
        </div>
      </aside>
    </div>
  );
}
