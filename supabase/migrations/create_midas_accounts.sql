create extension if not exists pgcrypto;

create table if not exists public.midas_accounts (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  company_domain text,
  country text not null,
  relationship_status text not null check (
    relationship_status in ('Client', 'Former Client', 'Prospect', 'Partner', 'Unknown')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text
);

create index if not exists midas_accounts_company_name_idx on public.midas_accounts (company_name);
create index if not exists midas_accounts_company_domain_idx on public.midas_accounts (company_domain);
create index if not exists midas_accounts_country_idx on public.midas_accounts (country);
create index if not exists midas_accounts_relationship_status_idx on public.midas_accounts (relationship_status);

create unique index if not exists midas_accounts_domain_country_unique_idx
on public.midas_accounts (lower(company_domain), lower(country))
where company_domain is not null and company_domain <> '';

create unique index if not exists midas_accounts_name_country_unique_idx
on public.midas_accounts (lower(company_name), lower(country))
where company_domain is null or company_domain = '';

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists midas_accounts_set_updated_at on public.midas_accounts;
create trigger midas_accounts_set_updated_at
before update on public.midas_accounts
for each row
execute function public.set_updated_at();

alter table public.midas_accounts enable row level security;

-- MVP note:
-- The app uses SUPABASE_SERVICE_ROLE_KEY from server-side API routes for admin
-- inserts/updates/deletes. Add Supabase Auth and user-scoped RLS policies before
-- exposing direct browser writes.

insert into public.midas_accounts (company_name, company_domain, country, relationship_status)
values
  ('WSP', 'wsp.com', 'UK', 'Client'),
  ('Arcadis', 'arcadis.com', 'UK', 'Client'),
  ('Mott MacDonald', 'mottmac.com', 'UK', 'Client'),
  ('AtkinsRéalis', 'atkinsrealis.com', 'UK', 'Client'),
  ('Egis', 'egis-group.com', 'Hungary', 'Client'),
  ('Ramboll', 'ramboll.com', 'Ireland', 'Client'),
  ('COWI', 'cowi.com', 'Denmark', 'Prospect')
on conflict do nothing;
