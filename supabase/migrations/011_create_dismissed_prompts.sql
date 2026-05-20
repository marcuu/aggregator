-- Phase 5 (trajectory): records which contextual prompt cards a user has
-- dismissed. prompt_id is a deterministic hash of the card content, so a
-- dismissed card only reappears once the underlying data changes.
create table public.dismissed_prompts (
  user_id      uuid not null references auth.users(id) on delete cascade,
  prompt_id    text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, prompt_id)
);

alter table public.dismissed_prompts enable row level security;

create policy "users own dismissals"
  on public.dismissed_prompts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
