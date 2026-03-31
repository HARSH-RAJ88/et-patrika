'use client';

import React from 'react';
import Link from 'next/link';
import type { FeedItem, UserRole } from '@/types';
import RelevanceBar from './RelevanceBar';

const SENTIMENT_ICONS: Record<string, string> = {
  positive: '🟢',
  neutral: '🔵',
  negative: '🔴',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatSplitLabel(split?: string | null): string {
  switch (split) {
    case 'india_only':
      return 'India Focus';
    case 'bharat_only':
      return 'Bharat Focus';
    case 'both':
      return 'Bharat + India';
    case 'global':
      return 'Global Context';
    default:
      return 'Unlabeled';
  }
}

function conflictTone(conflict?: number | null): { label: string; color: string } {
  const value = typeof conflict === 'number' ? conflict : 0;
  if (value >= 0.7) return { label: 'High Conflict', color: '#FCA5A5' };
  if (value >= 0.4) return { label: 'Moderate Conflict', color: '#FCD34D' };
  return { label: 'Low Conflict', color: '#86EFAC' };
}

interface FeaturedCardProps {
  item: FeedItem;
  role: UserRole;
  translatedEli5?: string;
}

export default function FeaturedCard({ item, role, translatedEli5 }: FeaturedCardProps) {
  const { article, context } = item;
  const credibility = Math.round((article.credibility_score || 0.5) * 100);
  const actionChips = (context.action_cards || []).slice(0, 3);
  const sentimentIcon = SENTIMENT_ICONS[article.sentiment] || SENTIMENT_ICONS.neutral;
  const splitLabel = formatSplitLabel(article.bharat_india_split);
  const conflict = typeof article.conflict_index === 'number' ? article.conflict_index : null;
  const conflictChip = conflictTone(conflict);

  return (
    <Link href={`/briefing/${article.id}`} className="featured-link">
      <style>{`
        .featured-link {
          text-decoration: none;
          color: inherit;
          display: block;
        }

        .featured-card {
          position: relative;
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-xl);
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }

        .featured-card:hover {
          border-color: var(--color-border);
          box-shadow: var(--shadow-lg);
          transform: translateY(-3px);
        }

        .featured-accent {
          height: 4px;
          background: var(--gradient-brand);
        }

        .featured-body {
          padding: 2rem 2rem 1.75rem;
        }

        .featured-badge-row {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .featured-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.25rem 0.75rem;
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 600;
          background: var(--color-brand);
          color: white;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .featured-source {
          font-size: 0.82rem;
          color: var(--color-ink-muted);
          font-weight: 500;
        }

        .featured-time {
          font-size: 0.82rem;
          color: var(--color-ink-subtle);
        }

        .featured-credibility {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.78rem;
          color: var(--color-ink-muted);
          padding: 0.2rem 0.6rem;
          background: var(--color-surface-muted);
          border-radius: var(--radius-full);
        }

        .featured-branch-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.2rem 0.6rem;
          border-radius: var(--radius-full);
          border: 1px solid rgba(255, 255, 255, 0.35);
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }

        .featured-headline {
          font-family: var(--font-headline);
          font-size: 1.75rem;
          font-weight: 700;
          line-height: 1.25;
          color: var(--color-ink);
          margin-bottom: 0.75rem;
          letter-spacing: -0.02em;
        }

        .featured-excerpt {
          font-size: 1rem;
          color: var(--color-ink-muted);
          line-height: 1.6;
          margin-bottom: 1.5rem;
          max-width: 720px;
        }

        .featured-relevance {
          margin-bottom: 1.5rem;
          max-width: 400px;
        }

        .featured-footer {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .featured-chip {
          padding: 0.375rem 0.875rem;
          border-radius: var(--radius-full);
          background: var(--color-surface-muted);
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--color-ink-secondary);
          transition: all 0.15s ease;
        }

        .featured-card:hover .featured-chip {
          background: var(--color-brand-light);
          color: var(--color-brand);
        }

        .featured-cta {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1.25rem;
          background: var(--gradient-brand);
          color: white;
          border-radius: var(--radius-full);
          font-size: 0.88rem;
          font-weight: 600;
          transition: all 0.2s ease;
          box-shadow: var(--shadow-brand);
        }

        .featured-card:hover .featured-cta {
          box-shadow: 0 6px 24px rgba(232, 19, 43, 0.3);
        }

        @media (max-width: 768px) {
          .featured-body { padding: 1.5rem; }
          .featured-headline { font-size: 1.35rem; }
          .featured-footer { gap: 0.5rem; }
          .featured-cta { margin-left: 0; margin-top: 0.5rem; }
        }
      `}</style>

      <article className="featured-card">
        <div className="featured-accent" />
        <div className="featured-body">
          <div className="featured-badge-row">
            <span className="featured-badge">
              ✦ Top Story
            </span>
            <span className="featured-source">{article.source}</span>
            <span className="featured-time">{timeAgo(article.published_at)}</span>
            <span style={{ fontSize: '0.8rem' }}>{sentimentIcon}</span>
            <span className="featured-branch-chip" title="Bharat/India split">
              {splitLabel}
            </span>
            <span
              className="featured-branch-chip"
              style={{ borderColor: conflictChip.color, color: conflictChip.color }}
              title="Conflict index"
            >
              {conflictChip.label}{conflict !== null ? ` ${Math.round(conflict * 100)}%` : ''}
            </span>
            <span className="featured-credibility">
              🛡️ {credibility}% reliable
            </span>
          </div>

          <h2 className="featured-headline">{context.headline || article.title}</h2>

          {(translatedEli5 || article.eli5) && (
            <p className="featured-excerpt">{translatedEli5 || article.eli5}</p>
          )}

          <div className="featured-relevance">
            <RelevanceBar score={context.relevance_score || 0.5} role={role} />
          </div>

          <div className="featured-footer">
            {actionChips.map((chip, i) => (
              <span key={i} className="featured-chip">
                {typeof chip === 'string' ? chip : chip.title}
              </span>
            ))}
            <span className="featured-cta">
              Read Full Briefing →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
