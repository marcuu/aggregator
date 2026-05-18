-- Phase 1 (trajectory): trajectory_snapshots records weekly trajectory state
-- per goal. Written by the Phase 4 cron job with the service-role key and
-- powers the home-screen sparklines.

create table public.trajectory_snapshots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  goal_id         uuid not null references public.goals (id) on delete cascade,
  snapshot_date   date not null,
  trajectory_age  numeric(4, 1) not null,
  monthly_surplus integer not null,
  saved_amount    integer not null,
  spending_score  integer not null check (spending_score between 0 and 100),
  growth_score    integer not null check (growth_score between 0 and 100),
  borrowing_score integer not null check (borrowing_score between 0 and 100),
  created_at      timestamptz not null default now(),
  unique (goal_id, snapshot_date)
);

alter table public.trajectory_snapshots enable row level security;

create policy "users read own snapshots"
  on public.trajectory_snapshots for select
  using ((select auth.uid()) = user_id);

create policy "service role writes snapshots"
  on public.trajectory_snapshots for insert
  to service_role
  with check (true);

create index trajectory_snapshots_user_goal_date
  on public.trajectory_snapshots (user_id, goal_id, snapshot_date desc);
