'use client';

import React from 'react';

interface VideoPlayerProps {
  isOpen: boolean;
  videoSrc: string;
  articleTitle: string;
  role: string;
  durationSeconds?: number;
  onClose: () => void;
}

function formatDuration(durationSeconds?: number) {
  if (!durationSeconds || durationSeconds <= 0) return '';
  const mins = Math.floor(durationSeconds / 60);
  const secs = Math.round(durationSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({
  isOpen,
  videoSrc,
  articleTitle,
  role,
  durationSeconds,
  onClose,
}: VideoPlayerProps) {
  if (!isOpen) return null;

  return (
    <div className="vsp-overlay" onClick={onClose}>
      <style>{`
        .vsp-overlay {
          position: fixed;
          inset: 0;
          z-index: 300;
          background: rgba(0, 0, 0, 0.84);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.2rem;
        }

        .vsp-modal {
          width: min(980px, 96vw);
          max-height: 92vh;
          overflow: auto;
          background: #0F172A;
          border: 1px solid #1E293B;
          border-radius: var(--radius-lg);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.35);
        }

        .vsp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.85rem 1rem;
          border-bottom: 1px solid #1E293B;
        }

        .vsp-close {
          border: none;
          background: transparent;
          color: #E2E8F0;
          font-size: 1.5rem;
          line-height: 1;
          cursor: pointer;
        }

        .vsp-body {
          padding: 1rem;
        }

        .vsp-video {
          width: 100%;
          border-radius: var(--radius-md);
          background: black;
        }

        .vsp-meta {
          margin-top: 0.8rem;
          color: #E2E8F0;
        }

        .vsp-title {
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 0.35rem;
        }

        .vsp-row {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .vsp-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.22rem 0.55rem;
          border-radius: var(--radius-full);
          background: #1E293B;
          color: #E2E8F0;
          font-size: 0.75rem;
          font-weight: 600;
        }
      `}</style>

      <div className="vsp-modal" onClick={(event) => event.stopPropagation()}>
        <div className="vsp-header">
          <strong style={{ color: '#F8FAFC' }}>🎬 Video Playback</strong>
          <button type="button" className="vsp-close" onClick={onClose} aria-label="Close player">
            ×
          </button>
        </div>

        <div className="vsp-body">
          <video className="vsp-video" controls src={videoSrc} />

          <div className="vsp-meta">
            <div className="vsp-title">{articleTitle}</div>
            <div className="vsp-row">
              <span className="vsp-badge">Role: {role}</span>
              {formatDuration(durationSeconds) && <span className="vsp-badge">Duration: {formatDuration(durationSeconds)}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
