create extension if not exists pgcrypto;

create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.search_runs
add column if not exists company_domain text,
add column if not exists search_type text,
add column if not exists company_name text,
add column if not exists location text,
add column if not exists duration_days integer,
add column if not exists discipline text,
add column if not exists title_filter_mode text,
add column if not exists max_signal_lookups integer,
add column if not exists boost_midas_mentions boolean not null default true,
add column if not exists match_type text,
add column if not exists mock_mode boolean not null default false,
add column if not exists total_contacts_found integer not null default 0,
add column if not exists job_changes_found integer not null default 0,
add column if not exists high_priority_contacts integer not null default 0,
add column if not exists credits_used integer,
add column if not exists api_calls_used integer not null default 0,
add column if not exists signal_lookups_requested integer not null default 0,
add column if not exists warnings jsonb not null default '[]'::jsonb,
add column if not exists request jsonb not null default '{}'::jsonb,
add column if not exists results jsonb not null default '[]'::jsonb;

create index if not exists search_runs_created_at_idx on public.search_runs (created_at desc);
create index if not exists search_runs_company_domain_idx on public.search_runs (company_domain);
create index if not exists search_runs_company_name_idx on public.search_runs (company_name);

alter table public.search_runs enable row level security;

-- Server-side API routes use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- Add authenticated user policies later if you expose direct browser access.
