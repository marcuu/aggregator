-- Phase 1 (trajectory): salary_benchmarks is static reference data mapping
-- sector x tier x age to percentile salaries. Seeded in 008.

create table public.salary_benchmarks (
  id         uuid primary key default gen_random_uuid(),
  sector     text not null
               check (sector in ('banking', 'law', 'stem', 'consulting', 'other')),
  tier       text not null check (tier in ('steady', 'fast', 'high')),
  age        integer not null check (age between 21 and 45),
  salary_p25 integer not null,
  salary_p50 integer not null,
  salary_p75 integer not null,
  unique (sector, tier, age)
);

-- Reference data: readable by any authenticated user, never user-scoped.
alter table public.salary_benchmarks enable row level security;

create policy "anyone authenticated can read benchmarks"
  on public.salary_benchmarks for select
  to authenticated
  using (true);
