-- Track model token usage and estimated cost per stage.

create table if not exists public.ai_cost_events (
    id uuid primary key default gen_random_uuid(),
    run_id text,
    stage text not null,
    provider text not null,
    model text not null,
    article_id uuid references public.articles(id) on delete set null,
    video_job_id text,
    prompt_tokens integer not null default 0,
    completion_tokens integer not null default 0,
    total_tokens integer not null default 0,
    estimated_cost_usd numeric(12, 8) not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_ai_cost_events_stage_created
    on public.ai_cost_events (stage, created_at desc);

create index if not exists idx_ai_cost_events_run
    on public.ai_cost_events (run_id);
