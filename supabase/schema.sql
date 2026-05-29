create extension if not exists pgcrypto;

create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  search_type text,
  company_domain text,
  company_name text,
  location text,
  duration_days integer,
  discipline text,
  title_filter_mode text,
  max_signal_lookups integer,
  boost_midas_mentions boolean not null default true,
  match_type text,
  mock_mode boolean not null default false,
  total_contacts_found integer not null default 0,
  job_changes_found integer not null default 0,
  high_priority_contacts integer not null default 0,
  credits_used integer,
  api_calls_used integer not null default 0,
  signal_lookups_requested integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  request jsonb not null default '{}'::jsonb,
  results jsonb not null default '[]'::jsonb
);

alter table public.search_runs
add column if not exists search_type text,
add column if not exists boost_midas_mentions boolean not null default true;

create index if not exists search_runs_created_at_idx on public.search_runs (created_at desc);
create index if not exists search_runs_company_domain_idx on public.search_runs (company_domain);
create index if not exists search_runs_company_name_idx on public.search_runs (company_name);

alter table public.search_runs enable row level security;

-- The app writes with SUPABASE_SERVICE_ROLE_KEY from server-side API routes.
-- Add user-facing RLS policies later if you build an authenticated search history UI.
-- Run supabase/migrations/create_midas_accounts.sql as the MIDAS account database migration.
