'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import type { UserRole } from '@/types';

const ROLE_COLORS: Record<UserRole, string> = {
  student: '#2563EB',
  investor: '#059669',
  founder: '#7C3AED',
  citizen: '#D97706',
};

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Feed', icon: '📰' },
  { href: '/dashboard?view=trending', label: 'Trending', icon: '📊' },
  { href: '/dashboard?view=search', label: 'Search', icon: '🔍' },
  { href: '/onboarding', label: 'Profile', icon: '👤' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { userProfile } = useUser();

  const role: UserRole = userProfile?.role || (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('et_patrika_profile');
        if (stored) return JSON.parse(stored).role;
      } catch { /* ignore */ }
    }
    return 'citizen';
  })();

  const color = ROLE_COLORS[role];

  return (
    <nav className="bottom-nav">
      <style>{`
        .bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          height: 60px;
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
          box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
        }

        .bn-inner {
          display: flex;
          align-items: center;
          justify-content: space-around;
          height: 100%;
          max-width: 480px;
          margin: 0 auto;
        }

        .bn-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          padding: 0.375rem 0.75rem;
          text-decoration: none;
          font-size: 0.68rem;
          font-weight: 500;
          color: var(--color-ink-subtle);
          transition: all 0.15s ease;
          border-radius: var(--radius-sm);
        }

        .bn-item:hover {
          color: var(--color-ink-muted);
        }

        .bn-icon {
          font-size: 1.25rem;
          line-height: 1;
        }

        .bn-active {
          font-weight: 700;
        }

        .bn-active .bn-dot {
          display: block;
        }

        .bn-dot {
          display: none;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          margin-top: -0.125rem;
        }

        @media (max-width: 768px) {
          .bottom-nav {
            display: block;
          }
        }
      `}</style>

      <div className="bn-inner">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href === '/dashboard' && pathname?.startsWith('/dashboard'));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bn-item ${isActive ? 'bn-active' : ''}`}
              style={isActive ? { color } : {}}
            >
              <span className="bn-icon">{item.icon}</span>
              <span>{item.label}</span>
              <span className="bn-dot" style={{ background: color }} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
