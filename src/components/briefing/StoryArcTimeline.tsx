'use client';

import React, { useState, useMemo } from 'react';
import type { StoryArc, TimelineEvent, KeyPlayer } from '@/types';

/* ─── Sentiment Config ────────────────────────────────────────── */

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#059669',
  neutral: '#6B7280',
  negative: '#DC2626',
  escalating: '#D97706',
  resolving: '#2563EB',
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: '🟢',
  neutral: '⚪',
  negative: '🔴',
  escalating: '🟠',
  resolving: '🔵',
};

/* ─── Props ───────────────────────────────────────────────────── */

interface StoryArcTimelineProps {
  storyArc: StoryArc;
  currentArticleId: string;
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysBetween(start: string, end: string): number {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getSentimentTrend(events: TimelineEvent[]): { label: string; icon: string; color: string } {
  if (events.length < 2) return { label: 'Emerging', icon: '◆', color: '#6B7280' };

  const recent = events.slice(-3);
  const scores: Record<string, number> = {
    positive: 2,
    resolving: 1,
    neutral: 0,
    escalating: -1,
    negative: -2,
  };

  const avg = recent.reduce((sum, e) => sum + (scores[e.sentiment] ?? 0), 0) / recent.length;

  if (avg > 0.5) return { label: 'Improving', icon: '↗', color: '#059669' };
  if (avg < -0.5) return { label: 'Worsening', icon: '↘', color: '#DC2626' };
  return { label: 'Stable', icon: '→', color: '#D97706' };
}

/* ─── Key Player Chip ─────────────────────────────────────────── */

function PlayerChip({ player }: { player: KeyPlayer }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const initials = player.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="kp-chip-wrap"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="kp-chip">
        <div className="kp-avatar">{initials}</div>
        <div className="kp-details">
          <span className="kp-name">{player.name}</span>
          <span className="kp-role-label">{player.role}</span>
        </div>
      </div>
      {showTooltip && (
        <div className="kp-tooltip">
          <strong>{player.name}</strong>
          <br />
          {player.role}
          {player.relevance && (
            <>
              <br />
              <span style={{ opacity: 0.7 }}>Relevance: {player.relevance}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */

export default function StoryArcTimeline({ storyArc, currentArticleId }: StoryArcTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse timeline and key_players safely
  let timeline: TimelineEvent[] = storyArc.timeline || [];
  if (typeof timeline === 'string') {
    try { timeline = JSON.parse(timeline); } catch { timeline = []; }
  }

  let keyPlayers: KeyPlayer[] = storyArc.key_players || [];
  if (typeof keyPlayers === 'string') {
    try { keyPlayers = JSON.parse(keyPlayers); } catch { keyPlayers = []; }
  }

  // Sort chronologically
  const sorted = useMemo(
    () => [...timeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [timeline]
  );

  if (sorted.length === 0) return null;

  // Stats
  const trackedDays = daysBetween(sorted[0].date, sorted[sorted.length - 1].date);
  const trend = getSentimentTrend(sorted);

  // Collapse logic: show first 3 + last 2 if > 6 events
  const shouldCollapse = sorted.length > 6 && !isExpanded;
  const displayEvents = shouldCollapse
    ? [...sorted.slice(0, 3), null as unknown as TimelineEvent, ...sorted.slice(-2)]
    : sorted;

  return (
    <section className="sat-section">
      <style>{`
        .sat-section {
          margin-bottom: 2.5rem;
        }

        /* ─── Section Header ─── */
        .sat-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-brand);
          margin-bottom: 0.375rem;
        }

        .sat-header-line {
          flex: 1;
          height: 1px;
          background: var(--color-border);
        }

        .sat-arc-name {
          font-family: var(--font-headline);
          font-size: 1.2rem;
          color: var(--color-ink);
          margin-bottom: 1rem;
        }

        /* ─── Stats Bar ─── */
        .sat-stats {
          display: flex;
          gap: 1.5rem;
          padding: 0.875rem 1.25rem;
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-md);
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .sat-stat {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.82rem;
          color: var(--color-ink-muted);
        }

        .sat-stat-value {
          font-weight: 700;
          color: var(--color-ink);
        }

        .sat-stat-trend {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-full);
          font-weight: 700;
          font-size: 0.78rem;
        }

        /* ─── Desktop Horizontal Timeline ─── */
        .sat-scroll {
          overflow-x: auto;
          padding: 1rem 0 0.5rem;
          scrollbar-width: thin;
          scrollbar-color: var(--color-border) transparent;
        }

        .sat-scroll::-webkit-scrollbar { height: 4px; }
        .sat-scroll::-webkit-scrollbar-track { background: transparent; }
        .sat-scroll::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }

        .sat-track {
          display: flex;
          align-items: center;
          position: relative;
          min-width: max-content;
          padding: 80px 1rem;
        }

        /* Central rail */
        .sat-track::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--color-border);
          transform: translateY(-50%);
        }

        /* ─── Event Node ─── */
        .sat-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          min-width: 180px;
          max-width: 200px;
          z-index: 1;
        }

        /* Connector line */
        .sat-connector {
          width: 2px;
          background: var(--color-border);
          transition: background 0.2s ease;
        }

        .sat-connector-up {
          height: 30px;
        }

        .sat-connector-down {
          height: 30px;
        }

        /* Dot */
        .sat-dot-wrap {
          position: relative;
          z-index: 2;
        }

        .sat-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 3px solid var(--color-bg);
          box-shadow: 0 0 0 2px var(--color-border-subtle);
          transition: all 0.25s ease;
          cursor: pointer;
        }

        .sat-dot:hover {
          transform: scale(1.2);
        }

        .sat-dot-current {
          width: 22px;
          height: 22px;
          box-shadow: 0 0 0 3px var(--color-brand-light), 0 0 12px rgba(232, 19, 43, 0.25);
          animation: pulse-glow 2.5s ease-in-out infinite;
        }

        .sat-you-badge {
          position: absolute;
          top: -22px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.6rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-brand);
          white-space: nowrap;
          background: var(--color-brand-light);
          padding: 1px 6px;
          border-radius: var(--radius-full);
        }

        .sat-first-badge,
        .sat-last-badge {
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.62rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-ink-subtle);
          white-space: nowrap;
        }

        /* ─── Event Card ─── */
        .sat-card {
          padding: 0.625rem 0.75rem;
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-md);
          text-align: center;
          max-width: 180px;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .sat-card:hover {
          border-color: var(--color-border);
          box-shadow: var(--shadow-sm);
          transform: translateY(-2px);
        }

        /* Cards alternate above/below */
        .sat-node-above {
          flex-direction: column;
        }

        .sat-node-below {
          flex-direction: column-reverse;
        }

        .sat-node-above .sat-card { margin-bottom: 0.25rem; }
        .sat-node-above .sat-connector { order: 1; }
        .sat-node-above .sat-dot-wrap { order: 2; }
        .sat-node-above .sat-card { order: 0; }

        .sat-node-below .sat-card { margin-top: 0.25rem; }

        .sat-card-date {
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--color-ink-subtle);
          margin-bottom: 0.125rem;
        }

        .sat-card-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-ink);
          line-height: 1.3;
          margin-bottom: 0.25rem;
        }

        .sat-card-summary {
          font-size: 0.72rem;
          color: var(--color-ink-muted);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .sat-card-current {
          border-color: var(--color-brand);
          background: var(--color-brand-light);
        }

        /* ─── Ellipsis (collapsed) ─── */
        .sat-ellipsis {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 80px;
          z-index: 1;
          cursor: pointer;
        }

        .sat-ellipsis-btn {
          padding: 0.25rem 0.75rem;
          border-radius: var(--radius-full);
          border: 1px dashed var(--color-border);
          background: var(--color-surface-muted);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-ink-muted);
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-body);
        }

        .sat-ellipsis-btn:hover {
          border-color: var(--color-brand);
          color: var(--color-brand);
        }

        /* ─── Mobile Vertical Timeline ─── */
        .sat-mobile {
          display: none;
        }

        .sat-vert-list {
          position: relative;
          padding-left: 2rem;
        }

        /* Vertical line */
        .sat-vert-list::before {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: 11px;
          width: 2px;
          background: var(--color-border);
        }

        .sat-vert-item {
          position: relative;
          padding: 0 0 1.25rem 0;
        }

        .sat-vert-item:last-child {
          padding-bottom: 0;
        }

        .sat-vert-dot {
          position: absolute;
          left: -2rem;
          top: 2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2.5px solid var(--color-bg);
          box-shadow: 0 0 0 1.5px var(--color-border-subtle);
          z-index: 1;
        }

        .sat-vert-dot-current {
          width: 18px;
          height: 18px;
          left: calc(-2rem - 2px);
          box-shadow: 0 0 0 2px var(--color-brand-light), 0 0 8px rgba(232,19,43,0.2);
        }

        .sat-vert-you {
          font-size: 0.58rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-brand);
          background: var(--color-brand-light);
          padding: 1px 5px;
          border-radius: var(--radius-full);
          margin-bottom: 0.25rem;
          display: inline-block;
        }

        .sat-vert-date {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--color-ink-subtle);
        }

        .sat-vert-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--color-ink);
          line-height: 1.35;
          margin-top: 0.125rem;
        }

        .sat-vert-summary {
          font-size: 0.78rem;
          color: var(--color-ink-muted);
          line-height: 1.5;
          margin-top: 0.25rem;
        }

        .sat-vert-toggle {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--color-brand);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          margin-top: 0.25rem;
          font-family: var(--font-body);
        }

        /* ─── Key Players ─── */
        .kp-section {
          margin-top: 1.5rem;
        }

        .kp-title {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-ink-subtle);
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .kp-scroll {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
          scrollbar-width: thin;
        }

        .kp-chip-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .kp-chip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.75rem;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .kp-chip:hover {
          border-color: var(--color-ink-subtle);
          box-shadow: var(--shadow-sm);
        }

        .kp-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--gradient-brand);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.62rem;
          font-weight: 800;
          color: white;
          flex-shrink: 0;
        }

        .kp-details {
          display: flex;
          flex-direction: column;
        }

        .kp-name {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-ink);
          line-height: 1.2;
        }

        .kp-role-label {
          font-size: 0.66rem;
          color: var(--color-ink-subtle);
          line-height: 1.2;
        }

        .kp-tooltip {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          padding: 0.5rem 0.75rem;
          background: var(--color-ink);
          color: white;
          font-size: 0.75rem;
          border-radius: var(--radius-sm);
          white-space: nowrap;
          z-index: 10;
          pointer-events: none;
          animation: fadeIn 0.15s ease both;
          line-height: 1.4;
        }

        .kp-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: var(--color-ink);
        }

        /* ─── Responsive ─── */
        @media (max-width: 768px) {
          .sat-desktop { display: none; }
          .sat-mobile { display: block; }
          .sat-stats { gap: 0.75rem; }
        }
      `}</style>

      {/* ─── Section Header ─── */}
      <div className="sat-header">
        <span>🕐 How This Story Unfolded</span>
        <div className="sat-header-line" />
      </div>
      <div className="sat-arc-name">{storyArc.display_name}</div>

      {/* ─── Stats Bar ─── */}
      <div className="sat-stats">
        <div className="sat-stat">
          📅 Tracked for <span className="sat-stat-value">&nbsp;{trackedDays} day{trackedDays > 1 ? 's' : ''}</span>
        </div>
        <div className="sat-stat">
          📊 Across <span className="sat-stat-value">&nbsp;{sorted.length} event{sorted.length > 1 ? 's' : ''}</span>
        </div>
        <div className="sat-stat">
          Sentiment:&nbsp;
          <span
            className="sat-stat-trend"
            style={{ color: trend.color, background: `${trend.color}12` }}
          >
            {trend.icon} {trend.label}
          </span>
        </div>
      </div>

      {/* ─── Desktop Horizontal Timeline ─── */}
      <div className="sat-desktop">
        <div className="sat-scroll">
          <div className="sat-track">
            {displayEvents.map((event, i) => {
              // Ellipsis placeholder
              if (event === null) {
                return (
                  <div key="ellipsis" className="sat-ellipsis">
                    <button
                      className="sat-ellipsis-btn"
                      onClick={() => setIsExpanded(true)}
                    >
                      +{sorted.length - 5} more
                    </button>
                  </div>
                );
              }

              const isAbove = i % 2 === 0;
              const isCurrent = event.article_id === currentArticleId;
              const isFirst = i === 0 && !shouldCollapse;
              const isLast = i === displayEvents.length - 1;
              const dotColor = SENTIMENT_COLORS[event.sentiment] || SENTIMENT_COLORS.neutral;

              return (
                <div
                  key={`${event.date}-${i}`}
                  className={`sat-node ${isAbove ? 'sat-node-above' : 'sat-node-below'}`}
                >
                  {/* Card */}
                  <div className={`sat-card ${isCurrent ? 'sat-card-current' : ''}`}>
                    <div className="sat-card-date">
                      {SENTIMENT_LABELS[event.sentiment] || '⚪'} {formatDate(event.date)}
                    </div>
                    <div className="sat-card-title">{event.event_title}</div>
                    {event.event_summary && (
                      <div className="sat-card-summary">{event.event_summary}</div>
                    )}
                  </div>

                  {/* Connector */}
                  <div
                    className={`sat-connector ${isAbove ? 'sat-connector-up' : 'sat-connector-down'}`}
                    style={{ background: dotColor }}
                  />

                  {/* Dot */}
                  <div className="sat-dot-wrap">
                    {isCurrent && <span className="sat-you-badge">You are here</span>}
                    <div
                      className={`sat-dot ${isCurrent ? 'sat-dot-current' : ''}`}
                      style={{ background: dotColor }}
                    />
                    {isFirst && <span className="sat-first-badge">Story started</span>}
                    {isLast && <span className="sat-last-badge">Latest</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isExpanded && sorted.length > 6 && (
          <button
            className="sat-ellipsis-btn"
            onClick={() => setIsExpanded(false)}
            style={{ marginTop: '0.5rem' }}
          >
            Collapse timeline
          </button>
        )}
      </div>

      {/* ─── Mobile Vertical Timeline ─── */}
      <div className="sat-mobile">
        <MobileTimeline
          events={shouldCollapse ? displayEvents : sorted}
          currentArticleId={currentArticleId}
          shouldCollapse={shouldCollapse}
          totalEvents={sorted.length}
          onExpand={() => setIsExpanded(true)}
        />
      </div>

      {/* ─── Key Players ─── */}
      {keyPlayers.length > 0 && (
        <div className="kp-section">
          <div className="kp-title">👥 Key Players in This Story</div>
          <div className="kp-scroll">
            {[...keyPlayers]
              .sort((a, b) => {
                const relA = typeof a.relevance === 'number' ? a.relevance : 0;
                const relB = typeof b.relevance === 'number' ? b.relevance : 0;
                return relB - relA;
              })
              .map((player, i) => (
                <PlayerChip key={i} player={player} />
              ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── Mobile Timeline Sub-component ──────────────────────────── */

function MobileTimeline({
  events,
  currentArticleId,
  shouldCollapse,
  totalEvents,
  onExpand,
}: {
  events: (TimelineEvent | null)[];
  currentArticleId: string;
  shouldCollapse: boolean;
  totalEvents: number;
  onExpand: () => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="sat-vert-list">
      {events.map((event, i) => {
        if (event === null) {
          return (
            <div key="ellipsis" className="sat-vert-item" style={{ paddingLeft: 0 }}>
              <button className="sat-ellipsis-btn" onClick={onExpand}>
                +{totalEvents - 5} more events
              </button>
            </div>
          );
        }

        const isCurrent = event.article_id === currentArticleId;
        const dotColor = SENTIMENT_COLORS[event.sentiment] || SENTIMENT_COLORS.neutral;
        const isShowingSummary = expandedIdx === i;

        return (
          <div key={`${event.date}-${i}`} className="sat-vert-item">
            <div
              className={`sat-vert-dot ${isCurrent ? 'sat-vert-dot-current' : ''}`}
              style={{ background: dotColor }}
            />
            {isCurrent && <span className="sat-vert-you">You are here</span>}
            <span className="sat-vert-date">
              {SENTIMENT_LABELS[event.sentiment]} {formatFullDate(event.date)}
            </span>
            <div className="sat-vert-title">{event.event_title}</div>
            {event.event_summary && (
              <>
                {isShowingSummary ? (
                  <div className="sat-vert-summary">{event.event_summary}</div>
                ) : null}
                <button
                  className="sat-vert-toggle"
                  onClick={() => setExpandedIdx(isShowingSummary ? null : i)}
                >
                  {isShowingSummary ? 'Hide details' : 'Show details'}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
