-- Video Scripts table
-- Stores AI-generated broadcast scripts sourced from existing articles
CREATE TABLE IF NOT EXISTS video_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  role text DEFAULT 'general',
  style text DEFAULT 'standard',
  hook text NOT NULL,
  key_facts jsonb NOT NULL DEFAULT '[]',
  context_text text NOT NULL,
  closing text NOT NULL,
  full_script text NOT NULL,
  keywords text[] DEFAULT '{}',
  has_numbers boolean DEFAULT false,
  numbers_context text,
  estimated_duration_seconds integer,
  created_at timestamptz DEFAULT now()
);

-- Video Jobs table
-- Tracks every video generation request and its status
CREATE TABLE IF NOT EXISTS video_jobs (
  id text PRIMARY KEY,
  article_id uuid REFERENCES articles(id) ON DELETE SET NULL,
  script_id uuid REFERENCES video_scripts(id) ON DELETE SET NULL,
  source_mode text NOT NULL,
  source_url text,
  role text DEFAULT 'general',
  style text DEFAULT 'standard',
  status text DEFAULT 'queued',
  progress_percent integer DEFAULT 0,
  current_step text DEFAULT 'Queued',
  video_path text,
  video_filename text,
  duration_seconds float,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_article ON video_jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_scripts_article ON video_scripts(article_id);
CREATE INDEX IF NOT EXISTS idx_video_scripts_role ON video_scripts(article_id, role);

ALTER TABLE video_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_video_scripts" ON video_scripts FOR SELECT USING (true);
CREATE POLICY "public_read_video_jobs" ON video_jobs FOR SELECT USING (true);
