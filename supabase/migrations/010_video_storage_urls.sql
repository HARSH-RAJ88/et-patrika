-- Persist externally hosted video URLs for stateless deployments (Vercel/Railway).

ALTER TABLE video_jobs
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS storage_path text;

-- Optional: ensure a public bucket exists for generated videos.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('videos', 'videos', true, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;
