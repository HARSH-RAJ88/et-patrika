-- Extend pipeline_runs to track optional Agent 4 (translation worker).

alter table if exists public.pipeline_runs
  add column if not exists agent4_status text not null default 'pending',
  add column if not exists agent4_processed integer not null default 0;
