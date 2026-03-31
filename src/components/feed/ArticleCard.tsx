'use client';

import React from 'react';
import Link from 'next/link';
import type { FeedItem, UserRole } from '@/types';
import RelevanceBar from './RelevanceBar';

const ROLE_COLORS: Record<UserRole, string> = {
  student: '#2563EB',
  investor: '#059669',
  founder: '#7C3AED',
  citizen: '#D97706',
};

const CATEGORY_DOTS: Record<string, string> = {
  Startups: '#E8132B',
  Policy: '#7C3AED',
  Markets: '#059669',
  Tech: '#2563EB',
  Global: '#D97706',
  Finance: '#059669',
  Science: '#0891B2',
  Health: '#DC2626',
  Education: '#7C3AED',
  default: '#6B7280',
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
  if (value >= 0.7) return { label: 'High Conflict', color: '#DC2626' };
  if (value >= 0.4) return { label: 'Moderate Conflict', color: '#D97706' };
  return { label: 'Low Conflict', color: '#059669' };
}

interface ArticleCardProps {
  item: FeedItem;
  role: UserRole;
  translatedEli5?: string;
  translatedWhyItMatters?: string;
  translationLanguage?: 'en' | 'hi' | 'ta' | 'bn' | 'te';
  isTranslating?: boolean;
}

export default function ArticleCard({
  item,
  role,
  translatedEli5,
  translatedWhyItMatters,
  translationLanguage = 'en',
  isTranslating = false,
}: ArticleCardProps) {
  const { article, context } = item;
  const dotColor = CATEGORY_DOTS[article.category] || CATEGORY_DOTS.default;
  const roleColor = ROLE_COLORS[role];
  const actionChips = (context.action_cards || []).slice(0, 2);
  const credibility = Math.round((article.credibility_score || 0.5) * 100);
  const displayEli5 = translatedEli5 || article.eli5;
  const displayWhyItMatters = translatedWhyItMatters || context.why_it_matters;
  const splitLabel = formatSplitLabel(article.bharat_india_split);
  const conflict = typeof article.conflict_index === 'number' ? article.conflict_index : null;
  const conflictChip = conflictTone(conflict);

  const LANGUAGE_BADGES: Record<'hi' | 'ta' | 'bn' | 'te', string> = {
    hi: 'हि',
    ta: 'த',
    bn: 'বা',
    te: 'తె',
  };

  return (
    <Link href={`/briefing/${article.id}`} className="article-card-link">
      <style>{`
        .article-card-link {
          text-decoration: none;
          color: inherit;
          display: block;
        }

        .article-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }

        .article-card:hover {
          border-color: var(--color-border);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .card-meta {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          margin-bottom: 0.875rem;
          font-size: 0.8rem;
          color: var(--color-ink-muted);
        }

        .card-source {
          font-weight: 600;
          color: var(--color-ink-secondary);
        }

        .card-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-ink-subtle);
        }

        .category-indicator {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.125rem 0.5rem;
          background: var(--color-surface-muted);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 500;
        }

        .branch-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.125rem 0.5rem;
          border-radius: var(--radius-full);
          font-size: 0.72rem;
          font-weight: 600;
          border: 1px solid var(--color-border-subtle);
          background: var(--color-surface-muted);
          color: var(--color-ink-secondary);
        }

        .category-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .card-headline {
          font-family: var(--font-headline);
          font-size: 1.2rem;
          font-weight: 700;
          line-height: 1.35;
          color: var(--color-ink);
          margin-bottom: 0.625rem;
          letter-spacing: -0.01em;
        }

        .card-eli5 {
          font-size: 0.88rem;
          color: var(--color-ink-muted);
          line-height: 1.5;
          margin-bottom: 0.625rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .language-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 20px;
          padding: 0 0.4rem;
          border-radius: var(--radius-full);
          background: #fef2f2;
          color: var(--color-brand);
          border: 1px solid #fecaca;
          font-size: 0.72rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .card-wim {
          font-size: 0.82rem;
          color: var(--color-ink-secondary);
          margin-bottom: 1rem;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .card-wim-label {
          font-weight: 700;
          color: var(--color-ink);
        }

        .translation-loading {
          font-size: 0.78rem;
          color: var(--color-ink-subtle);
          margin-bottom: 0.5rem;
        }

        .card-relevance {
          margin-bottom: 1rem;
        }

        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .card-chips {
          display: flex;
          gap: 0.375rem;
          flex-wrap: wrap;
          flex: 1;
        }

        .action-chip {
          padding: 0.25rem 0.625rem;
          border-radius: var(--radius-full);
          background: color-mix(in srgb, var(--color-surface) 85%, white 15%);
          border: 1px solid;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-ink-secondary);
          white-space: nowrap;
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-cta {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--color-brand);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .credibility-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.72rem;
          color: var(--color-ink-subtle);
          margin-left: auto;
        }

        @media (max-width: 640px) {
          .article-card {
            padding: 1.125rem 1rem;
          }
        }
      `}</style>

      <article className="article-card">
        <div className="card-meta">
          <span className="card-source">{article.source}</span>
          <span className="card-dot" />
          <span>{timeAgo(article.published_at)}</span>
          <span className="card-dot" />
          <span className="category-indicator">
            <span className="category-dot" style={{ background: dotColor }} />
            {article.category}
          </span>
          <span className="branch-chip" title="Bharat/India split">
            {splitLabel}
          </span>
          <span
            className="branch-chip"
            style={{ borderColor: conflictChip.color, color: conflictChip.color }}
            title="Conflict index"
          >
            {conflictChip.label}{conflict !== null ? ` ${Math.round(conflict * 100)}%` : ''}
          </span>
          <span className="credibility-badge">
            🛡️ {credibility}%
          </span>
        </div>

        <h3 className="card-headline">{context.headline || article.title}</h3>

        {translationLanguage !== 'en' && translatedEli5 && LANGUAGE_BADGES[translationLanguage as 'hi' | 'ta' | 'bn' | 'te'] && (
          <span className="language-pill">{LANGUAGE_BADGES[translationLanguage as 'hi' | 'ta' | 'bn' | 'te']}</span>
        )}

        {isTranslating && (
          <p className="translation-loading">Translating for your language...</p>
        )}

        {displayEli5 && (
          <p className="card-eli5">{displayEli5}</p>
        )}

        {displayWhyItMatters && (
          <p className="card-wim">
            <span className="card-wim-label">Why it matters:</span> {displayWhyItMatters}
          </p>
        )}

        <div className="card-relevance">
          <RelevanceBar score={context.relevance_score || 0.5} role={role} />
        </div>

        <div className="card-footer">
          <div className="card-chips">
            {actionChips.map((chip, i) => (
              <span
                key={i}
                className="action-chip"
                style={{ borderColor: roleColor, color: roleColor }}
              >
                {typeof chip === 'string' ? chip : chip.title}
              </span>
            ))}
          </div>
          <span className="card-cta">
            Read Briefing →
          </span>
        </div>
      </article>
    </Link>
  );
}
