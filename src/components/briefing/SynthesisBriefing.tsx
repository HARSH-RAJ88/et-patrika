'use client';

import React from 'react';

interface SynthesisBriefingProps {
  briefing: string;
  source: string;
}

export default function SynthesisBriefing({ briefing, source }: SynthesisBriefingProps) {
  const paragraphs = briefing.split('\n').filter((p) => p.trim().length > 0);

  // Pick a pull-quote from the second paragraph if available
  const pullQuoteSource = paragraphs.length > 1 ? paragraphs[1] : paragraphs[0] || '';
  const sentences = pullQuoteSource.split(/(?<=[.!?])\s+/);
  const pullQuote = sentences.length > 1 ? sentences[Math.min(1, sentences.length - 1)] : '';

  // Determine pull-quote insertion point
  const pullQuoteAfter = Math.min(1, paragraphs.length - 1);

  return (
    <section className="synthesis-section">
      <style>{`
        .synthesis-section {
          margin-bottom: 2.5rem;
        }

        .synthesis-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-brand);
          margin-bottom: 1.5rem;
        }

        .synthesis-label-line {
          flex: 1;
          height: 1px;
          background: var(--color-border);
        }

        .synthesis-body {
          font-size: 1.05rem;
          line-height: 1.85;
          color: var(--color-ink-secondary);
        }

        .synthesis-body p {
          margin-bottom: 1.25rem;
        }

        .synthesis-body p:first-of-type::first-letter {
          font-family: var(--font-headline);
          font-size: 3.5rem;
          font-weight: 700;
          float: left;
          line-height: 1;
          margin-right: 0.5rem;
          margin-top: 0.1rem;
          color: var(--color-ink);
        }

        .pull-quote {
          margin: 2rem 0;
          padding: 1.5rem 2rem;
          border-left: 4px solid var(--color-brand);
          background: var(--gradient-brand-soft);
          border-radius: 0 var(--radius-md) var(--radius-md) 0;
        }

        .pull-quote-text {
          font-family: var(--font-headline);
          font-size: 1.25rem;
          font-weight: 600;
          line-height: 1.5;
          color: var(--color-ink);
          font-style: italic;
        }

        .source-attribution {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid var(--color-border);
        }

        .source-attr-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-ink-subtle);
          margin-bottom: 0.5rem;
        }

        .source-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .source-chip {
          padding: 0.25rem 0.75rem;
          border-radius: var(--radius-full);
          background: var(--color-surface-muted);
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--color-ink-secondary);
        }
      `}</style>

      <div className="synthesis-label">
        <span>📋 The Full Picture</span>
        <div className="synthesis-label-line" />
      </div>

      <div className="synthesis-body">
        {paragraphs.map((p, i) => (
          <React.Fragment key={i}>
            <p>{p}</p>
            {i === pullQuoteAfter && pullQuote && (
              <div className="pull-quote">
                <p className="pull-quote-text">&ldquo;{pullQuote}&rdquo;</p>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="source-attribution">
        <div className="source-attr-label">Sources contributing to this synthesis</div>
        <div className="source-chips">
          <span className="source-chip">{source}</span>
          <span className="source-chip">ET Intelligence</span>
          <span className="source-chip">MediaNama</span>
          <span className="source-chip">Inc42</span>
        </div>
      </div>
    </section>
  );
}
