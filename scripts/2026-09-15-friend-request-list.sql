-- Reliable incoming friend-request list (avoids fragile PostgREST embeds).
create or replace function public.incoming_friend_requests()
returns table (
  id uuid, from_id text, name text, photo text, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.from_id, p.name, p.photo, r.created_at
  from public.friend_requests r
  join public.profiles p on p.id = r.from_id
  where r.to_id = auth.uid()::text
    and r.status = 'pending'
  order by r.created_at desc;
$$;
grant execute on function public.incoming_friend_requests() to authenticated;
