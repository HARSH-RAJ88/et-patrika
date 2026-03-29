'use client';

import React from 'react';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'Startups', label: 'Startups' },
  { id: 'Policy', label: 'Policy' },
  { id: 'Markets', label: 'Markets' },
  { id: 'Tech', label: 'Tech' },
  { id: 'Global', label: 'Global' },
  { id: 'Finance', label: 'Finance' },
  { id: 'Science', label: 'Science' },
];

interface CategoryTabsProps {
  active: string;
  onChange: (category: string) => void;
}

export default function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="category-tabs">
      <style>{`
        .category-tabs {
          display: flex;
          gap: 0.375rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .category-tabs::-webkit-scrollbar { display: none; }

        .cat-tab {
          padding: 0.5rem 1.125rem;
          border-radius: var(--radius-full);
          font-family: var(--font-body);
          font-size: 0.85rem;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          border: 1.5px solid transparent;
          background: transparent;
          color: var(--color-ink-muted);
          transition: all 0.2s ease;
        }

        .cat-tab:hover {
          color: var(--color-ink);
          background: var(--color-surface-muted);
        }

        .cat-tab-active {
          background: var(--color-ink);
          color: var(--color-ink-inverse);
          border-color: var(--color-ink);
        }

        .cat-tab-active:hover {
          background: var(--color-ink-secondary);
          color: var(--color-ink-inverse);
        }
      `}</style>

      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          className={`cat-tab ${active === cat.id ? 'cat-tab-active' : ''}`}
          onClick={() => onChange(cat.id)}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
