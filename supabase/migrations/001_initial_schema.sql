-- Phase 2: core schema for the open banking aggregator.
-- RLS is enabled in 002_rls_policies.sql.

-- updated_at maintenance ---------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles -----------------------------------------------------------------
-- One row per auth user. Populated by the on-signup trigger below.

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ob_connections -----------------------------------------------------------
-- One row per bank the user has linked through TrueLayer.

create table public.ob_connections (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  provider_connection_id text not null,
  institution_name       text,
  status                 text not null default 'active'
                           check (status in ('active', 'expired', 'revoked')),
  last_synced_at         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, provider_connection_id)
);

create index ob_connections_user_id_idx on public.ob_connections (user_id);

create trigger ob_connections_set_updated_at
  before update on public.ob_connections
  for each row execute function public.set_updated_at();

-- ob_tokens ----------------------------------------------------------------
-- TrueLayer OAuth tokens. access_token / refresh_token are stored encrypted
-- at the application layer (see lib/truelayer/crypto.ts).

create table public.ob_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  connection_id uuid references public.ob_connections (id) on delete cascade,
  provider      text not null default 'truelayer',
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider)
);

create index ob_tokens_user_id_idx on public.ob_tokens (user_id);

create trigger ob_tokens_set_updated_at
  before update on public.ob_tokens
  for each row execute function public.set_updated_at();

-- ob_accounts --------------------------------------------------------------

create table public.ob_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  connection_id       uuid not null references public.ob_connections (id) on delete cascade,
  provider_account_id text not null,
  display_name        text,
  account_type        text,
  currency            text,
  current_balance     numeric(18, 2),
  available_balance   numeric(18, 2),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, provider_account_id)
);

create index ob_accounts_user_id_idx on public.ob_accounts (user_id);
create index ob_accounts_connection_id_idx on public.ob_accounts (connection_id);

create trigger ob_accounts_set_updated_at
  before update on public.ob_accounts
  for each row execute function public.set_updated_at();

-- ob_transactions ----------------------------------------------------------

create table public.ob_transactions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  account_id              uuid not null references public.ob_accounts (id) on delete cascade,
  provider_transaction_id text not null,
  amount                  numeric(18, 2) not null,
  currency                text,
  description             text,
  merchant_name           text,
  category                text,
  transaction_type        text,
  timestamp               timestamptz not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (account_id, provider_transaction_id)
);

create index ob_transactions_user_id_idx on public.ob_transactions (user_id);
create index ob_transactions_account_id_idx on public.ob_transactions (account_id);
create index ob_transactions_timestamp_idx
  on public.ob_transactions (user_id, timestamp desc);

create trigger ob_transactions_set_updated_at
  before update on public.ob_transactions
  for each row execute function public.set_updated_at();
