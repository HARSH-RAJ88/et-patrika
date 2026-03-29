import React from 'react';

export default function ArticleCardSkeleton() {
  return (
    <div className="article-card-skeleton">
      <style>{`
        .article-card-skeleton {
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
        }
        .sk-meta { display: flex; gap: 0.625rem; margin-bottom: 0.875rem; align-items: center; }
        .sk-source { width: 80px; height: 16px; border-radius: var(--radius-sm); }
        .sk-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--color-border); }
        .sk-time { width: 40px; height: 16px; border-radius: var(--radius-sm); }
        .sk-category { width: 70px; height: 20px; border-radius: var(--radius-full); }
        .sk-title { width: 90%; height: 24px; border-radius: var(--radius-sm); margin-bottom: 0.5rem; }
        .sk-title-2 { width: 60%; height: 24px; border-radius: var(--radius-sm); margin-bottom: 1rem; }
        .sk-bar { width: 100%; height: 6px; border-radius: var(--radius-full); margin-bottom: 1rem; }
        .sk-footer { display: flex; gap: 0.5rem; align-items: center; }
        .sk-chip { width: 80px; height: 24px; border-radius: var(--radius-full); }
      `}</style>

      <div className="sk-meta">
        <div className="sk-source skeleton-shimmer" />
        <div className="sk-dot" />
        <div className="sk-time skeleton-shimmer" />
        <div className="sk-dot" />
        <div className="sk-category skeleton-shimmer" />
      </div>

      <div className="sk-title skeleton-shimmer" />
      <div className="sk-title-2 skeleton-shimmer" />

      <div className="sk-bar skeleton-shimmer" />

      <div className="sk-footer">
        <div className="sk-chip skeleton-shimmer" />
        <div className="sk-chip skeleton-shimmer" />
      </div>
    </div>
  );
}
