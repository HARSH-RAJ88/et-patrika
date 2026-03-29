'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import BottomNav from '@/components/layout/BottomNav';

const VIDEO_API_BASE = process.env.NEXT_PUBLIC_VIDEO_STUDIO_API_BASE || (process.env.NODE_ENV === 'development' ? 'http://localhost:8001' : '');

interface VideoKeyPointsResponse {
  article_id: string;
  role: string;
  language: string;
  headline: string;
  key_points: string[];
  source_model?: string;
}

function formatDuration(duration?: number) {
  if (!duration || Number.isNaN(duration) || duration <= 0) return 'N/A';
  const mins = Math.floor(duration / 60);
  const secs = Math.round(duration % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function VideoWatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const src = searchParams.get('src') || '';
  const title = searchParams.get('title') || 'ET Patrika Video';
  const role = searchParams.get('role') || 'citizen';
  const articleId = searchParams.get('articleId') || '';
  const language = searchParams.get('language') === 'hi' ? 'hi' : 'en';
  const durationParam = searchParams.get('duration');
  const duration = durationParam ? Number(durationParam) : undefined;

  const [keyPoints, setKeyPoints] = useState<VideoKeyPointsResponse | null>(null);
  const [isKeyPointsLoading, setIsKeyPointsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchKeyPoints = async () => {
      if (!articleId || !VIDEO_API_BASE) {
        setKeyPoints(null);
        return;
      }

      setIsKeyPointsLoading(true);
      try {
        const params = new URLSearchParams({ article_id: articleId, role, language });
        const response = await fetch(`${VIDEO_API_BASE}/studio/api/key-points?${params.toString()}`);
        if (!response.ok) return;

        const data = (await response.json()) as VideoKeyPointsResponse;
        if (!cancelled) {
          setKeyPoints(data);
        }
      } finally {
        if (!cancelled) {
          setIsKeyPointsLoading(false);
        }
      }
    };

    void fetchKeyPoints();

    return () => {
      cancelled = true;
    };
  }, [articleId, language, role]);

  return (
    <>
      <style>{`
        .vsw-page {
          min-height: 100vh;
          background: radial-gradient(circle at 12% 12%, #1f2937 0%, #111827 42%, #0b1020 100%);
          padding-bottom: 70px;
        }

        .vsw-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1.2rem 1.25rem 2rem;
        }

        .vsw-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .vsw-back {
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(15, 23, 42, 0.7);
          color: #E5E7EB;
          border-radius: 999px;
          padding: 0.45rem 0.9rem;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
        }

        .vsw-layout {
          display: grid;
          grid-template-columns: minmax(0, 72%) minmax(260px, 28%);
          gap: 1rem;
        }

        .vsw-player-card,
        .vsw-side-card {
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background: linear-gradient(180deg, rgba(15,23,42,0.92), rgba(15,23,42,0.78));
          backdrop-filter: blur(5px);
        }

        .vsw-player-card {
          padding: 0.95rem;
        }

        .vsw-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .vsw-title {
          color: #F8FAFC;
          font-size: 1.35rem;
          line-height: 1.3;
          font-weight: 800;
          margin: 0;
        }

        .vsw-badges {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
        }

        .vsw-badge {
          font-size: 0.75rem;
          font-weight: 700;
          border-radius: 999px;
          border: 1px solid rgba(248,250,252,0.16);
          color: #E2E8F0;
          padding: 0.18rem 0.6rem;
          background: rgba(2,6,23,0.6);
        }

        .vsw-video-frame {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.3);
          background: black;
        }

        .vsw-video {
          display: block;
          width: 100%;
          max-height: 72vh;
          background: black;
        }

        .vsw-side {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .vsw-side-card {
          padding: 0.9rem;
        }

        .vsw-side-title {
          margin: 0 0 0.55rem;
          color: #F1F5F9;
          font-size: 0.94rem;
          font-weight: 800;
        }

        .vsw-side-text {
          margin: 0.35rem 0;
          color: #CBD5E1;
          font-size: 0.82rem;
          line-height: 1.5;
        }

        .vsw-kp-list {
          list-style: none;
          margin: 0.45rem 0 0;
          padding: 0;
          display: grid;
          gap: 0.45rem;
        }

        .vsw-kp-item {
          display: grid;
          grid-template-columns: 20px 1fr;
          gap: 0.45rem;
          align-items: start;
        }

        .vsw-kp-num {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 800;
          color: #fff;
          background: #F97316;
          margin-top: 0.1rem;
        }

        .vsw-kp-text {
          margin: 0;
          color: #E2E8F0;
          font-size: 0.82rem;
          line-height: 1.45;
        }

        .vsw-download {
          margin-top: 0.7rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          border: 1px solid #E8132B;
          color: #F8FAFC;
          background: linear-gradient(90deg, #E8132B 0%, #B91C1C 100%);
          border-radius: 10px;
          font-size: 0.84rem;
          font-weight: 800;
          padding: 0.58rem 0.8rem;
          text-decoration: none;
        }

        .vsw-empty {
          margin-top: 0.6rem;
          border-radius: 10px;
          border: 1px dashed rgba(248,250,252,0.25);
          color: #CBD5E1;
          padding: 0.8rem;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        @media (max-width: 1024px) {
          .vsw-layout {
            grid-template-columns: 1fr;
          }

          .vsw-video {
            max-height: 56vh;
          }
        }
      `}</style>

      <div className="vsw-page">
        <Navbar />

        <main className="vsw-wrap">
          <div className="vsw-topbar">
            <button type="button" className="vsw-back" onClick={() => router.push('/dashboard/video-studio')}>
              ← Back to Video Studio
            </button>
          </div>

          <div className="vsw-layout">
            <section className="vsw-player-card">
              <div className="vsw-header">
                <h1 className="vsw-title">{title}</h1>
                <div className="vsw-badges">
                  <span className="vsw-badge">Role: {role}</span>
                  <span className="vsw-badge">Duration: {formatDuration(duration)}</span>
                </div>
              </div>

              {src ? (
                <div className="vsw-video-frame">
                  <video className="vsw-video" controls src={src} autoPlay />
                </div>
              ) : (
                <div className="vsw-empty">
                  Video source missing. Please go back to Video Studio and click Watch again.
                </div>
              )}
            </section>

            <aside className="vsw-side">
              <div className="vsw-side-card">
                <h2 className="vsw-side-title">Video Key Points</h2>
                <p className="vsw-side-text" style={{ fontWeight: 700, color: '#F8FAFC' }}>
                  {keyPoints?.headline || title}
                </p>

                {isKeyPointsLoading ? (
                  <p className="vsw-side-text">Generating real key points...</p>
                ) : keyPoints?.key_points?.length ? (
                  <ol className="vsw-kp-list">
                    {keyPoints.key_points.map((point, index) => (
                      <li key={`${index}-${point.slice(0, 16)}`} className="vsw-kp-item">
                        <span className="vsw-kp-num">{index + 1}</span>
                        <p className="vsw-kp-text">{point}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="vsw-side-text">No key points available yet for this video.</p>
                )}

                {src && (
                  <a href={src} className="vsw-download" target="_blank" rel="noreferrer">
                    Open Video Source
                  </a>
                )}
              </div>

              <div className="vsw-side-card">
                <h3 className="vsw-side-title">Controls</h3>
                <p className="vsw-side-text">Space: Play/Pause</p>
                <p className="vsw-side-text">F: Fullscreen</p>
                <p className="vsw-side-text">M: Mute/Unmute</p>
              </div>
            </aside>
          </div>
        </main>

        <BottomNav />
      </div>
    </>
  );
}

export default function VideoWatchPage() {
  return (
    <Suspense fallback={<div style={{ padding: '1rem' }}>Loading video...</div>}>
      <VideoWatchContent />
    </Suspense>
  );
}
