'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ArticleContext, UserRole, SupportedLanguage } from '@/types';
import LanguageToggle from './LanguageToggle';

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

const ROLE_BG: Record<UserRole, string> = {
  student: '#EFF6FF',
  investor: '#ECFDF5',
  founder: '#F5F3FF',
  citizen: '#FFFBEB',
};

interface RolePanelProps {
  articleId: string;
  allContexts: ArticleContext[];
  initialRole: UserRole;
  eli5: string;
}

export default function RolePanel({ articleId, allContexts, initialRole, eli5 }: RolePanelProps) {
  const [activeRole, setActiveRole] = useState<UserRole>(initialRole);
  const [roleContexts, setRoleContexts] = useState<ArticleContext[]>(allContexts);
  const [activeContext, setActiveContext] = useState<ArticleContext | null>(
    allContexts.find((c) => c.role === initialRole) || allContexts[0] || null
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});

  useEffect(() => {
    setRoleContexts(allContexts);
    setActiveRole(initialRole);
    setActiveContext(allContexts.find((c) => c.role === initialRole) || allContexts[0] || null);
  }, [allContexts, initialRole]);

  const fetchRoleContext = useCallback(async (role: UserRole) => {
    try {
      const res = await fetch(`/api/article/${articleId}?role=${role}`);
      const data = await res.json();

      if (!res.ok || !data?.context) {
        return;
      }

      const fetched = data.context as ArticleContext;
      const normalized = {
        ...fetched,
        action_cards: typeof fetched.action_cards === 'string'
          ? JSON.parse(fetched.action_cards)
          : (fetched.action_cards || []),
      } as ArticleContext;

      setRoleContexts((prev) => {
        const exists = prev.some((ctx) => ctx.role === role);
        if (exists) {
          return prev.map((ctx) => (ctx.role === role ? normalized : ctx));
        }
        return [...prev, normalized];
      });
      setActiveContext(normalized);
    } catch {
      // Non-blocking: keep existing cached context if API fetch fails.
    }
  }, [articleId]);

  // Get context for current role
  const context = activeContext || roleContexts.find((c) => c.role === activeRole) || roleContexts[0];
  const color = ROLE_COLORS[activeRole];
  const bgColor = ROLE_BG[activeRole];

  // Parse action cards
  let actionCards = context?.action_cards || [];
  if (typeof actionCards === 'string') {
    try { actionCards = JSON.parse(actionCards); } catch { actionCards = []; }
  }

  const relevance = Math.round((context?.relevance_score || 0.5) * 100);

  // Role switch with transition
  const handleRoleSwitch = useCallback((role: UserRole) => {
    if (role === activeRole) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveRole(role);
      const nextContext = roleContexts.find((c) => c.role === role) || roleContexts[0] || null;
      setActiveContext(nextContext);
      setCurrentLang('en'); // Reset language on role switch
      setIsTransitioning(false);
      fetchRoleContext(role);
    }, 200);
  }, [activeRole, fetchRoleContext, roleContexts]);

  // Language translation
  const handleLanguageChange = useCallback(async (lang: SupportedLanguage) => {
    if (lang === 'en') {
      setCurrentLang('en');
      return;
    }

    const cacheKeyAnalogy = `${lang}_role_analogy_${activeRole}`;
    const cacheKeyWim = `${lang}_why_it_matters_${activeRole}`;

    // Check cache
    if (translationCache[cacheKeyAnalogy] && translationCache[cacheKeyWim]) {
      setCurrentLang(lang);
      return;
    }

    setIsTranslating(true);
    setCurrentLang(lang);

    try {
      // Translate both fields in parallel
      const [analogyRes, wimRes] = await Promise.all([
        !translationCache[cacheKeyAnalogy]
          ? fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: context?.role_analogy || '',
                targetLanguage: lang,
                articleId,
                fieldName: 'role_analogy',
              }),
            }).then(r => r.json())
          : Promise.resolve({ translatedText: translationCache[cacheKeyAnalogy] }),

        !translationCache[cacheKeyWim]
          ? fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: context?.why_it_matters || '',
                targetLanguage: lang,
                articleId,
                fieldName: 'why_it_matters',
              }),
            }).then(r => r.json())
          : Promise.resolve({ translatedText: translationCache[cacheKeyWim] }),
      ]);

      setTranslationCache((prev) => ({
        ...prev,
        [cacheKeyAnalogy]: analogyRes.translatedText,
        [cacheKeyWim]: wimRes.translatedText,
      }));
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  }, [activeRole, articleId, context?.role_analogy, context?.why_it_matters, translationCache]);

  // Get display text (translated or original)
  const displayAnalogy = currentLang !== 'en'
    ? translationCache[`${currentLang}_role_analogy_${activeRole}`] || context?.role_analogy || ''
    : context?.role_analogy || '';

  const displayWim = currentLang !== 'en'
    ? translationCache[`${currentLang}_why_it_matters_${activeRole}`] || context?.why_it_matters || ''
    : context?.why_it_matters || '';

  return (
    <aside className="role-panel">
      <style>{`
        .role-panel {
          position: sticky;
          top: 80px;
        }

        .role-panel-inner {
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: var(--shadow-md);
        }

        /* ─── Panel Header ─── */
        .rp-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .rp-header-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--color-ink-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* ─── Role Switcher ─── */
        .role-switcher {
          display: flex;
          gap: 4px;
          background: var(--color-surface-muted);
          border-radius: var(--radius-full);
          padding: 3px;
          width: 100%;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .role-switcher::-webkit-scrollbar { display: none; }

        .role-sw-btn {
          flex: 1 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          padding: 0.5rem 0.375rem;
          border: none;
          border-radius: var(--radius-full);
          background: transparent;
          font-family: var(--font-body);
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--color-ink-muted);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          white-space: nowrap;
        }

        .role-sw-btn:hover {
          color: var(--color-ink);
          background: rgba(255,255,255,0.5);
        }

        .role-sw-active {
          background: var(--color-surface);
          box-shadow: var(--shadow-sm);
        }

        /* ─── Panel Content ─── */
        .rp-content {
          padding: 1.5rem;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .rp-content-transitioning {
          opacity: 0;
          transform: translateY(8px);
        }

        /* ─── Role Analogy ─── */
        .rp-eli5-box {
          padding: 1rem;
          border-radius: var(--radius-md);
          margin-bottom: 1.5rem;
          font-size: 0.92rem;
          line-height: 1.6;
          color: var(--color-ink-secondary);
          font-style: italic;
        }

        .rp-eli5-label {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 0.5rem;
          font-style: normal;
        }

        /* ─── Why It Matters ─── */
        .rp-wim {
          padding: 1rem;
          border-radius: var(--radius-md);
          margin-bottom: 1.5rem;
          border-left: 4px solid;
        }

        .rp-wim-label {
          font-size: 0.82rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .rp-wim-text {
          font-size: 0.9rem;
          line-height: 1.65;
          color: var(--color-ink-secondary);
        }

        .rp-translating {
          opacity: 0.5;
        }

        /* ─── Action Cards ─── */
        .rp-actions-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--color-ink);
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .rp-action-card {
          padding: 1rem;
          background: var(--color-surface-muted);
          border-radius: var(--radius-md);
          margin-bottom: 0.625rem;
          transition: all 0.15s ease;
        }

        .rp-action-card:hover {
          box-shadow: var(--shadow-sm);
        }

        .rp-action-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--color-ink);
          margin-bottom: 0.25rem;
        }

        .rp-action-desc {
          font-size: 0.82rem;
          color: var(--color-ink-muted);
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        .rp-action-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          border: 1.5px solid;
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 600;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .rp-action-cta:hover {
          opacity: 0.8;
        }

        /* ─── What to Watch ─── */
        .rp-watch {
          margin-top: 1.5rem;
          padding: 1rem;
          border: 1.5px dashed var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface-muted);
        }

        .rp-watch-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--color-ink);
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .rp-watch-text {
          font-size: 0.85rem;
          line-height: 1.6;
          color: var(--color-ink-secondary);
        }

        /* ─── Relevance Ring ─── */
        .rp-relevance {
          margin-top: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--color-surface-muted);
          border-radius: var(--radius-md);
        }

        .rp-ring-svg {
          width: 56px;
          height: 56px;
          transform: rotate(-90deg);
          flex-shrink: 0;
        }

        .rp-ring-bg {
          fill: none;
          stroke: var(--color-border);
          stroke-width: 5;
        }

        .rp-ring-fill {
          fill: none;
          stroke-width: 5;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .rp-ring-label {
          font-size: 0.85rem;
          color: var(--color-ink-secondary);
        }

        .rp-ring-score {
          font-family: var(--font-headline);
          font-size: 1.25rem;
          font-weight: 700;
        }
      `}</style>

      <div className="role-panel-inner">
        {/* Header with role switcher + language toggle */}
        <div className="rp-header">
          <span className="rp-header-label">See this story as a...</span>
          <LanguageToggle
            current={currentLang}
            onChange={handleLanguageChange}
            isLoading={isTranslating}
          />
        </div>

        {/* Role Switcher */}
        <div style={{ padding: '0.75rem 1.5rem 0' }}>
          <div className="role-switcher">
            {ROLES.map((r) => (
              <button
                key={r.id}
                className={`role-sw-btn ${activeRole === r.id ? 'role-sw-active' : ''}`}
                onClick={() => handleRoleSwitch(r.id)}
                style={activeRole === r.id ? { color: ROLE_COLORS[r.id] } : {}}
              >
                <span>{r.emoji}</span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Panel Content (transitions on role switch) */}
        <div className={`rp-content ${isTransitioning ? 'rp-content-transitioning' : ''}`}>

          {/* Role Headline */}
          {context?.headline && (
            <div className="rp-wim" style={{ borderColor: color, background: bgColor, marginBottom: '1rem' }}>
              <div className="rp-wim-label" style={{ color }}>
                📰 Role Headline
              </div>
              <div className="rp-wim-text">{context.headline}</div>
            </div>
          )}

          {/* Role Analogy */}
          {displayAnalogy && (
            <div className="rp-eli5-box" style={{ background: bgColor }}>
              <div className="rp-eli5-label" style={{ color }}>
                🎭 {activeRole.charAt(0).toUpperCase() + activeRole.slice(1)}'s Perspective
              </div>
              <div className={isTranslating ? 'rp-translating' : ''}>
                "{displayAnalogy}"
              </div>
            </div>
          )}

          {/* Why It Matters */}
          {displayWim && (
            <div className="rp-wim" style={{ borderColor: color, background: bgColor }}>
              <div className="rp-wim-label" style={{ color }}>
                🎯 Why This Matters For You
              </div>
              <div className={`rp-wim-text ${isTranslating ? 'rp-translating' : ''}`}>
                {displayWim}
              </div>
            </div>
          )}

          {/* Action Cards */}
          {actionCards.length > 0 && (
            <div>
              <div className="rp-actions-label">⚡ Your Action Cards</div>
              {actionCards.map((card: { title: string; description: string; cta: string }, i: number) => (
                <div key={i} className="rp-action-card">
                  <div className="rp-action-title">{card.title}</div>
                  <div className="rp-action-desc">{card.description}</div>
                  <button
                    className="rp-action-cta"
                    style={{ borderColor: color, color }}
                  >
                    {card.cta} →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* What to Watch */}
          {context?.what_to_watch && (
            <div className="rp-watch">
              <div className="rp-watch-label">🔮 What To Watch</div>
              <div className="rp-watch-text">{context.what_to_watch}</div>
            </div>
          )}

          {/* Relevance Ring */}
          <div className="rp-relevance">
            <svg className="rp-ring-svg" viewBox="0 0 36 36">
              <circle className="rp-ring-bg" cx="18" cy="18" r="15.5" />
              <circle
                className="rp-ring-fill"
                cx="18" cy="18" r="15.5"
                stroke={color}
                strokeDasharray={`${relevance} ${100 - relevance}`}
                strokeDashoffset="0"
              />
            </svg>
            <div>
              <div className="rp-ring-score" style={{ color }}>{relevance}%</div>
              <div className="rp-ring-label">Relevance for {activeRole}s</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
