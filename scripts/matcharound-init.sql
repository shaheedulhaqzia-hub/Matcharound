-- Matcharound: nearby profiles, matches, and chat (free Supabase).
-- Run this in Supabase -> SQL Editor -> New query.

create table if not exists public.profiles (
  id text primary key,
  name text not null,
  age integer not null,
  distance_km numeric not null default 0,
  city text not null default '',
  bio text not null default '',
  job text not null default '',
  interests text[] not null default '{}',
  photo text not null default '',
  online boolean not null default false,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  a_id text not null references public.profiles (id) on delete cascade,
  b_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (a_id, b_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references public.profiles (id) on delete cascade,
  from_me boolean not null default false,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

drop policy if exists "public read profiles" on public.profiles;
create policy "public read profiles"
  on public.profiles for select
  using (true);

drop policy if exists "public read matches" on public.matches;
create policy "public read matches"
  on public.matches for select
  using (true);

drop policy if exists "public write matches" on public.matches;
create policy "public write matches"
  on public.matches for insert
  with check (true);

drop policy if exists "public read messages" on public.messages;
create policy "public read messages"
  on public.messages for select
  using (true);

drop policy if exists "public write messages" on public.messages;
create policy "public write messages"
  on public.messages for insert
  with check (true);

insert into public.profiles (id, name, age, distance_km, city, bio, job, interests, photo, online, lat, lng)
values
  ('me', 'Alex', 28, 0, 'Lahore', 'Weekend walks, late coffee, and people who actually reply.', 'Product designer', array['Coffee','Walks','Design'], 'https://i.pravatar.cc/600?img=12', true, 31.5204, 74.3587),
  ('p1', 'Ava', 26, 0.4, 'Gulberg', 'Looking for someone nearby who can keep a conversation going.', 'Photographer', array['Film','Cafes','Travel'], 'https://i.pravatar.cc/700?img=47', true, 31.5204, 74.3587),
  ('p2', 'Noah', 29, 1.1, 'DHA Phase 5', 'Gym in the morning, rooftop sunsets after.', 'Software engineer', array['Fitness','Cooking','Jazz'], 'https://i.pravatar.cc/700?img=15', true, 31.4697, 74.4131),
  ('p3', 'Maya', 27, 2.3, 'Johar Town', 'Books, brunch, and no more hey. Tell me what you are listening to.', 'Architect', array['Design','Hiking','Poetry'], 'https://i.pravatar.cc/700?img=32', false, 31.4697, 74.2728),
  ('p4', 'Leo', 31, 3.6, 'Model Town', 'New in the area. Prefer meeting people who live close enough for a real date.', 'Chef', array['Food','Football','Vinyl'], 'https://i.pravatar.cc/700?img=13', true, 31.4820, 74.3230),
  ('p5', 'Zara', 25, 4.8, 'Bahria Town', 'Night owl, dog person, terrible at small talk until the second coffee.', 'Marketing', array['Dogs','Art','K-dramas'], 'https://i.pravatar.cc/700?img=45', true, 31.3700, 74.1850),
  ('p6', 'Omar', 30, 6.2, 'Cantt', 'If you are within 10 km, we can actually meet this week.', 'Doctor', array['Running','Travel','Board games'], 'https://i.pravatar.cc/700?img=11', false, 31.5100, 74.3800),
  ('p7', 'Hana', 24, 8.9, 'Township', 'Soft playlists and long walks. Video call first if that feels safer.', 'Student', array['Music','Skincare','Markets'], 'https://i.pravatar.cc/700?img=20', true, 31.4500, 74.3200),
  ('p8', 'Ryan', 33, 12.4, 'Raiwind Road', 'A bit farther out, but I drive. Looking for something easy and local.', 'Pilot', array['Flying','Coffee','Cinema'], 'https://i.pravatar.cc/700?img=33', false, 31.4000, 74.2500)
on conflict (id) do nothing;

insert into public.matches (a_id, b_id)
values ('me', 'p1')
on conflict do nothing;
