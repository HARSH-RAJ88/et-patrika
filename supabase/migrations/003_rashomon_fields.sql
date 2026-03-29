ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS story_momentum text DEFAULT 'building',
  ADD COLUMN IF NOT EXISTS bharat_india_split text DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS conflict_index float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS role_headlines jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_concepts text[] DEFAULT '{}';

ALTER TABLE article_contexts
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS role_analogy text;
