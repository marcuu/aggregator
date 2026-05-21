-- Separate user intent from engine prediction on goals.
--
-- `rough_target_date` previously meant two different things depending on when
-- you read it: at onboarding the engine's computed completion date clobbered
-- whatever the user entered, so the "do not start earlier than" floor in the
-- projection became a no-op. Split the two:
--   • rough_target_date   — user intent. Never overwritten by the engine.
--   • projected_target_date — engine output. Recomputed by the snapshot cron.

alter table public.goals
  add column if not exists projected_target_date date;

comment on column public.goals.rough_target_date is
  'User-stated target date (intent). Never overwritten by the trajectory engine.';
comment on column public.goals.projected_target_date is
  'Engine-projected completion date. Recomputed by the weekly snapshot cron.';
