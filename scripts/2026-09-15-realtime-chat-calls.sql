-- Real 1:1 chat + call signaling (free Supabase realtime + WebRTC).
-- Run once in Supabase -> SQL Editor -> New query.

-- ============================================================
-- 1. Chat messages between two users
-- ============================================================
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  from_id text not null references public.profiles (id) on delete cascade,
  to_id text not null references public.profiles (id) on delete cascade,
  text text not null default '',
  image_url text,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
alter table public.chat_messages enable row level security;

drop policy if exists "read own chat" on public.chat_messages;
create policy "read own chat" on public.chat_messages
  for select to authenticated
  using (from_id = auth.uid()::text or to_id = auth.uid()::text);

drop policy if exists "send own chat" on public.chat_messages;
create policy "send own chat" on public.chat_messages
  for insert to authenticated
  with check (
    from_id = auth.uid()::text
    and not exists (select 1 from public.profiles pr where pr.id = auth.uid()::text and pr.banned)
  );

create index if not exists chat_messages_pair_idx
  on public.chat_messages (least(from_id, to_id), greatest(from_id, to_id), created_at desc);

-- ============================================================
-- 2. Calls + WebRTC signals
-- ============================================================
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  from_id text not null references public.profiles (id) on delete cascade,
  to_id text not null references public.profiles (id) on delete cascade,
  mode text not null default 'video',
  status text not null default 'ringing',
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (from_id <> to_id),
  check (mode in ('video', 'voice')),
  check (status in ('ringing', 'live', 'ended', 'declined'))
);
alter table public.calls enable row level security;

drop policy if exists "read own calls" on public.calls;
create policy "read own calls" on public.calls
  for select to authenticated
  using (from_id = auth.uid()::text or to_id = auth.uid()::text);

drop policy if exists "start own call" on public.calls;
create policy "start own call" on public.calls
  for insert to authenticated
  with check (from_id = auth.uid()::text);

drop policy if exists "update own calls" on public.calls;
create policy "update own calls" on public.calls
  for update to authenticated
  using (from_id = auth.uid()::text or to_id = auth.uid()::text);

create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  from_id text not null,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  check (kind in ('offer', 'answer', 'ice'))
);
alter table public.call_signals enable row level security;

drop policy if exists "read call signals" on public.call_signals;
create policy "read call signals" on public.call_signals
  for select to authenticated
  using (
    exists (
      select 1 from public.calls c
      where c.id = call_id
        and (c.from_id = auth.uid()::text or c.to_id = auth.uid()::text)
    )
  );

drop policy if exists "write call signals" on public.call_signals;
create policy "write call signals" on public.call_signals
  for insert to authenticated
  with check (
    from_id = auth.uid()::text
    and exists (
      select 1 from public.calls c
      where c.id = call_id
        and (c.from_id = auth.uid()::text or c.to_id = auth.uid()::text)
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.calls;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.call_signals;
exception when duplicate_object then null;
end $$;

-- Conversation list for the Chat tab
create or replace function public.my_conversations()
returns table (
  person_id text, name text, photo text, city text,
  last_text text, last_image boolean, last_at timestamptz, last_from_me boolean
)
language sql stable security definer set search_path = public
as $$
  with latest as (
    select distinct on (pair)
           case when from_id = auth.uid()::text then to_id else from_id end as person_id,
           text, image_url, created_at, from_id
    from (
      select *, least(from_id, to_id) || ':' || greatest(from_id, to_id) as pair
      from public.chat_messages
      where from_id = auth.uid()::text or to_id = auth.uid()::text
    ) m
    order by pair, created_at desc
  )
  select l.person_id, p.name, p.photo, p.city,
         l.text, (l.image_url is not null) as last_image,
         l.created_at, (l.from_id = auth.uid()::text) as last_from_me
  from latest l
  join public.profiles p on p.id = l.person_id
  where p.banned = false
  order by l.created_at desc
  limit 80;
$$;
grant execute on function public.my_conversations() to authenticated;
