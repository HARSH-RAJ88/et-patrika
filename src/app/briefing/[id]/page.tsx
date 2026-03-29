'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import SynthesisBriefing from '@/components/briefing/SynthesisBriefing';
import StoryArcTimeline from '@/components/briefing/StoryArcTimeline';
import ChatWidget from '@/components/briefing/ChatWidget';
import RolePanel from '@/components/briefing/RolePanel';
import type { Article, ArticleContext, StoryArc, UserRole } from '@/types';
import { useParams } from 'next/navigation';

/* ─── Skeleton ────────────────────────────────────────────────── */

function BriefingSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header skeleton */}
      <div style={{ background: 'linear-gradient(135deg, #1a0508, #0f0f0f)', padding: '4rem 2rem 3rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="skeleton" style={{ width: '200px', height: '20px', marginBottom: '1rem', opacity: 0.3 }} />
          <div className="skeleton" style={{ width: '70%', height: '36px', marginBottom: '0.75rem', opacity: 0.3 }} />
          <div className="skeleton" style={{ width: '50%', height: '36px', marginBottom: '1rem', opacity: 0.3 }} />
          <div className="skeleton" style={{ width: '300px', height: '16px', opacity: 0.3 }} />
        </div>
      </div>
      {/* Body skeleton */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
        <div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ width: '100%', height: '18px', marginBottom: '1rem' }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: '400px', borderRadius: '16px' }} />
      </div>
    </div>
  );
}

/* ─── Main Briefing Page ──────────────────────────────────────── */

