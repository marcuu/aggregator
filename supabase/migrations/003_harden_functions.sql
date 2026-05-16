-- Phase 2 follow-up: address security advisories on the helper functions.

-- Pin search_path so the trigger function cannot be hijacked.
alter function public.set_updated_at() set search_path = '';

-- handle_new_user is SECURITY DEFINER and only ever runs from the
-- on_auth_user_created trigger. Revoke EXECUTE so it is not callable as an
-- RPC by anon/authenticated clients.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
