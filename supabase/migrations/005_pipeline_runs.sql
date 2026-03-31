-- Pipeline orchestration run tracking
-- Adds run_id + per-stage status visibility for Agent 1/2/3.

create table if not exists public.pipeline_runs (
    id uuid primary key default gen_random_uuid(),
    run_id text not null unique,
    status text not null default 'running',
    dry_run boolean not null default false,
    article_limit integer,

    agent1_status text not null default 'pending',
    agent2_status text not null default 'pending',
    agent3_status text not null default 'pending',

    agent1_processed integer not null default 0,
    agent2_processed integer not null default 0,
    agent3_processed integer not null default 0,

    error_message text,
    metadata jsonb not null default '{}'::jsonb,

    started_at timestamptz not null default now(),
    completed_at timestamptz
);

create index if not exists idx_pipeline_runs_started_at
    on public.pipeline_runs (started_at desc);
