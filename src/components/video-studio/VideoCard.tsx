'use client';

import React from 'react';

export interface VideoArticlePreview {
  id: string;
  title: string;
  source: string;
  category: string;
  published_at?: string;
  credibility_score?: number;
  story_momentum?: string;
  eli5?: string;
}

export interface VideoJobCardStatus {
  status: string;
  progress_percent: number;
  current_step: string;
  video_url?: string;
  error?: string;
  role?: string;
  duration_seconds?: number;
}

interface VideoCardProps {
  article: VideoArticlePreview;
  currentRole: string;
  onGenerateClick: (articleId: string, role: string) => void;
  jobStatus?: VideoJobCardStatus;
  onWatchClick?: (videoUrl: string, articleTitle: string, role: string, articleId: string, durationSeconds?: number) => void;
  disabled?: boolean;
}

const MOMENTUM_COLORS: Record<string, { bg: string; text: string }> = {
  emerging: { bg: '#FEF3C7', text: '#B45309' },
  building: { bg: '#FFEDD5', text: '#C2410C' },
  peak: { bg: '#FEE2E2', text: '#B91C1C' },
  resolving: { bg: '#DCFCE7', text: '#166534' },
};

function formatPublishedAt(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function VideoCard({
  article,
  currentRole,
  onGenerateClick,
  jobStatus,
  onWatchClick,
  disabled = false,
}: VideoCardProps) {
  const momentumKey = (article.story_momentum || 'emerging').toLowerCase();
  const momentumStyle = MOMENTUM_COLORS[momentumKey] || MOMENTUM_COLORS.emerging;
  const credibility = Math.round((article.credibility_score || 0.5) * 100);
  const isGenerating = Boolean(jobStatus && !['done', 'failed'].includes(jobStatus.status));
  const isDone = jobStatus?.status === 'done' && Boolean(jobStatus.video_url);
  const isFailed = jobStatus?.status === 'failed';
  const roleLabel = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);

  return (
    <article className="vs-card">
      <style>{`
        .vs-card {
          position: relative;
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }

        .vs-ready-badge {
          position: absolute;
          top: 1rem;
          right: 1rem;
          font-size: 0.72rem;
          font-weight: 700;
          background: #DCFCE7;
          color: #166534;
          border: 1px solid #86EFAC;
          border-radius: var(--radius-full);
          padding: 0.2rem 0.55rem;
        }

        .vs-meta {
          display: flex;
          gap: 0.45rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 0.65rem;
          color: var(--color-ink-muted);
          font-size: 0.78rem;
        }

        .vs-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-ink-subtle);
        }

        .vs-title {
          font-family: var(--font-headline);
          font-size: 1.08rem;
          font-weight: 700;
          line-height: 1.35;
          color: var(--color-ink);
          margin-bottom: 0.7rem;
          padding-right: 6rem;
        }

        .vs-desc {
          font-size: 0.86rem;
          color: var(--color-ink-muted);
          line-height: 1.5;
          margin-bottom: 0.9rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .vs-badges {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.9rem;
          flex-wrap: wrap;
        }

        .vs-badge {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.2rem 0.55rem;
          border-radius: var(--radius-full);
        }

        .vs-progress {
          margin-bottom: 0.9rem;
        }

        .vs-progress-track {
          width: 100%;
          height: 7px;
          border-radius: var(--radius-full);
          background: #FEE2E2;
          overflow: hidden;
          margin-bottom: 0.4rem;
        }

        .vs-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #E8132B, #FF7A00);
          transition: width 0.35s ease;
        }

        .vs-progress-text {
          font-size: 0.76rem;
          color: var(--color-ink-muted);
        }

        .vs-error {
          margin-bottom: 0.9rem;
          font-size: 0.8rem;
          color: #B91C1C;
          background: #FEE2E2;
          border: 1px solid #FECACA;
          border-radius: var(--radius-md);
          padding: 0.5rem 0.6rem;
        }

        .vs-btn {
          width: 100%;
          border: none;
          border-radius: var(--radius-md);
          padding: 0.68rem 0.85rem;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .vs-btn:hover:not(:disabled) {
          opacity: 0.92;
        }

        .vs-btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
      `}</style>

      {isDone && <span className="vs-ready-badge">Video Ready</span>}

      <div className="vs-meta">
        <span>{article.source}</span>
        <span className="vs-dot" />
        <span>{article.category}</span>
        <span className="vs-dot" />
        <span>{formatPublishedAt(article.published_at)}</span>
      </div>

      <h3 className="vs-title">{article.title}</h3>

      {article.eli5 && <p className="vs-desc">{article.eli5}</p>}

      <div className="vs-badges">
        <span className="vs-badge" style={{ background: '#F3F4F6', color: '#111827' }}>🛡️ {credibility}%</span>
        <span className="vs-badge" style={{ background: momentumStyle.bg, color: momentumStyle.text }}>
          {momentumKey.charAt(0).toUpperCase() + momentumKey.slice(1)}
        </span>
      </div>

      {isGenerating && (
        <div className="vs-progress">
          <div className="vs-progress-track">
            <div className="vs-progress-fill" style={{ width: `${jobStatus?.progress_percent || 0}%` }} />
          </div>
          <div className="vs-progress-text">{jobStatus?.current_step || 'Generating video...'}</div>
        </div>
      )}

      {isFailed && (
        <div className="vs-error">
          {jobStatus?.error || 'Video generation failed. Please retry.'}
        </div>
      )}

      {isDone ? (
        <button
          type="button"
          className="vs-btn"
          style={{ background: '#111827', color: 'white' }}
          onClick={() => {
            const videoUrl = jobStatus?.video_url;
            if (videoUrl && onWatchClick) {
              onWatchClick(videoUrl, article.title, (jobStatus?.role || currentRole), article.id, jobStatus?.duration_seconds);
            }
          }}
        >
          ▶ Watch Video
        </button>
      ) : (
        <button
          type="button"
          className="vs-btn"
          style={{ background: '#E8132B', color: 'white' }}
          disabled={disabled || isGenerating}
          title={disabled ? 'Start the video studio backend first' : undefined}
          onClick={() => onGenerateClick(article.id, currentRole)}
        >
          {isFailed ? `Retry Video for ${roleLabel}` : `Generate Video for ${roleLabel}`}
        </button>
      )}
    </article>
  );
}
