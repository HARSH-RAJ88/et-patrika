-- Persistent per-article audit trail for each pipeline stage.

create table if not exists public.agent_runs (
    id uuid primary key default gen_random_uuid(),
    run_id text not null,
    article_id uuid references public.articles(id) on delete set null,
    stage text not null,
    status text not null,
    provider text,
    model text,
    latency_ms integer not null default 0,
    retry_count integer not null default 0,
    conflict_score numeric(4,3),
    error_message text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint agent_runs_status_check
        check (status in ('succeeded', 'failed', 'partial', 'skipped')),
    constraint agent_runs_latency_check
        check (latency_ms >= 0),
    constraint agent_runs_retry_check
        check (retry_count >= 0)
);

create index if not exists idx_agent_runs_run_stage
    on public.agent_runs (run_id, stage, created_at desc);

create index if not exists idx_agent_runs_article_stage
    on public.agent_runs (article_id, stage, created_at desc);

create index if not exists idx_agent_runs_status
    on public.agent_runs (status, created_at desc);
