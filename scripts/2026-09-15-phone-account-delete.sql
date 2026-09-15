-- Matcharound: phone numbers (one account per phone) + account deletion.
-- Run once in Supabase -> SQL Editor -> New query.
--
-- 1. profiles.phone  - stored normalized (+ and digits only, done by the app)
-- 2. one account per phone number (unique index)
-- 3. delete_me() RPC - Google Play requires in-app account deletion.
--    Banned users cannot delete their account (keeps moderation proof intact).

-- ============================================================
-- 1. Phone number on profiles
-- ============================================================
alter table public.profiles add column if not exists phone text;

-- One account per phone number (demo rows have null phone).
create unique index if not exists profiles_phone_unique
  on public.profiles (phone)
  where phone is not null and phone <> '';

-- ============================================================
-- 2. Account deletion (Google Play / Apple policy requirement)
-- ============================================================
create or replace function public.delete_me() returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = uid::text and banned) then
    raise exception 'This account is banned and pending review. Contact support to delete it.';
  end if;
  -- Removes the profile and (via cascade) posts, likes, follows, matches, messages.
  delete from public.profiles where id = uid::text;
  -- Removes the login itself (email + all linked social identities).
  delete from auth.users where id = uid;
end;
$$;
grant execute on function public.delete_me() to authenticated;
revoke execute on function public.delete_me() from anon, public;
