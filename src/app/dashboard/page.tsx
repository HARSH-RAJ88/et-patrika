'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/layout/Navbar';
import BottomNav from '@/components/layout/BottomNav';
import CategoryTabs from '@/components/feed/CategoryTabs';
import FeaturedCard from '@/components/feed/FeaturedCard';
import ArticleCard from '@/components/feed/ArticleCard';
import type { FeedItem, UserRole, StoryArc, SupportedLanguage } from '@/types';

/* ─── Constants ───────────────────────────────────────────────── */

const ROLE_COLORS: Record<UserRole, string> = {
  student: '#2563EB',
  investor: '#059669',
  founder: '#7C3AED',
  citizen: '#D97706',
};

const ROLE_BG: Record<UserRole, string> = {
  student: '#EFF6FF',
  investor: '#ECFDF5',
  founder: '#F5F3FF',
  citizen: '#FFFBEB',
};

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/* ─── Skeleton Components ─────────────────────────────────────── */

function FeaturedSkeleton() {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
    }}>
      <div className="skeleton" style={{ height: '4px', borderRadius: 0 }} />
      <div style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <div className="skeleton" style={{ width: '80px', height: '24px', borderRadius: '999px' }} />
          <div className="skeleton" style={{ width: '100px', height: '24px' }} />
        </div>
        <div className="skeleton" style={{ width: '85%', height: '28px', marginBottom: '0.75rem' }} />
        <div className="skeleton" style={{ width: '65%', height: '28px', marginBottom: '1rem' }} />
        <div className="skeleton" style={{ width: '100%', height: '16px', marginBottom: '0.5rem' }} />
        <div className="skeleton" style={{ width: '70%', height: '16px', marginBottom: '1.5rem' }} />
        <div className="skeleton" style={{ width: '300px', height: '6px', marginBottom: '1.5rem' }} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div className="skeleton" style={{ width: '100px', height: '30px', borderRadius: '999px' }} />
          <div className="skeleton" style={{ width: '100px', height: '30px', borderRadius: '999px' }} />
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem' }}>
        <div className="skeleton" style={{ width: '80px', height: '16px' }} />
        <div className="skeleton" style={{ width: '40px', height: '16px' }} />
        <div className="skeleton" style={{ width: '60px', height: '16px', borderRadius: '999px' }} />
      </div>
      <div className="skeleton" style={{ width: '90%', height: '22px', marginBottom: '0.5rem' }} />
      <div className="skeleton" style={{ width: '60%', height: '22px', marginBottom: '1rem' }} />
      <div className="skeleton" style={{ width: '100%', height: '14px', marginBottom: '0.5rem' }} />
      <div className="skeleton" style={{ width: '50%', height: '14px', marginBottom: '1rem' }} />
      <div className="skeleton" style={{ width: '250px', height: '4px', marginBottom: '1rem' }} />
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <div className="skeleton" style={{ width: '80px', height: '26px', borderRadius: '999px' }} />
        <div className="skeleton" style={{ width: '80px', height: '26px', borderRadius: '999px' }} />
      </div>
    </div>
  );
}

/* ─── Main Dashboard Page ─────────────────────────────────────── */

