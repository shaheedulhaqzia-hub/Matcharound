-- Matcharound v2: real accounts, 18+ rule, photos, followers feed,
-- location matching, and nudity moderation with auto-ban + proof.
-- Run once in Supabase -> SQL Editor -> New query.

-- ============================================================
-- 1. Profiles: link to auth users, date of birth (18+), photos
-- ============================================================
alter table public.profiles add column if not exists dob date;
alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists banned boolean not null default false;
alter table public.profiles add column if not exists is_demo boolean not null default false;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

update public.profiles set is_demo = true where id in ('me','p1','p2','p3','p4','p5','p6','p7','p8');

-- 18+ is mandatory for real users (demo rows have null dob).
alter table public.profiles drop constraint if exists profiles_18_plus;
alter table public.profiles add constraint profiles_18_plus
  check (dob is null or dob <= (current_date - interval '18 years'));

-- Real users may create and edit ONLY their own profile row (id = auth uid).
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert to authenticated
  with check (id = auth.uid()::text);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update to authenticated
  using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

-- ============================================================
-- 2. Followers + gallery posts (photos go to followers feed)
-- ============================================================
create table if not exists public.follows (
  follower_id text not null references public.profiles (id) on delete cascade,
  followee_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.follows enable row level security;

drop policy if exists "read follows" on public.follows;
create policy "read follows" on public.follows for select using (true);

drop policy if exists "follow as self" on public.follows;
create policy "follow as self" on public.follows
  for insert to authenticated
  with check (
    follower_id = auth.uid()::text
    and not exists (select 1 from public.profiles pr where pr.id = auth.uid()::text and pr.banned)
  );

drop policy if exists "unfollow as self" on public.follows;
create policy "unfollow as self" on public.follows
  for delete to authenticated
  using (follower_id = auth.uid()::text);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null references public.profiles (id) on delete cascade,
  image_url text not null,
  caption text not null default '',
  moderation text not null default 'unchecked', -- 'checked_safe' | 'unchecked'
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;

drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts for select using (true);

drop policy if exists "post as self" on public.posts;
create policy "post as self" on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()::text
    and not exists (select 1 from public.profiles pr where pr.id = auth.uid()::text and pr.banned)
  );

drop policy if exists "delete own post" on public.posts;
create policy "delete own post" on public.posts
  for delete to authenticated
  using (author_id = auth.uid()::text);

-- ============================================================
-- 3. Real likes (mutual like = match)
-- ============================================================
create table if not exists public.likes (
  liker_id text not null references public.profiles (id) on delete cascade,
  liked_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id)
);
alter table public.likes enable row level security;

drop policy if exists "read own likes" on public.likes;
create policy "read own likes" on public.likes
  for select to authenticated
  using (liker_id = auth.uid()::text or liked_id = auth.uid()::text);

drop policy if exists "like as self" on public.likes;
create policy "like as self" on public.likes
  for insert to authenticated
  with check (
    liker_id = auth.uid()::text
    and not exists (select 1 from public.profiles pr where pr.id = auth.uid()::text and pr.banned)
  );

-- ============================================================
-- 4. Moderation: bans with saved proof for operator review
-- ============================================================
create table if not exists public.bans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles (id) on delete cascade,
  reason text not null,
  source text not null, -- 'chat_image' | 'gallery_image' | 'profile_photo' | 'cover_photo' | 'video_call_frame' | 'manual'
  proof_path text,      -- object path inside the private 'moderation' storage bucket
  score double precision,
  status text not null default 'auto_banned', -- 'auto_banned' | 'reviewed_upheld' | 'reviewed_unbanned'
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text
);
alter table public.bans enable row level security;

-- A banned user may see WHY they are banned (their own rows only).
drop policy if exists "read own bans" on public.bans;
create policy "read own bans" on public.bans
  for select to authenticated
  using (user_id = auth.uid()::text);

-- Auto-ban is executed through the ban_me() function below (security definer).
create or replace function public.ban_me(
  p_reason text,
  p_source text,
  p_proof_path text,
  p_score double precision
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  ban_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  insert into public.bans (user_id, reason, source, proof_path, score)
  values (uid, p_reason, p_source, p_proof_path, p_score)
  returning id into ban_id;
  update public.profiles set banned = true, updated_at = now() where id = uid;
  return ban_id;
end;
$$;
grant execute on function public.ban_me(text, text, text, double precision) to authenticated;

-- ============================================================
-- 5. Location matching: nearby profiles by true GPS distance
-- ============================================================
create or replace function public.nearby_profiles(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision
) returns table (
  id text, name text, age integer, city text, bio text, job text,
  interests text[], photo text, cover_url text, online boolean,
  distance_km double precision
)
language sql stable
as $$
  select p.id, p.name, p.age, p.city, p.bio, p.job,
         p.interests, p.photo, p.cover_url, p.online,
         (6371 * acos(least(1, greatest(-1,
           cos(radians(user_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(user_lng))
           + sin(radians(user_lat)) * sin(radians(p.lat))
         )))) as distance_km
  from public.profiles p
  where p.lat is not null and p.lng is not null
    and p.banned = false
    and p.id <> coalesce(auth.uid()::text, 'me')
    and p.id <> 'me'
    and (6371 * acos(least(1, greatest(-1,
          cos(radians(user_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(user_lng))
          + sin(radians(user_lat)) * sin(radians(p.lat))
        )))) <= radius_km
  order by distance_km asc
  limit 100;
$$;
grant execute on function public.nearby_profiles(double precision, double precision, double precision) to authenticated, anon;

-- ============================================================
-- 6. Storage buckets + policies
--    Public: avatars, covers, gallery, chat-images
--    Private (operator only): moderation  <- ban proof lives here
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('covers', 'covers', true),
  ('gallery', 'gallery', true),
  ('chat-images', 'chat-images', true),
  ('moderation', 'moderation', false)
on conflict (id) do nothing;

drop policy if exists "matcharound upload own folder" on storage.objects;
create policy "matcharound upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'covers', 'gallery', 'chat-images', 'moderation')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "matcharound update own folder" on storage.objects;
create policy "matcharound update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'gallery', 'chat-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "matcharound read public buckets" on storage.objects;
create policy "matcharound read public buckets" on storage.objects
  for select using (bucket_id in ('avatars', 'covers', 'gallery', 'chat-images'));
-- NOTE: no select policy for 'moderation' -> only the operator
-- (service role / dashboard) can view ban proof. Users cannot.
