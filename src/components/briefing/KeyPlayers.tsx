'use client';

import React from 'react';
import type { KeyPlayer as KeyPlayerType } from '@/types';

interface KeyPlayersProps {
  players: KeyPlayerType[];
}

export default function KeyPlayers({ players }: KeyPlayersProps) {
  if (!players || players.length === 0) return null;

  return (
    <div className="key-players">
      <style>{`
        .key-players {
          margin-top: 1.25rem;
        }

        .kp-label {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-ink-subtle);
          margin-bottom: 0.75rem;
        }

        .kp-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .kp-chip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.75rem;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          transition: all 0.15s ease;
        }

        .kp-chip:hover {
          border-color: var(--color-ink-subtle);
          box-shadow: var(--shadow-sm);
        }

        .kp-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--gradient-brand);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: 700;
          color: white;
        }

        .kp-info {
          display: flex;
          flex-direction: column;
        }

        .kp-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--color-ink);
          line-height: 1.2;
        }

        .kp-role {
          font-size: 0.7rem;
          color: var(--color-ink-subtle);
        }
      `}</style>

      <div className="kp-label">👥 Key Players</div>
      <div className="kp-list">
        {players.map((player, i) => (
          <div key={i} className="kp-chip">
            <div className="kp-avatar">
              {player.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
            <div className="kp-info">
              <span className="kp-name">{player.name}</span>
              <span className="kp-role">{player.role}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
