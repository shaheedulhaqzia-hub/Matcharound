-- Matcharound: user-created groups. Anyone can request to join;
-- the group admin must accept before they become a member.
-- Run once in Supabase -> SQL Editor -> New query.

-- ============================================================
-- 1. Tables
-- ============================================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  city text not null default '',
  created_by text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (char_length(trim(name)) between 2 and 60)
);
alter table public.groups enable row level security;

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  role text not null default 'member', -- 'admin' | 'member'
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  check (role in ('admin', 'member'))
);
alter table public.group_members enable row level security;

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  status text not null default 'pending', -- 'pending' | 'accepted' | 'declined'
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (group_id, user_id),
  check (status in ('pending', 'accepted', 'declined'))
);
alter table public.group_join_requests enable row level security;

-- Discoverable groups (name/city/description only — no member list).
drop policy if exists "read groups" on public.groups;
create policy "read groups" on public.groups
  for select to authenticated
  using (true);

-- Members of a group can see who else is in it; anyone can see their own row.
drop policy if exists "read group members" on public.group_members;
create policy "read group members" on public.group_members
  for select to authenticated
  using (
    user_id = auth.uid()::text
    or exists (
      select 1 from public.group_members me
      where me.group_id = group_members.group_id
        and me.user_id = auth.uid()::text
    )
  );

