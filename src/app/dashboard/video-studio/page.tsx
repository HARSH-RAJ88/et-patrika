'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import BottomNav from '@/components/layout/BottomNav';
import CategoryTabs from '@/components/feed/CategoryTabs';
import { useUser } from '@/contexts/UserContext';
import type { FeedItem, UserRole } from '@/types';
import VideoCard, { VideoArticlePreview, VideoJobCardStatus } from '@/components/video-studio/VideoCard';

const VIDEO_API_BASE = process.env.NEXT_PUBLIC_VIDEO_STUDIO_API_BASE || (process.env.NODE_ENV === 'development' ? 'http://localhost:8001' : '');
const REQUEST_TIMEOUT_MS = 3500;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs: number = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...(init || {}), signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

type RoleFilter = 'all' | UserRole;

const ROLE_PILLS: Array<{ id: RoleFilter; label: string }> = [
  { id: 'all', label: 'All Roles' },
  { id: 'student', label: 'Student' },
  { id: 'investor', label: 'Investor' },
  { id: 'founder', label: 'Founder' },
  { id: 'citizen', label: 'Citizen' },
];

interface VideoHistoryItem {
  id: string;
  article_id: string;
  role: string;
  status: string;
  video_filename?: string;
  duration_seconds?: number;
  progress_percent?: number;
  current_step?: string;
}

