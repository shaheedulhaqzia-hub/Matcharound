-- Matcharound: operator moderation review (manual check of auto-bans).
-- Proof images live in the PRIVATE storage bucket 'moderation'
-- (Dashboard -> Storage -> moderation -> folder named by user id).

-- 1) Queue: all auto-bans waiting for review, newest first.
select b.id as ban_id, b.user_id, p.name, b.reason, b.source,
       b.score, b.proof_path, b.created_at
from public.bans b
join public.profiles p on p.id = b.user_id
where b.status = 'auto_banned'
order by b.created_at desc;

-- 2) UPHOLD a ban after checking the proof (replace <BAN_ID>):
-- update public.bans
--   set status = 'reviewed_upheld', reviewed_at = now(), review_note = 'confirmed nudity'
-- where id = '<BAN_ID>';

-- 3) UNBAN a user after checking the proof (replace <BAN_ID>):
-- with target as (
--   update public.bans
--     set status = 'reviewed_unbanned', reviewed_at = now(), review_note = 'false positive'
--   where id = '<BAN_ID>'
--   returning user_id
-- )
-- update public.profiles set banned = false where id in (select user_id from target);

-- 4) History of every ban decision:
select b.status, count(*) from public.bans b group by b.status;