export default function DashboardPage() {
  const { userProfile } = useUser();

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [category, setCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [storyArcs, setStoryArcs] = useState<StoryArc[]>([]);
  const [translatedCards, setTranslatedCards] = useState<Record<string, {
    eli5?: string;
    whyItMatters?: string;
    isLoading: boolean;
    language: SupportedLanguage;
  }>>({});

  const currentRole: UserRole = userProfile?.role || 'citizen';
  const currentLanguage: SupportedLanguage = userProfile?.language || 'en';
  const firstName = userProfile?.first_name || '';

  const SUPPORTED_TRANSLATION_LANGUAGES: SupportedLanguage[] = ['hi', 'ta', 'bn', 'te'];

  const fetchFeed = useCallback(async (role: UserRole, cat: string, off: number, append: boolean = false) => {
    if (!append) setIsLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        role,
        category: cat,
        limit: '10',
        offset: off.toString(),
      });

      const res = await fetch(`/api/feed?${params}`);
      const json = await res.json();

      if (json.data) {
        if (append) {
          setFeedItems(prev => [...prev, ...json.data]);
        } else {
          setFeedItems(json.data);
        }
        setTotal(json.total || 0);
        setHasMore(json.hasMore || false);
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Fetch story arcs for sidebar
  const fetchStoryArcs = useCallback(async () => {
    try {
      const arcsRes = await fetch('/api/story-arcs');
      if (arcsRes.ok) {
        const arcsData = await arcsRes.json();
        setStoryArcs(arcsData.data || []);
      }
    } catch { /* ignore - story arcs sidebar is non-critical */ }
  }, []);

  useEffect(() => {
    setOffset(0);
    fetchFeed(currentRole, category, 0);
    fetchStoryArcs();
  }, [currentRole, category, fetchFeed, fetchStoryArcs]);

  useEffect(() => {
    if (currentLanguage === 'en') {
      setTranslatedCards({});
      return;
    }

    if (!SUPPORTED_TRANSLATION_LANGUAGES.includes(currentLanguage)) {
      return;
    }

    feedItems.forEach((item) => {
      const articleId = item.article.id;
      const cached = item.context.translations || {};
      const cachedWhyItMatters = cached[currentLanguage];
      const cachedEli5 = cached[`${currentLanguage}_eli5`];
      const hasCachedWhy = Boolean(cachedWhyItMatters);
      const hasCachedEli5 = Boolean(cachedEli5);

      if (hasCachedWhy && hasCachedEli5) {
        setTranslatedCards((prev) => ({
          ...prev,
          [articleId]: {
            eli5: cachedEli5,
            whyItMatters: cachedWhyItMatters,
            isLoading: false,
            language: currentLanguage,
          },
        }));
        return;
      }

      const sourceEli5 = item.article.eli5 || '';
      const sourceWhy = item.context.why_it_matters || '';
      const needsEli5 = !hasCachedEli5 && sourceEli5.length > 0;
      const needsWhy = !hasCachedWhy && sourceWhy.length > 0;

      if (!needsEli5 && !needsWhy) {
        return;
      }

      setTranslatedCards((prev) => ({
        ...prev,
        [articleId]: {
          ...(prev[articleId] || {}),
          eli5: prev[articleId]?.eli5 || cachedEli5,
          whyItMatters: prev[articleId]?.whyItMatters || cachedWhyItMatters,
          isLoading: true,
          language: currentLanguage,
        },
      }));

      void (async () => {
        try {
          const requests: Promise<{
            key: 'eli5' | 'whyItMatters';
            value: string;
          }>[] = [];

          if (needsEli5) {
            requests.push(
              fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: sourceEli5,
                  targetLanguage: currentLanguage,
                  articleId,
                  role: currentRole,
                  fieldName: 'eli5',
                }),
              })
                .then((res) => res.json())
                .then((data) => ({ key: 'eli5' as const, value: data?.translatedText || sourceEli5 }))
            );
          }

          if (needsWhy) {
            requests.push(
              fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: sourceWhy,
                  targetLanguage: currentLanguage,
                  articleId,
                  role: currentRole,
                  fieldName: 'why_it_matters',
                }),
              })
                .then((res) => res.json())
                .then((data) => ({ key: 'whyItMatters' as const, value: data?.translatedText || sourceWhy }))
            );
          }

          const results = await Promise.all(requests);

          setTranslatedCards((prev) => {
            const next = {
              ...(prev[articleId] || {}),
              isLoading: false,
              language: currentLanguage,
              eli5: prev[articleId]?.eli5 || cachedEli5,
              whyItMatters: prev[articleId]?.whyItMatters || cachedWhyItMatters,
            };

            results.forEach((result) => {
              if (result.key === 'eli5') {
                next.eli5 = result.value;
              }
              if (result.key === 'whyItMatters') {
                next.whyItMatters = result.value;
              }
            });

            return {
              ...prev,
              [articleId]: next,
            };
          });
        } catch {
          setTranslatedCards((prev) => ({
            ...prev,
            [articleId]: {
              ...(prev[articleId] || {}),
              isLoading: false,
              language: currentLanguage,
            },
          }));
        }
      })();
    });
  }, [currentLanguage, currentRole, feedItems]);

  const handleLoadMore = () => {
    const newOffset = offset + 10;
    setOffset(newOffset);
    fetchFeed(currentRole, category, newOffset, true);
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setOffset(0);
  };

  const featured = feedItems.length > 0 ? feedItems[0] : null;
  const remaining = feedItems.slice(1);

  return (
    <>
      <style>{`
        .dashboard-wrapper {
          min-height: 100vh;
          background: var(--color-bg);
          padding-bottom: 60px;
        }

        /* ─── Briefing Header ─── */
        .briefing-header {
          padding: 2rem 2rem 1.5rem;
          max-width: 1280px;
          margin: 0 auto;
        }

        .briefing-greeting {
          font-size: 0.9rem;
          color: var(--color-ink-muted);
          margin-bottom: 0.25rem;
        }

        .briefing-title {
          font-family: var(--font-headline);
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-ink);
          margin-bottom: 0.25rem;
        }

        .briefing-date {
          font-size: 0.85rem;
          color: var(--color-ink-subtle);
        }

        /* ─── Main Layout ─── */
        .dash-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 2rem;
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 2rem 3rem;
        }

        .dash-main {
          min-width: 0;
        }

        .dash-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* ─── Category Section ─── */
        .category-section {
          margin-bottom: 1.5rem;
        }

        /* ─── Feed List ─── */
        .feed-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* ─── Load More ─── */
        .load-more-row {
          display: flex;
          justify-content: center;
          padding: 1.5rem 0;
        }

        .load-more-btn {
          padding: 0.625rem 2rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-full);
          background: var(--color-surface);
          color: var(--color-ink-secondary);
          font-family: var(--font-body);
          font-size: 0.88rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .load-more-btn:hover {
          border-color: var(--color-ink-subtle);
          background: var(--color-surface-muted);
        }

        .load-more-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ─── Sidebar Cards ─── */
        .sidebar-intel {
          position: relative;
          padding: 1.5rem;
          border-radius: var(--radius-lg);
          overflow: hidden;
          color: white;
        }

        .sidebar-intel-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        .sidebar-intel-content {
          position: relative;
          z-index: 1;
        }

        .sidebar-intel h3 {
          font-family: var(--font-headline);
          font-size: 1.15rem;
          margin-bottom: 0.25rem;
        }

        .sidebar-intel p {
          font-size: 0.85rem;
          opacity: 0.85;
          margin-bottom: 1rem;
          line-height: 1.5;
        }

        .sidebar-intel-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1.125rem;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: var(--radius-full);
          color: white;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
        }

        .sidebar-intel-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .sidebar-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }

        .sidebar-card h4 {
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--color-ink);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .trending-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .trending-tag {
          padding: 0.3rem 0.75rem;
          border-radius: var(--radius-full);
          background: var(--color-surface-muted);
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--color-ink-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }

        .trending-tag:hover {
          background: var(--color-brand-light);
          color: var(--color-brand);
        }

        .stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.75rem;
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          font-family: var(--font-headline);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-ink);
        }

        .stat-label {
          font-size: 0.72rem;
          color: var(--color-ink-muted);
          margin-top: 0.125rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1.5rem;
          color: var(--color-ink-muted);
        }

        .empty-state h3 {
          font-family: var(--font-headline);
          font-size: 1.25rem;
          color: var(--color-ink-secondary);
          margin-bottom: 0.5rem;
        }

        .empty-state p {
          font-size: 0.9rem;
          margin-bottom: 1.5rem;
        }

        /* ─── Responsive ─── */
        @media (max-width: 1024px) {
          .dash-layout {
            grid-template-columns: 1fr;
            padding: 0 1.5rem 2rem;
          }
          .dash-sidebar {
            flex-direction: row;
            flex-wrap: wrap;
          }
          .dash-sidebar > * {
            flex: 1;
            min-width: 260px;
          }
        }

        @media (max-width: 640px) {
          .briefing-header { padding: 1.5rem 1rem 1rem; }
          .dash-layout { padding: 0 1rem 2rem; }
          .briefing-title { font-size: 1.35rem; }
        }
      `}</style>

      <div className="dashboard-wrapper">
        {/* ─── Persistent Navbar ─── */}
        <Navbar />

        {/* ─── Briefing Header ───────────────────────────────── */}
        <header className="briefing-header">
          <p className="briefing-greeting">
            {firstName ? `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${firstName}` : 'Welcome back'}
          </p>
          <h1 className="briefing-title">Today&apos;s Intelligence Briefing</h1>
          <p className="briefing-date">{formatDate()}</p>
        </header>

        {/* ─── Main Layout ───────────────────────────────────── */}
        <div className="dash-layout">
          {/* ── Main Feed Column ─── */}
          <main className="dash-main">
            <div className="category-section">
              <CategoryTabs active={category} onChange={handleCategoryChange} />
            </div>

            {isLoading ? (
              <div className="feed-list">
                <FeaturedSkeleton />
                {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
              </div>
            ) : feedItems.length === 0 ? (
              <div className="empty-state">
                <h3>No articles yet</h3>
                <p>Run the pipeline to fetch and synthesize articles, or try a different category.</p>
                <button className="btn-ghost" onClick={() => handleCategoryChange('all')}>
                  Show all categories
                </button>
              </div>
            ) : (
              <div className="feed-list">
                {/* Featured first card */}
                {featured && (
                  <div className="animate-fade-in">
                    <FeaturedCard
                      item={featured}
                      role={currentRole}
                      translatedEli5={translatedCards[featured.article.id]?.language === currentLanguage ? translatedCards[featured.article.id]?.eli5 : undefined}
                    />
                  </div>
                )}

                {/* Remaining cards */}
                {remaining.map((item, i) => (
                  <div key={item.article.id} className={`animate-fade-in stagger-${Math.min(i + 1, 5)}`}>
                    <ArticleCard
                      item={item}
                      role={currentRole}
                      translatedEli5={translatedCards[item.article.id]?.language === currentLanguage ? translatedCards[item.article.id]?.eli5 : undefined}
                      translatedWhyItMatters={translatedCards[item.article.id]?.language === currentLanguage ? translatedCards[item.article.id]?.whyItMatters : undefined}
                      translationLanguage={currentLanguage}
                      isTranslating={Boolean(translatedCards[item.article.id]?.isLoading)}
                    />
                  </div>
                ))}

                {/* Load More */}
                {hasMore && (
                  <div className="load-more-row">
                    <button
                      className="load-more-btn"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? 'Loading...' : `Load More (${feedItems.length} of ${total})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* ── Sidebar ─── */}
          <aside className="dash-sidebar">
            {/* Intelligence Brief Card */}
            <div className="sidebar-intel" style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #4F16A8 50%, #2D0A6E 100%)',
            }}>
              <div className="sidebar-intel-content">
                <h3>✦ Your Intelligence Brief</h3>
                <p>
                  We&apos;ve analyzed {total || 0} articles today for you as{' '}
                  {currentRole === 'investor' ? 'an' : 'a'} {currentRole}.
                </p>
                <button className="sidebar-intel-btn">
                  Open Today&apos;s Brief →
                </button>
              </div>
            </div>

            {/* Trending Topics */}
            <div className="sidebar-card">
              <h4>📊 Trending Topics</h4>
              <div className="trending-tags">
                {storyArcs.length > 0 ? (
                  storyArcs.slice(0, 8).map((arc) => (
                    <span key={arc.topic_key} className="trending-tag">
                      {arc.display_name}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="trending-tag">AI & Tech</span>
                    <span className="trending-tag">Startup Funding</span>
                    <span className="trending-tag">Data Privacy</span>
                    <span className="trending-tag">Digital India</span>
                    <span className="trending-tag">Market Trends</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="sidebar-card">
              <h4>📈 Quick Stats</h4>
              <div className="stat-grid">
                <div className="stat-item">
                  <div className="stat-number">{total || 0}</div>
                  <div className="stat-label">Articles</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">{storyArcs.length || 3}</div>
                  <div className="stat-label">Stories tracked</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">9</div>
                  <div className="stat-label">Sources</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
        <BottomNav />
      </div>
    </>
  );
}
