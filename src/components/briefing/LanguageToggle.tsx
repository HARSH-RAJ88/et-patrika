'use client';

import React, { useState, useCallback } from 'react';
import type { SupportedLanguage } from '@/types';

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
  { code: 'ta', label: 'த' },
  { code: 'bn', label: 'বা' },
  { code: 'te', label: 'తె' },
];

interface LanguageToggleProps {
  current: SupportedLanguage;
  onChange: (lang: SupportedLanguage) => void;
  isLoading?: boolean;
}

export default function LanguageToggle({ current, onChange, isLoading }: LanguageToggleProps) {
  return (
    <div className="lang-toggle">
      <style>{`
        .lang-toggle {
          display: flex;
          align-items: center;
          gap: 2px;
          background: var(--color-surface-muted);
          border-radius: var(--radius-full);
          padding: 3px;
        }

        .lang-toggle-btn {
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-full);
          border: none;
          background: transparent;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--color-ink-muted);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-body);
          min-width: 30px;
          text-align: center;
        }

        .lang-toggle-btn:hover {
          color: var(--color-ink);
        }

        .lang-toggle-btn-active {
          background: var(--color-surface);
          color: var(--color-ink);
          box-shadow: var(--shadow-sm);
        }

        .lang-loading {
          opacity: 0.5;
          pointer-events: none;
        }
      `}</style>

      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          className={`lang-toggle-btn ${current === lang.code ? 'lang-toggle-btn-active' : ''} ${isLoading ? 'lang-loading' : ''}`}
          onClick={() => onChange(lang.code)}
          disabled={isLoading}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
