'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { showToast } from '@/components/ui/Toast';
import type { UserRole } from '@/types';

/* ─── Constants ───────────────────────────────────────────────── */

const ROLES: { id: UserRole; label: string; emoji: string }[] = [
  { id: 'student', label: 'Student', emoji: '🎓' },
  { id: 'investor', label: 'Investor', emoji: '📈' },
  { id: 'founder', label: 'Founder', emoji: '🚀' },
  { id: 'citizen', label: 'Citizen', emoji: '🌍' },
];

const ROLE_COLORS: Record<UserRole, string> = {
  student: '#2563EB',
  investor: '#059669',
  founder: '#7C3AED',
  citizen: '#D97706',
};

/* ─── Navbar ──────────────────────────────────────────────────── */

export default function Navbar() {
  const { userProfile, updateRole } = useUser();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const role: UserRole = userProfile?.role || 'citizen';
  const firstName = userProfile?.first_name || '';
  const isVideoStudio = pathname?.startsWith('/dashboard/video-studio');
  const isFeed = pathname === '/dashboard';

  const color = ROLE_COLORS[role];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleRoleSwitch = useCallback(async (newRole: UserRole) => {
    if (newRole === role) {
      setDropdownOpen(false);
      return;
    }

    setDropdownOpen(false);
    setMobileMenuOpen(false);
    try {
      await updateRole(newRole);
      showToast(`Switched to ${newRole.charAt(0).toUpperCase() + newRole.slice(1)} view`, 'success');
    } catch {
      showToast('Could not switch role right now. Please try again.', 'error');
    }
  }, [role, updateRole]);

  return (
    <>
      <style>{`
        .navbar {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          height: 56px;
          padding: 0 1.5rem;
          background: #E8132B;
          box-shadow: 0 2px 12px rgba(232, 19, 43, 0.25);
        }

        /* ─── Left: Logo ─── */
        .nav-left {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          flex-shrink: 0;
          text-decoration: none;
        }

        .nav-logo-img {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .nav-wordmark {
          font-family: var(--font-headline);
          font-size: 1.15rem;
          font-weight: 700;
          color: white;
          letter-spacing: -0.01em;
        }

        /* ─── Center: Search ─── */
        .nav-center {
          flex: 1;
          display: flex;
          justify-content: center;
          padding: 0 2rem;
        }

        .nav-search {
          width: 100%;
          max-width: 480px;
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: var(--radius-full);
          color: white;
          font-family: var(--font-body);
          font-size: 0.85rem;
          outline: none;
          transition: all 0.2s ease;
        }

        .nav-search::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }

        .nav-search:focus {
          background: rgba(255, 255, 255, 0.22);
          border-color: rgba(255, 255, 255, 0.4);
        }

        /* ─── Right: Controls ─── */
        .nav-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-shrink: 0;
        }

        .nav-mode-switch {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(255,255,255,0.14);
          border: 1px solid rgba(255,255,255,0.35);
          border-radius: var(--radius-full);
          padding: 0.2rem;
        }

        .nav-mode-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          padding: 0.35rem 0.75rem;
          border-radius: var(--radius-full);
          font-size: 0.78rem;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .nav-mode-feed {
          color: rgba(255,255,255,0.9);
        }

        .nav-mode-feed:hover {
          background: rgba(255,255,255,0.2);
          color: white;
        }

        .nav-mode-feed-active {
          background: white;
          color: #E8132B;
        }

        .nav-mode-video {
          border: 1.5px solid #E8132B;
          color: #E8132B;
          background: white;
        }

        .nav-mode-video:hover {
          opacity: 0.9;
        }

        .nav-mode-video-active {
          background: #E8132B;
          color: white;
          border-color: white;
        }

        /* Role Badge (Desktop) */
        .role-badge-wrap {
          position: relative;
        }

        .role-badge-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.35rem 0.875rem;
          border-radius: var(--radius-full);
          border: 1.5px solid;
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: capitalize;
          background: rgba(255,255,255,0.15);
          color: white;
          border-color: rgba(255,255,255,0.35);
        }

        .role-badge-btn:hover {
          background: rgba(255,255,255,0.25);
        }

        .role-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Role Dropdown */
        .role-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 220px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          animation: fadeIn 0.2s ease both;
          z-index: 200;
        }

        .role-dropdown-header {
          padding: 0.75rem 1rem 0.5rem;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-ink-subtle);
          border-bottom: 1px solid var(--color-border-subtle);
        }

        .role-dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          width: 100%;
          padding: 0.625rem 1rem;
          border: none;
          background: transparent;
          font-family: var(--font-body);
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--color-ink-secondary);
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .role-dropdown-item:hover {
          background: var(--color-surface-muted);
        }

        .role-dropdown-active {
          background: var(--color-surface-muted);
          font-weight: 700;
          color: var(--color-ink);
        }

        .role-dropdown-active::after {
          content: '✓';
          margin-left: auto;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .rdi-emoji {
          font-size: 1.1rem;
        }

        /* Notification Bell */
        .nav-bell {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(255,255,255,0.12);
          border: none;
          cursor: pointer;
          font-size: 1rem;
          transition: background 0.15s ease;
        }

        .nav-bell:hover {
          background: rgba(255,255,255,0.22);
        }

        /* Avatar */
        .nav-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.78rem;
          font-weight: 700;
          color: white;
          cursor: pointer;
          border: 2px solid rgba(255,255,255,0.4);
          transition: border-color 0.15s ease;
        }

        .nav-avatar:hover {
          border-color: white;
        }

        /* ─── Hamburger (Mobile) ─── */
        .nav-hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          padding: 4px;
          background: none;
          border: none;
          cursor: pointer;
        }

        .nav-hamburger span {
          display: block;
          width: 22px;
          height: 2px;
          background: white;
          border-radius: 1px;
          transition: all 0.25s ease;
        }

        .nav-hamburger-open span:nth-child(1) {
          transform: translateY(7px) rotate(45deg);
        }
        .nav-hamburger-open span:nth-child(2) {
          opacity: 0;
        }
        .nav-hamburger-open span:nth-child(3) {
          transform: translateY(-7px) rotate(-45deg);
        }

        /* ─── Mobile Menu ─── */
        .mobile-menu {
          display: none;
          position: fixed;
          top: 56px;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--color-surface);
          z-index: 99;
          padding: 1.5rem;
          animation: slideUp 0.3s ease both;
          overflow-y: auto;
        }

        .mobile-menu-open {
          display: block;
        }

        .mm-section-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-ink-subtle);
          margin-bottom: 0.75rem;
          margin-top: 1.5rem;
        }

        .mm-section-label:first-child {
          margin-top: 0;
        }

        .mm-role-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }

        .mm-role-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          font-family: var(--font-body);
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--color-ink-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mm-role-btn:hover {
          border-color: var(--color-ink-subtle);
        }

        .mm-role-active {
          font-weight: 700;
          color: var(--color-ink);
        }

        .mm-link {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.75rem 0;
          font-size: 1rem;
          font-weight: 500;
          color: var(--color-ink-secondary);
          text-decoration: none;
          border-bottom: 1px solid var(--color-border-subtle);
        }

        .mm-link:hover {
          color: var(--color-brand);
        }

        /* ─── Responsive ─── */
        @media (max-width: 768px) {
          .navbar { padding: 0 1rem; }
          .nav-center { display: none; }
          .nav-mode-switch { display: none; }
          .nav-right .role-badge-wrap,
          .nav-right .nav-bell,
          .nav-right .nav-avatar { display: none; }
          .nav-hamburger { display: flex; }
          .nav-wordmark { display: none; }
        }

        @media (min-width: 769px) {
          .mobile-menu { display: none !important; }
        }
      `}</style>

      <nav className="navbar">
        {/* Left: Logo */}
        <Link href="/dashboard" className="nav-left">
          <Image
            src="/logo.png"
            alt="ET Patrika"
            width={36}
            height={36}
            className="nav-logo-img"
            priority
          />
          <span className="nav-wordmark">ET Patrika</span>
        </Link>

        {/* Center: Search */}
        <div className="nav-center">
          <input
            type="text"
            className="nav-search"
            placeholder="Search topics, companies, or ask a question..."
            readOnly
          />
        </div>

        {/* Right: Controls */}
        <div className="nav-right">
          <div className="nav-mode-switch">
            <Link
              href="/dashboard"
              className={`nav-mode-btn nav-mode-feed ${isFeed ? 'nav-mode-feed-active' : ''}`}
            >
              Feed
            </Link>
            <Link
              href="/dashboard/video-studio"
              className={`nav-mode-btn nav-mode-video ${isVideoStudio ? 'nav-mode-video-active' : ''}`}
            >
              🎬 Video Studio
            </Link>
          </div>

          {/* Role Badge */}
          <div className="role-badge-wrap" ref={dropdownRef}>
            <button
              className="role-badge-btn"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{ borderColor: color }}
            >
              <span className="role-dot" style={{ background: color }} />
              {role}
              <span style={{ fontSize: '0.65rem', marginLeft: '0.125rem' }}>▼</span>
            </button>

            {dropdownOpen && (
              <div className="role-dropdown">
                <div className="role-dropdown-header">Switch perspective</div>
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    className={`role-dropdown-item ${r.id === role ? 'role-dropdown-active' : ''}`}
                    onClick={() => handleRoleSwitch(r.id)}
                  >
                    <span className="rdi-emoji">{r.emoji}</span>
                    <span
                      className="role-dot"
                      style={{ background: ROLE_COLORS[r.id] }}
                    />
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notification Bell */}
          <button className="nav-bell" title="Notifications">
            🔔
          </button>

          {/* User Avatar */}
          <Link href="/onboarding" className="nav-avatar" title="Preferences">
            {firstName ? firstName[0].toUpperCase() : '?'}
          </Link>

          {/* Mobile Hamburger */}
          <button
            className={`nav-hamburger ${mobileMenuOpen ? 'nav-hamburger-open' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
        <div className="mm-section-label">Your perspective</div>
        <div className="mm-role-grid">
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={`mm-role-btn ${r.id === role ? 'mm-role-active' : ''}`}
              onClick={() => handleRoleSwitch(r.id)}
              style={r.id === role ? { borderColor: ROLE_COLORS[r.id], background: `${ROLE_COLORS[r.id]}10` } : {}}
            >
              <span>{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>

        <div className="mm-section-label">Navigation</div>
        <Link href="/dashboard" className="mm-link" onClick={() => setMobileMenuOpen(false)}>
          📰 Intelligence Feed
        </Link>
        <Link href="/dashboard/video-studio" className="mm-link" onClick={() => setMobileMenuOpen(false)}>
          🎬 Video Studio
        </Link>
        <Link href="/onboarding" className="mm-link" onClick={() => setMobileMenuOpen(false)}>
          ⚙️ Preferences
        </Link>
      </div>
    </>
  );
}
