create table if not exists public.revealed_contact_details (
  contact_id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'Lusha',
  emails jsonb not null default '[]'::jsonb,
  phones jsonb not null default '[]'::jsonb,
  revealed_fields text[] not null default '{}'::text[],
  credits_used integer not null default 0,
  api_calls_used integer not null default 0
);

alter table public.revealed_contact_details
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now(),
add column if not exists source text not null default 'Lusha',
add column if not exists emails jsonb not null default '[]'::jsonb,
add column if not exists phones jsonb not null default '[]'::jsonb,
add column if not exists revealed_fields text[] not null default '{}'::text[],
add column if not exists credits_used integer not null default 0,
add column if not exists api_calls_used integer not null default 0;

create index if not exists revealed_contact_details_updated_at_idx
on public.revealed_contact_details (updated_at desc);

alter table public.revealed_contact_details enable row level security;

-- Server-side API routes use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
