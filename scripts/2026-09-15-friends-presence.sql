-- Matcharound: friends, presence (online + last seen), contacts matching.
-- Run once in Supabase -> SQL Editor -> New query.

-- ============================================================
-- 1. Presence: heartbeat updates last_seen_at; online is derived
--    (last_seen_at within 2 minutes). Clients call heartbeat()
--    every minute while the app is open.
-- ============================================================
alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.heartbeat(p_lat double precision default null, p_lng double precision default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.profiles
     set last_seen_at = now(),
         online = true,
         lat = coalesce(p_lat, lat),
         lng = coalesce(p_lng, lng)
   where id = auth.uid()::text;
end;
$$;
grant execute on function public.heartbeat(double precision, double precision) to authenticated;

-- ============================================================
-- 2. Friend requests (unlimited) + friendships
--    status: 'pending' -> 'accepted' | 'declined'
-- ============================================================
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id text not null references public.profiles (id) on delete cascade,
  to_id text not null references public.profiles (id) on delete cascade,
  status text not null default 'pending', -- 'pending' | 'accepted' | 'declined'
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (from_id, to_id),
  check (from_id <> to_id),
  check (status in ('pending', 'accepted', 'declined'))
);
alter table public.friend_requests enable row level security;

drop policy if exists "see own friend requests" on public.friend_requests;
create policy "see own friend requests" on public.friend_requests
  for select to authenticated
  using (from_id = auth.uid()::text or to_id = auth.uid()::text);

drop policy if exists "send friend request" on public.friend_requests;
create policy "send friend request" on public.friend_requests
  for insert to authenticated
  with check (
    from_id = auth.uid()::text
    and not exists (select 1 from public.profiles pr where pr.id = auth.uid()::text and pr.banned)
  );

drop policy if exists "respond to friend request" on public.friend_requests;
create policy "respond to friend request" on public.friend_requests
  for update to authenticated
  using (to_id = auth.uid()::text)
  with check (to_id = auth.uid()::text);

-- Allow the sender to cancel a pending request.
drop policy if exists "cancel friend request" on public.friend_requests;
create policy "cancel friend request" on public.friend_requests
  for delete to authenticated
  using (from_id = auth.uid()::text and status = 'pending');

-- Realtime notifications for new friend requests.
do $$
begin
  alter publication supabase_realtime add table public.friend_requests;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 3. My friends with live presence + coordinates (for map + km)
-- ============================================================
create or replace function public.my_friends()
returns table (
  id text, name text, photo text, city text,
  lat double precision, lng double precision,
  online boolean, last_seen_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.photo, p.city, p.lat, p.lng,
         (p.last_seen_at is not null and p.last_seen_at > now() - interval '2 minutes') as online,
         p.last_seen_at
  from public.friend_requests fr
  join public.profiles p
    on p.id = case when fr.from_id = auth.uid()::text then fr.to_id else fr.from_id end
  where fr.status = 'accepted'
    and (fr.from_id = auth.uid()::text or fr.to_id = auth.uid()::text)
    and p.banned = false;
$$;
grant execute on function public.my_friends() to authenticated;

-- ============================================================
-- 4. Contacts matching: which phone numbers are on Matcharound?
--    Returns minimal public info + live online flag.
-- ============================================================
create or replace function public.find_by_phones(p_phones text[])
returns table (
  id text, name text, photo text, city text, phone text,
  online boolean
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.photo, p.city, p.phone,
         (p.last_seen_at is not null and p.last_seen_at > now() - interval '2 minutes') as online
  from public.profiles p
  where p.phone = any (p_phones)
    and p.banned = false
    and p.id <> coalesce(auth.uid()::text, 'me')
  limit 500;
$$;
grant execute on function public.find_by_phones(text[]) to authenticated;

-- ============================================================
-- 5. search_profiles: derive online from last_seen_at (live status)
-- ============================================================
create or replace function public.search_profiles(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision,
  p_gender text default null,
  p_min_age integer default 18,
  p_max_age integer default 120,
  p_city text default null
) returns table (
  id text, name text, age integer, gender text, city text, bio text, job text,
  interests text[], photo text, cover_url text, online boolean,
  distance_km double precision
)
language plpgsql stable
as $$
declare
  my_id text := coalesce(auth.uid()::text, 'me');
  my_gender text;
begin
  select p.gender into my_gender from public.profiles p where p.id = my_id;

  return query
  select p.id, p.name, p.age, p.gender, p.city, p.bio, p.job,
         p.interests, p.photo, p.cover_url,
         (p.last_seen_at is not null and p.last_seen_at > now() - interval '2 minutes') as online,
         (6371 * acos(least(1, greatest(-1,
           cos(radians(user_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(user_lng))
           + sin(radians(user_lat)) * sin(radians(p.lat))
         )))) as distance_km
  from public.profiles p
  where p.lat is not null and p.lng is not null
    and p.banned = false
    and p.id <> my_id
    and p.id <> 'me'
    and p.age between p_min_age and p_max_age
    and (p_gender is null or p.gender = p_gender)
    and (
      my_gender is null
      or p.interested_in = 'everyone'
      or (p.interested_in = 'women' and my_gender = 'woman')
      or (p.interested_in = 'men' and my_gender = 'man')
    )
    and (p_city is null or p_city = '' or p.city ilike '%' || p_city || '%')
    and (6371 * acos(least(1, greatest(-1,
          cos(radians(user_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(user_lng))
          + sin(radians(user_lat)) * sin(radians(p.lat))
        )))) <= radius_km
  order by distance_km asc
  limit 200;
end;
$$;
