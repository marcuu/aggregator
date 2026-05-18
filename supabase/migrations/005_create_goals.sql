-- Phase 1 (trajectory): goals. A user holds at most two active goals; the
-- limit is enforced in the database so the UI can never create a third.

create table public.goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  type              text not null
                      check (type in ('home', 'wedding', 'emergency_fund', 'invest_start')),
  target_amount     integer not null check (target_amount > 0),
  target_region     text,
  deposit_pct       integer check (deposit_pct between 5 and 50),
  rough_target_date date,
  saved_amount      integer not null default 0 check (saved_amount >= 0),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index goals_user_id_idx on public.goals (user_id);

alter table public.goals enable row level security;

create policy "users own their goals"
  on public.goals for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- One active goal per type per user.
create unique index goals_one_per_type_per_user
  on public.goals (user_id, type)
  where is_active = true;

-- Cap active goals at two per user.
create or replace function public.check_max_active_goals()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.goals
        where user_id = new.user_id and is_active = true) >= 2
     and (tg_op = 'INSERT'
          or (tg_op = 'UPDATE' and old.is_active = false and new.is_active = true))
  then
    raise exception 'Maximum 2 active goals per user';
  end if;
  return new;
end;
$$;

create trigger goals_max_active
  before insert or update on public.goals
  for each row execute function public.check_max_active_goals();

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();
