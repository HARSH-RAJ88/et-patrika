'use client';

import React from 'react';
import type { UserRole } from '@/types';

const ROLE_COLORS: Record<UserRole, string> = {
  student: '#2563EB',
  investor: '#059669',
  founder: '#7C3AED',
  citizen: '#D97706',
};

const ROLE_LABELS: Record<UserRole, string> = {
  student: 'students',
  investor: 'investors',
  founder: 'founders',
  citizen: 'citizens',
};

interface RelevanceBarProps {
  score: number;
  role: UserRole;
  compact?: boolean;
}

export default function RelevanceBar({ score, role, compact = false }: RelevanceBarProps) {
  const color = ROLE_COLORS[role] || '#6B7280';
  const percentage = Math.round(score * 100);
  const label = percentage >= 75 ? 'High' : percentage >= 45 ? 'Medium' : 'Low';

  return (
    <div className="relevance-bar-wrapper">
      <style>{`
        .relevance-bar-wrapper {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .relevance-track {
          flex: 1;
          height: ${compact ? '3px' : '4px'};
          background: var(--color-border);
          border-radius: 2px;
          overflow: hidden;
        }

        .relevance-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .relevance-label {
          font-size: ${compact ? '0.72rem' : '0.78rem'};
          font-weight: 500;
          white-space: nowrap;
        }
      `}</style>

      <div className="relevance-track">
        <div
          className="relevance-fill"
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
      <span className="relevance-label" style={{ color }}>
        {compact ? `${percentage}%` : `${label} for ${ROLE_LABELS[role]}`}
      </span>
    </div>
  );
}
