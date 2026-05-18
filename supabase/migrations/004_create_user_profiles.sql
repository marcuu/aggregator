-- Phase 1 (trajectory): user_profiles holds the onboarding answers and the
-- self-selected sector / trajectory tier that drive every projection.

create table public.user_profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  sector             text not null
                       check (sector in ('banking', 'law', 'stem', 'consulting', 'other')),
  trajectory_tier    text not null
                       check (trajectory_tier in ('steady', 'fast', 'high')),
  current_salary     integer not null
                       check (current_salary > 0 and current_salary < 1000000),
  date_of_birth      date,
  onboarding_complete boolean not null default false,
  onboarding_step    integer not null default 1
                       check (onboarding_step between 1 and 5),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "users can read own profile"
  on public.user_profiles for select
  using ((select auth.uid()) = user_id);

create policy "users can insert own profile"
  on public.user_profiles for insert
  with check ((select auth.uid()) = user_id);

create policy "users can update own profile"
  on public.user_profiles for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Reuse the existing hardened updated_at trigger (see 001_initial_schema.sql).
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();