export default function BriefingPage() {
  const params = useParams();
  const id = params.id as string;
  const { userProfile } = useUser();

  const [article, setArticle] = useState<Article | null>(null);
  const [context, setContext] = useState<ArticleContext | null>(null);
  const [allContexts, setAllContexts] = useState<ArticleContext[]>([]);
  const [storyArc, setStoryArc] = useState<StoryArc | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const role: UserRole = userProfile?.role || 'citizen';

  useEffect(() => {
    if (!id) return;

    async function fetchArticle() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/article/${id}?role=${role}`);
        const data = await res.json();

        if (data.article) {
          // Parse entities
          if (typeof data.article.entities === 'string') {
            try { data.article.entities = JSON.parse(data.article.entities); } catch { data.article.entities = []; }
          }
          setArticle(data.article);
        }
        if (data.context) setContext(data.context);
        if (data.allContexts) setAllContexts(data.allContexts);
        if (data.storyArc) {
          if (typeof data.storyArc.timeline === 'string') {
            try { data.storyArc.timeline = JSON.parse(data.storyArc.timeline); } catch { data.storyArc.timeline = []; }
          }
          if (typeof data.storyArc.key_players === 'string') {
            try { data.storyArc.key_players = JSON.parse(data.storyArc.key_players); } catch { data.storyArc.key_players = []; }
          }
          setStoryArc(data.storyArc);
        }
      } catch (error) {
        console.error('Error fetching article:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchArticle();
  }, [id, role]);

  if (isLoading) return <BriefingSkeleton />;
  if (!article) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Article not found</h2>
          <Link href="/dashboard" className="btn-brand">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const readTime = Math.max(3, Math.ceil((article.content?.length || 0) / 1200));
  const publishedDate = new Date(article.published_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const SENTIMENT_MAP: Record<string, { label: string; color: string }> = {
    positive: { label: 'Positive', color: '#059669' },
    neutral: { label: 'Neutral', color: '#6B7280' },
    negative: { label: 'Negative', color: '#DC2626' },
  };
  const sentimentInfo = SENTIMENT_MAP[article.sentiment] || SENTIMENT_MAP.neutral;

  return (
    <>
      <style>{`
        .briefing-page {
          min-height: 100vh;
          background: var(--color-bg);
        }

        /* ─── Top Bar ─── */
        .brief-topbar {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 2rem;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--color-border-subtle);
        }

        .brief-back {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--color-ink-muted);
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .brief-back:hover {
          color: var(--color-brand);
        }

        .brief-topbar-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.82rem;
          color: var(--color-ink-muted);
        }

        .brief-topbar-badge span {
          font-weight: 600;
          color: var(--color-brand);
        }

        /* ─── Hero Header ─── */
        .brief-hero {
          position: relative;
          padding: 4rem 2rem 3rem;
          background: linear-gradient(135deg, #0f0f0f 0%, #1a0508 50%, #2d0a10 100%);
          overflow: hidden;
        }

        .brief-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(232,19,43,0.08), transparent 60%);
        }

        .brief-hero-inner {
          position: relative;
          max-width: 1280px;
          margin: 0 auto;
          z-index: 1;
        }

        .brief-hero-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .synth-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.3rem 0.875rem;
          background: rgba(232,19,43,0.9);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 700;
          color: white;
          letter-spacing: 0.04em;
        }

        .hero-source {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.6);
          font-weight: 500;
        }

        .hero-sentiment {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-full);
          background: rgba(255,255,255,0.1);
        }

        .brief-hero-title {
          font-family: var(--font-headline);
          font-size: 2.25rem;
          font-weight: 700;
          color: white;
          line-height: 1.25;
          max-width: 800px;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }

        .brief-hero-details {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 0.82rem;
          color: rgba(255,255,255,0.5);
          flex-wrap: wrap;
        }

        .brief-hero-details span {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .brief-hero-credibility {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.2rem 0.5rem;
          background: rgba(255,255,255,0.1);
          border-radius: var(--radius-full);
          font-weight: 600;
        }

        /* ─── Two Column Layout ─── */
        .brief-layout {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 2.5rem;
          max-width: 1280px;
          margin: 0 auto;
          padding: 2.5rem 2rem 4rem;
        }

        .brief-main {
          min-width: 0;
        }

        /* ─── Entity Tags ─── */
        .entity-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
          margin-bottom: 2rem;
        }

        .entity-tag {
          padding: 0.25rem 0.625rem;
          border-radius: var(--radius-full);
          background: var(--color-surface-muted);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-ink-muted);
        }

        /* ─── Responsive ─── */
        @media (max-width: 1024px) {
          .brief-layout {
            grid-template-columns: 1fr;
            padding: 1.5rem 1.5rem 3rem;
          }
          .brief-hero-title {
            font-size: 1.5rem;
          }
        }

        @media (max-width: 640px) {
          .brief-hero {
            padding: 2.5rem 1rem 2rem;
          }
          .brief-topbar {
            padding: 0.75rem 1rem;
          }
          .brief-layout {
            padding: 1rem 1rem 2rem;
          }
          .brief-hero-title {
            font-size: 1.35rem;
          }
        }
      `}</style>

      <div className="briefing-page">
        {/* ─── Top Bar ──────────────────────────────── */}
        <nav className="brief-topbar">
          <Link href="/dashboard" className="brief-back">
            ← Back to Feed
          </Link>
          <div className="brief-topbar-badge">
            <Image src="/logo.png" alt="ET Patrika" width={28} height={28} />
            <span>Intelligence Briefing</span>
          </div>
        </nav>

        {/* ─── Hero Header ──────────────────────────── */}
        <header className="brief-hero">
          <div className="brief-hero-inner">
            <div className="brief-hero-meta">
              <span className="synth-badge">
                ✦ Synthesized Briefing
              </span>
              <span className="hero-source">{article.source}</span>
              <span className="hero-sentiment" style={{ color: sentimentInfo.color }}>
                ● {sentimentInfo.label}
              </span>
            </div>

            <h1 className="brief-hero-title">
              {article.title}
            </h1>

            <div className="brief-hero-details">
              <span>📅 {publishedDate}</span>
              <span>⏱ {readTime} min read</span>
              <span>📂 {article.category}</span>
              <span className="brief-hero-credibility">
                🛡️ {Math.round((article.credibility_score || 0.5) * 100)}% reliable
              </span>
            </div>
          </div>
        </header>

        {/* ─── Main Layout ──────────────────────────── */}
        <div className="brief-layout">
          {/* ── Left Column ─── */}
          <main className="brief-main animate-fade-in">
            {/* Entity tags */}
            {article.entities && article.entities.length > 0 && (
              <div className="entity-row">
                {(article.entities as string[]).slice(0, 8).map((entity, i) => (
                  <span key={i} className="entity-tag">{entity}</span>
                ))}
              </div>
            )}

            {/* Synthesis Briefing */}
            {article.synthesis_briefing && (
              <SynthesisBriefing
                briefing={article.synthesis_briefing}
                source={article.source}
              />
            )}

            {/* Story Arc Timeline */}
            {storyArc && storyArc.timeline && storyArc.timeline.length > 0 && (
              <StoryArcTimeline
                storyArc={storyArc}
                currentArticleId={article.id}
              />
            )}

            {/* Chat Widget */}
            <ChatWidget articleId={article.id} role={role} articleTitle={article.title} />
          </main>

          {/* ── Right Column: Role Intelligence Panel ─── */}
          <RolePanel
            articleId={article.id}
            allContexts={allContexts}
            initialRole={role}
            eli5={article.eli5 || ''}
          />
        </div>
      </div>
    </>
  );
}
