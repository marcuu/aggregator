-- Phase 2: row-level security. Every table is owner-scoped on user_id
-- (profiles on id). The anon/authenticated keys can only ever touch the
-- signed-in user's own rows; the service-role key bypasses RLS entirely.

alter table public.profiles        enable row level security;
alter table public.ob_connections  enable row level security;
alter table public.ob_tokens       enable row level security;
alter table public.ob_accounts     enable row level security;
alter table public.ob_transactions enable row level security;

-- profiles -----------------------------------------------------------------

create policy "Profiles are viewable by their owner"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Profiles are insertable by their owner"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "Profiles are updatable by their owner"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ob_connections -----------------------------------------------------------

create policy "Connections are selectable by their owner"
  on public.ob_connections for select
  using ((select auth.uid()) = user_id);

create policy "Connections are insertable by their owner"
  on public.ob_connections for insert
  with check ((select auth.uid()) = user_id);

create policy "Connections are updatable by their owner"
  on public.ob_connections for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Connections are deletable by their owner"
  on public.ob_connections for delete
  using ((select auth.uid()) = user_id);

-- ob_tokens ----------------------------------------------------------------

create policy "Tokens are selectable by their owner"
  on public.ob_tokens for select
  using ((select auth.uid()) = user_id);

create policy "Tokens are insertable by their owner"
  on public.ob_tokens for insert
  with check ((select auth.uid()) = user_id);

create policy "Tokens are updatable by their owner"
  on public.ob_tokens for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Tokens are deletable by their owner"
  on public.ob_tokens for delete
  using ((select auth.uid()) = user_id);

-- ob_accounts --------------------------------------------------------------

create policy "Accounts are selectable by their owner"
  on public.ob_accounts for select
  using ((select auth.uid()) = user_id);

create policy "Accounts are insertable by their owner"
  on public.ob_accounts for insert
  with check ((select auth.uid()) = user_id);

create policy "Accounts are updatable by their owner"
  on public.ob_accounts for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Accounts are deletable by their owner"
  on public.ob_accounts for delete
  using ((select auth.uid()) = user_id);

-- ob_transactions ----------------------------------------------------------

create policy "Transactions are selectable by their owner"
  on public.ob_transactions for select
  using ((select auth.uid()) = user_id);

create policy "Transactions are insertable by their owner"
  on public.ob_transactions for insert
  with check ((select auth.uid()) = user_id);

create policy "Transactions are updatable by their owner"
  on public.ob_transactions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Transactions are deletable by their owner"
  on public.ob_transactions for delete
  using ((select auth.uid()) = user_id);
