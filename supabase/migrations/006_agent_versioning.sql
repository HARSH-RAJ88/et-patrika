-- Add optimistic concurrency + agent attribution fields to shared bus tables.

alter table if exists public.articles
  add column if not exists version bigint not null default 1,
  add column if not exists updated_by_agent text,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.article_contexts
  add column if not exists version bigint not null default 1,
  add column if not exists updated_by_agent text;

alter table if exists public.story_arcs
  add column if not exists version bigint not null default 1,
  add column if not exists updated_by_agent text;
