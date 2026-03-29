-- Dedicated table for role-aware video key points shown on watch page
CREATE TABLE IF NOT EXISTS video_key_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'citizen',
  language text NOT NULL DEFAULT 'en',
  headline text NOT NULL,
  key_points jsonb NOT NULL DEFAULT '[]',
  script_id uuid REFERENCES video_scripts(id) ON DELETE SET NULL,
  source_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(article_id, role, language)
);

CREATE INDEX IF NOT EXISTS idx_video_key_points_article_role_lang
  ON video_key_points(article_id, role, language);

ALTER TABLE video_key_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_video_key_points"
  ON video_key_points FOR SELECT USING (true);