export default function VideoStudioPage() {
  const router = useRouter();
  const { userProfile } = useUser();
  const currentRole: UserRole = userProfile?.role || 'citizen';
  const generationLanguage = userProfile?.language === 'hi' ? 'hi' : 'en';

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(currentRole);
  const [isRoleOverrideActive, setIsRoleOverrideActive] = useState(false);
  const [backendOffline, setBackendOffline] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [articles, setArticles] = useState<VideoArticlePreview[]>([]);
  const [recentVideos, setRecentVideos] = useState<Array<VideoHistoryItem & { title: string }>>([]);
  const [jobStatuses, setJobStatuses] = useState<Record<string, VideoJobCardStatus & { jobId?: string }>>({});

  const pollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const generationRole = useMemo<UserRole>(() => {
    return roleFilter === 'all' ? currentRole : roleFilter;
  }, [currentRole, roleFilter]);

  const clearPoller = useCallback((key: string) => {
    const intervalId = pollersRef.current[key];
    if (intervalId) {
      clearInterval(intervalId);
      delete pollersRef.current[key];
    }
  }, []);

  const refreshHistory = useCallback(async (titleMap: Record<string, string>) => {
    if (backendOffline || !VIDEO_API_BASE) return;

    try {
      const response = await fetchWithTimeout(`${VIDEO_API_BASE}/studio/api/history?limit=20`);
      if (!response.ok) return;
      const rows = (await response.json()) as VideoHistoryItem[];
      const done = rows.filter((row) => row.status === 'done').slice(0, 5);
      setRecentVideos(
        done.map((row) => ({
          ...row,
          title: titleMap[row.article_id] || `Article ${row.article_id.slice(0, 8)}`,
        }))
      );

      const completedStatuses: Record<string, VideoJobCardStatus & { jobId?: string }> = {};
      rows.forEach((row) => {
        if (row.status === 'done' && row.video_filename) {
          const key = `${row.article_id}:${row.role}`;
          completedStatuses[key] = {
            status: 'done',
            progress_percent: 100,
            current_step: 'Video ready',
            video_url: `/videos/${row.video_filename}`,
            role: row.role,
            duration_seconds: row.duration_seconds,
            jobId: row.id,
          };
        }
      });

      setJobStatuses((prev) => ({ ...prev, ...completedStatuses }));
    } catch {
      // History is optional UI context; ignore failures.
    }
  }, [backendOffline]);

  const fetchArticles = useCallback(async () => {
    if (isCheckingBackend) return;

    setIsLoadingArticles(true);

    const titleMap: Record<string, string> = {};

    try {
      if (!backendOffline && VIDEO_API_BASE) {
        const backendRes = await fetchWithTimeout(
          `${VIDEO_API_BASE}/studio/api/articles?limit=20&category=${encodeURIComponent(selectedCategory)}`
        );

        if (!backendRes.ok) {
          throw new Error('Video backend article fetch failed');
        }

        const backendArticles = (await backendRes.json()) as VideoArticlePreview[];
        const feedRes = await fetchWithTimeout(
          `/api/feed?role=${currentRole}&category=${encodeURIComponent(selectedCategory)}&limit=20&offset=0`,
          undefined,
          6000
        );
        const feedJson = await feedRes.json();
        const feedData = (feedJson.data || []) as FeedItem[];

        const feedMap = new Map<string, FeedItem>();
        feedData.forEach((item) => {
          feedMap.set(item.article.id, item);
        });

        const merged = backendArticles.map((article) => {
          const feedItem = feedMap.get(article.id);
          const feedArticle = feedItem?.article as { story_momentum?: string; eli5?: string } | undefined;
          const mergedItem: VideoArticlePreview = {
            ...article,
            title: feedItem?.context?.headline || article.title,
            story_momentum: feedArticle?.story_momentum || article.story_momentum,
            eli5: feedArticle?.eli5 || article.eli5,
          };
          titleMap[mergedItem.id] = mergedItem.title;
          return mergedItem;
        });

        setArticles(merged);
        await refreshHistory(titleMap);
      } else {
        const fallbackRes = await fetchWithTimeout(
          `/api/feed?role=${currentRole}&category=${encodeURIComponent(selectedCategory)}&limit=20&offset=0`,
          undefined,
          6000
        );
        const fallbackJson = await fallbackRes.json();
        const fallbackData = (fallbackJson.data || []) as FeedItem[];

        const mapped: VideoArticlePreview[] = fallbackData.map((item) => {
          const article = item.article;
          const fallbackArticle = article as { story_momentum?: string; eli5?: string };
          const preview = {
            id: article.id,
            title: item.context?.headline || article.title,
            source: article.source,
            category: article.category,
            published_at: article.published_at,
            credibility_score: article.credibility_score,
            story_momentum: fallbackArticle.story_momentum,
            eli5: fallbackArticle.eli5 || undefined,
          };
          titleMap[preview.id] = preview.title;
          return preview;
        });

        setArticles(mapped);
        setRecentVideos([]);
      }
    } catch {
      if (!backendOffline) {
        setBackendOffline(true);
      }
    } finally {
      setIsLoadingArticles(false);
    }
  }, [backendOffline, currentRole, isCheckingBackend, refreshHistory, selectedCategory]);

  useEffect(() => {
    let cancelled = false;

    const checkBackend = async () => {
      if (!VIDEO_API_BASE) {
        if (!cancelled) {
          setBackendOffline(true);
          setIsCheckingBackend(false);
        }
        return;
      }

      try {
        const response = await fetchWithTimeout(`${VIDEO_API_BASE}/studio/api/health`);
        if (!response.ok) throw new Error('Backend health failed');
        if (!cancelled) {
          setBackendOffline(false);
        }
      } catch {
        if (!cancelled) {
          setBackendOffline(true);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingBackend(false);
        }
      }
    };

    void checkBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isRoleOverrideActive) {
      setRoleFilter(currentRole);
    }
  }, [currentRole, isRoleOverrideActive]);

  useEffect(() => {
    const activePollers = pollersRef.current;
    Object.keys(activePollers).forEach((key) => {
      clearInterval(activePollers[key]);
    });
    pollersRef.current = {};

    setJobStatuses((prev) => {
      const next: Record<string, VideoJobCardStatus & { jobId?: string }> = {};
      Object.entries(prev).forEach(([key, status]) => {
        if (status.status === 'done' || status.status === 'failed') {
          next[key] = status;
        }
      });
      return next;
    });
  }, [currentRole]);

  useEffect(() => {
    if (isCheckingBackend) return;
    void fetchArticles();
  }, [fetchArticles, isCheckingBackend]);

  useEffect(() => {
    return () => {
      const activePollers = pollersRef.current;
      Object.keys(activePollers).forEach((key) => {
        clearInterval(activePollers[key]);
      });
      pollersRef.current = {};
    };
  }, []);

  const startPolling = useCallback((jobId: string, jobKey: string, role: UserRole, articleTitle: string) => {
    if (!VIDEO_API_BASE) return;

    clearPoller(jobKey);

    pollersRef.current[jobKey] = setInterval(async () => {
      try {
        const response = await fetch(`${VIDEO_API_BASE}/studio/api/status/${jobId}`);
        if (!response.ok) return;

        const status = await response.json();
        const nextStatus: VideoJobCardStatus & { jobId?: string } = {
          status: status.status,
          progress_percent: status.progress_percent || 0,
          current_step: status.current_step || 'Processing...',
          video_url: status.video_url,
          error: status.error,
          role,
          duration_seconds: status.duration_seconds,
          jobId,
        };

        setJobStatuses((prev) => ({ ...prev, [jobKey]: nextStatus }));

        if (status.status === 'done' || status.status === 'failed') {
          clearPoller(jobKey);

          if (status.status === 'done') {
            setRecentVideos((prev) => {
              const withoutArticle = prev.filter((video) => !(video.article_id === jobKey.split(':')[0] && video.role === role));
              const next: VideoHistoryItem & { title: string } = {
                id: jobId,
                article_id: jobKey.split(':')[0],
                role,
                status: 'done',
                video_filename: status.video_url ? status.video_url.replace('/videos/', '') : undefined,
                duration_seconds: status.duration_seconds,
                title: articleTitle,
              };
              return [next, ...withoutArticle].slice(0, 5);
            });
          }
        }
      } catch {
        // Keep polling; transient network issues are expected.
      }
    }, 3000);
  }, [clearPoller]);

  const handleGenerate = useCallback(async (articleId: string, role: string) => {
    if (backendOffline || !VIDEO_API_BASE) return;

    const selectedArticle = articles.find((article) => article.id === articleId);
    const articleTitle = selectedArticle?.title || 'Generated video';
    const normalizedRole = (['student', 'investor', 'founder', 'citizen'].includes(role) ? role : currentRole) as UserRole;
    const jobKey = `${articleId}:${normalizedRole}`;

    setJobStatuses((prev) => ({
      ...prev,
      [jobKey]: {
        status: 'queued',
        progress_percent: 0,
        current_step: 'Job queued — pipeline starting...',
        role: normalizedRole,
      },
    }));

    try {
      const response = await fetch(`${VIDEO_API_BASE}/studio/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'supabase',
          article_id: articleId,
          role: normalizedRole,
          style: 'standard',
          language: generationLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error('Generate request failed');
      }

      const data = await response.json();
      const jobId: string = data.job_id;

      setJobStatuses((prev) => ({
        ...prev,
        [jobKey]: {
          status: data.status || 'queued',
          progress_percent: data.progress_percent || 0,
          current_step: data.current_step || 'Job queued — pipeline starting...',
          role: normalizedRole,
          jobId,
        },
      }));

      startPolling(jobId, jobKey, normalizedRole, articleTitle);
    } catch {
      setJobStatuses((prev) => ({
        ...prev,
        [jobKey]: {
          status: 'failed',
          progress_percent: 0,
          current_step: 'Failed',
          error: 'Could not start video generation.',
          role: normalizedRole,
        },
      }));
    }
  }, [articles, backendOffline, currentRole, generationLanguage, startPolling]);

  const openPlayer = useCallback((videoUrl: string, articleTitle: string, role: string, articleId: string, durationSeconds?: number) => {
    const normalized = videoUrl.startsWith('http')
      ? videoUrl
      : `${VIDEO_API_BASE}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
    const query = new URLSearchParams({
      src: normalized,
      title: articleTitle,
      role,
      articleId,
      language: generationLanguage,
    });

    if (typeof durationSeconds === 'number' && durationSeconds > 0) {
      query.set('duration', String(durationSeconds));
    }

    router.push(`/dashboard/video-studio/watch?${query.toString()}`);
  }, [generationLanguage, router]);

  return (
    <>
      <style>{`
        .vs-page {
          min-height: 100vh;
          background: var(--color-bg);
          padding-bottom: 60px;
        }

        .vs-wrap {
          max-width: 1280px;
          margin: 0 auto;
          padding: 1.5rem 2rem 2.5rem;
        }

        .vs-offline {
          margin-bottom: 1rem;
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: #991B1B;
          border-radius: var(--radius-md);
          padding: 0.7rem 0.9rem;
          font-size: 0.86rem;
          line-height: 1.45;
        }

        .vs-layout {
          display: grid;
          grid-template-columns: minmax(0, 70%) minmax(280px, 30%);
          gap: 1.25rem;
        }

        .vs-main {
          min-width: 0;
        }

        .vs-sidebar {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }

        .vs-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.85rem;
          margin-top: 0.9rem;
        }

        .vs-pill-row {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          margin-top: 0.85rem;
        }

        .vs-pill {
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          border-radius: var(--radius-full);
          padding: 0.34rem 0.8rem;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--color-ink-secondary);
          cursor: pointer;
        }

        .vs-pill-active {
          background: #E8132B;
          color: white;
          border-color: #E8132B;
        }

        .vs-side-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-lg);
          padding: 1rem;
        }

        .vs-side-title {
          margin: 0 0 0.6rem;
          font-size: 1rem;
          font-weight: 800;
          color: #111827;
        }

        .vs-side-text {
          margin: 0.2rem 0;
          font-size: 0.85rem;
          color: var(--color-ink-muted);
          line-height: 1.45;
        }

        .vs-history-item {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.55rem 0;
          border-bottom: 1px solid var(--color-border-subtle);
        }

        .vs-history-item:last-child {
          border-bottom: none;
        }

        .vs-watch-link {
          border: none;
          background: transparent;
          color: #E8132B;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
        }

        .vs-empty {
          text-align: center;
          font-size: 0.9rem;
          color: var(--color-ink-muted);
          padding: 2rem 1rem;
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-lg);
          background: var(--color-surface);
          margin-top: 1rem;
        }

        @media (max-width: 1024px) {
          .vs-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .vs-wrap {
            padding: 1rem;
          }
        }
      `}</style>

      <div className="vs-page">
        <Navbar />

        <div className="vs-wrap">
          {backendOffline && (
            <div className="vs-offline">
              Video Studio backend is offline. Set <strong>NEXT_PUBLIC_VIDEO_STUDIO_API_BASE</strong> to your deployed Python API URL.
            </div>
          )}

          <div className="vs-layout">
            <main className="vs-main">
              <CategoryTabs active={selectedCategory} onChange={setSelectedCategory} />

              <div className="vs-pill-row">
                {ROLE_PILLS.map((pill) => (
                  <button
                    key={pill.id}
                    className={`vs-pill ${roleFilter === pill.id ? 'vs-pill-active' : ''}`}
                    onClick={() => {
                      if (pill.id === 'all') {
                        setIsRoleOverrideActive(false);
                        setRoleFilter(currentRole);
                        return;
                      }

                      setIsRoleOverrideActive(pill.id !== currentRole);
                      setRoleFilter(pill.id);
                    }}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {isLoadingArticles || isCheckingBackend ? (
                <div className="vs-empty">Loading video-ready articles...</div>
              ) : articles.length === 0 ? (
                <div className="vs-empty">No articles available for this category yet.</div>
              ) : (
                <div className="vs-card-grid">
                  {articles.map((article) => {
                    const key = `${article.id}:${generationRole}`;
                    return (
                      <VideoCard
                        key={key}
                        article={article}
                        currentRole={generationRole}
                        onGenerateClick={handleGenerate}
                        jobStatus={jobStatuses[key]}
                        disabled={backendOffline}
                        onWatchClick={openPlayer}
                      />
                    );
                  })}
                </div>
              )}
            </main>

            <aside className="vs-sidebar">
              <div className="vs-side-card" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #FF6B6B 100%)', color: 'white' }}>
                <h2 className="vs-side-title" style={{ color: 'white' }}>🎬 Video Studio</h2>
                <p className="vs-side-text" style={{ color: 'rgba(255,255,255,0.9)' }}>Video generation takes 45–90 seconds.</p>
                <p className="vs-side-text" style={{ color: 'rgba(255,255,255,0.9)' }}>Your videos are generated with ET Patrika branding.</p>
                <p className="vs-side-text" style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700 }}>
                  Browse Role: {currentRole}
                </p>
                <p className="vs-side-text" style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700 }}>
                  Generate For: {generationRole}
                </p>
              </div>

              <div className="vs-side-card">
                <h3 className="vs-side-title">Recent Videos</h3>
                {recentVideos.length === 0 ? (
                  <p className="vs-side-text">No generated videos yet.</p>
                ) : (
                  recentVideos.slice(0, 5).map((video) => (
                    <div key={`${video.id}-${video.article_id}`} className="vs-history-item">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {video.title}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--color-ink-subtle)' }}>
                          {video.role} {video.duration_seconds ? `• ${Math.round(video.duration_seconds)}s` : ''}
                        </div>
                      </div>
                      {video.video_filename && (
                        <button
                          type="button"
                          className="vs-watch-link"
                          onClick={() => openPlayer(`/videos/${video.video_filename}`, video.title, video.role, video.article_id, video.duration_seconds)}
                        >
                          ▶ Watch
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>
        </div>

        <BottomNav />
      </div>
    </>
  );
}