-- You see your own join requests; admins see requests for their groups.
drop policy if exists "read join requests" on public.group_join_requests;
create policy "read join requests" on public.group_join_requests
  for select to authenticated
  using (
    user_id = auth.uid()::text
    or exists (
      select 1 from public.group_members me
      where me.group_id = group_join_requests.group_id
        and me.user_id = auth.uid()::text
        and me.role = 'admin'
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.group_join_requests;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 2. Helpers
-- ============================================================
create or replace function public.is_group_admin(p_group uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group
      and user_id = auth.uid()::text
      and role = 'admin'
  );
$$;

create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid()::text
  );
$$;

-- ============================================================
-- 3. Create a group (creator becomes the admin)
-- ============================================================
create or replace function public.create_group(
  p_name text,
  p_description text default '',
  p_city text default ''
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  gid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.profiles where id = uid and banned) then
    raise exception 'banned users cannot create groups';
  end if;
  if char_length(trim(p_name)) < 2 then
    raise exception 'Group name must be at least 2 characters.';
  end if;
  insert into public.groups (name, description, city, created_by)
  values (trim(p_name), coalesce(trim(p_description), ''), coalesce(trim(p_city), ''), uid)
  returning id into gid;
  insert into public.group_members (group_id, user_id, role)
  values (gid, uid, 'admin');
  return gid;
end;
$$;
grant execute on function public.create_group(text, text, text) to authenticated;

-- ============================================================
-- 4. Request to join (admin must accept)
-- ============================================================
create or replace function public.request_join_group(p_group uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  rid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.profiles where id = uid and banned) then
    raise exception 'banned users cannot join groups';
  end if;
  if not exists (select 1 from public.groups where id = p_group) then
    raise exception 'Group not found';
  end if;
  if exists (select 1 from public.group_members where group_id = p_group and user_id = uid) then
    raise exception 'You are already in this group';
  end if;
  insert into public.group_join_requests (group_id, user_id, status)
  values (p_group, uid, 'pending')
  on conflict (group_id, user_id) do update
    set status = 'pending',
        created_at = now(),
        responded_at = null
    where public.group_join_requests.status = 'declined'
  returning id into rid;
  if rid is null then
    select id into rid from public.group_join_requests
     where group_id = p_group and user_id = uid;
  end if;
  return rid;
end;
$$;
grant execute on function public.request_join_group(uuid) to authenticated;

-- ============================================================
-- 5. Admin accepts or declines a join request
-- ============================================================
create or replace function public.respond_join_request(p_request uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  rec public.group_join_requests;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into rec from public.group_join_requests where id = p_request;
  if rec.id is null then raise exception 'Request not found'; end if;
  if rec.status <> 'pending' then raise exception 'This request was already handled'; end if;
  if not public.is_group_admin(rec.group_id) then
    raise exception 'Only the group admin can accept or decline requests';
  end if;
  update public.group_join_requests
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_request;
  if p_accept then
    insert into public.group_members (group_id, user_id, role)
    values (rec.group_id, rec.user_id, 'member')
    on conflict do nothing;
  end if;
end;
$$;
grant execute on function public.respond_join_request(uuid, boolean) to authenticated;

-- ============================================================
-- 6. Leave / remove / delete
-- ============================================================
create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  admin_count integer;
  my_role text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select role into my_role from public.group_members
   where group_id = p_group and user_id = uid;
  if my_role is null then raise exception 'You are not in this group'; end if;
  if my_role = 'admin' then
    select count(*) into admin_count from public.group_members
     where group_id = p_group and role = 'admin';
    if admin_count <= 1 then
      raise exception 'You are the only admin. Delete the group instead, or wait until another admin is added.';
    end if;
  end if;
  delete from public.group_members where group_id = p_group and user_id = uid;
  delete from public.group_join_requests where group_id = p_group and user_id = uid;
end;
$$;
grant execute on function public.leave_group(uuid) to authenticated;

create or replace function public.remove_group_member(p_group uuid, p_user text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Only the group admin can remove members';
  end if;
  if p_user = auth.uid()::text then
    raise exception 'Use leave or delete to remove yourself';
  end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
  delete from public.group_join_requests where group_id = p_group and user_id = p_user;
end;
$$;
grant execute on function public.remove_group_member(uuid, text) to authenticated;

create or replace function public.delete_group(p_group uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Only the group admin can delete the group';
  end if;
  delete from public.groups where id = p_group;
end;
$$;
grant execute on function public.delete_group(uuid) to authenticated;

-- ============================================================
-- 7. Lists used by the app
-- ============================================================
create or replace function public.list_groups(p_search text default null)
returns table (
  id uuid, name text, description text, city text, created_at timestamptz,
  member_count bigint, pending_count bigint,
  my_role text, my_request text
)
language sql stable security definer set search_path = public
as $$
  select g.id, g.name, g.description, g.city, g.created_at,
         (select count(*) from public.group_members m where m.group_id = g.id) as member_count,
         (select count(*) from public.group_join_requests r
           where r.group_id = g.id and r.status = 'pending') as pending_count,
         (select m.role from public.group_members m
           where m.group_id = g.id and m.user_id = auth.uid()::text) as my_role,
         (select r.status from public.group_join_requests r
           where r.group_id = g.id and r.user_id = auth.uid()::text) as my_request
  from public.groups g
  where p_search is null or p_search = ''
     or g.name ilike '%' || p_search || '%'
     or g.city ilike '%' || p_search || '%'
  order by g.created_at desc
  limit 200;
$$;
grant execute on function public.list_groups(text) to authenticated;

create or replace function public.group_member_list(p_group uuid)
returns table (
  id text, name text, photo text, city text, role text, online boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_group_member(p_group) then
    raise exception 'Only members can see the member list';
  end if;
  return query
  select p.id, p.name, p.photo, p.city, m.role,
         (p.last_seen_at is not null and p.last_seen_at > now() - interval '2 minutes') as online
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  where m.group_id = p_group and p.banned = false
  order by case when m.role = 'admin' then 0 else 1 end, p.name;
end;
$$;
grant execute on function public.group_member_list(uuid) to authenticated;

create or replace function public.group_pending_requests(p_group uuid)
returns table (
  id uuid, user_id text, name text, photo text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Only the group admin can see join requests';
  end if;
  return query
  select r.id, r.user_id, p.name, p.photo, r.created_at
  from public.group_join_requests r
  join public.profiles p on p.id = r.user_id
  where r.group_id = p_group and r.status = 'pending'
  order by r.created_at desc;
end;
$$;
grant execute on function public.group_pending_requests(uuid) to authenticated;

-- Badge: pending join requests across groups I admin.
create or replace function public.my_group_admin_pending()
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer
  from public.group_join_requests r
  join public.group_members m
    on m.group_id = r.group_id
   and m.user_id = auth.uid()::text
   and m.role = 'admin'
  where r.status = 'pending';
$$;
grant execute on function public.my_group_admin_pending() to authenticated;
