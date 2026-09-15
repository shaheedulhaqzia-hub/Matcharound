-- Matcharound: gender (mandatory at sign-up) + pro match search.
-- search_profiles() supports: custom center (change location / choose country),
-- expandable radius, gender filter, age range, and city/area text search.
-- Run once in Supabase -> SQL Editor -> New query.

-- ============================================================
-- 1. Gender + preference on profiles
-- ============================================================
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists interested_in text not null default 'everyone';

alter table public.profiles drop constraint if exists profiles_gender_valid;
alter table public.profiles add constraint profiles_gender_valid
  check (gender is null or gender in ('woman', 'man', 'other'));

alter table public.profiles drop constraint if exists profiles_interested_valid;
alter table public.profiles add constraint profiles_interested_valid
  check (interested_in in ('women', 'men', 'everyone'));

-- Give demo rows genders so filtering demos nicely.
update public.profiles set gender = 'woman'
  where id in ('p1','p3','p5','p7') and gender is null;
update public.profiles set gender = 'man'
  where id in ('p2','p4','p6','p8') and gender is null;

-- ============================================================
-- 2. Pro search: center + radius + gender + age + city text
-- ============================================================
create or replace function public.search_profiles(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision,
  p_gender text default null,        -- 'woman' | 'man' | 'other' | null = everyone
  p_min_age integer default 18,
  p_max_age integer default 120,
  p_city text default null           -- matches city/area text, e.g. 'lahore'
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
         p.interests, p.photo, p.cover_url, p.online,
         (6371 * acos(least(1, greatest(-1,
           cos(radians(user_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(user_lng))
           + sin(radians(user_lat)) * sin(radians(p.lat))
         )))) as distance_km
  from public.profiles p
  where p.lat is not null and p.lng is not null
    and p.banned = false
    and p.id <> my_id
    and p.id <> 'me'
    -- age range
    and p.age between p_min_age and p_max_age
    -- gender the searcher wants
    and (p_gender is null or p.gender = p_gender)
    -- respect the other person's preference (lenient when unset)
    and (
      my_gender is null
      or p.interested_in = 'everyone'
      or (p.interested_in = 'women' and my_gender = 'woman')
      or (p.interested_in = 'men' and my_gender = 'man')
    )
    -- city / area text search
    and (p_city is null or p_city = '' or p.city ilike '%' || p_city || '%')
    -- distance
    and (6371 * acos(least(1, greatest(-1,
          cos(radians(user_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(user_lng))
          + sin(radians(user_lat)) * sin(radians(p.lat))
        )))) <= radius_km
  order by distance_km asc
  limit 200;
end;
$$;
grant execute on function public.search_profiles(
  double precision, double precision, double precision, text, integer, integer, text
) to authenticated, anon;
