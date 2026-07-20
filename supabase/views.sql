-- Run this if invite_links exists but invite_leaderboard is missing.

create or replace view public.invite_leaderboard as
select distinct on (guild_id, inviter_id)
  id,
  invite_code,
  url,
  uses,
  max_uses,
  temporary,
  inviter_id,
  inviter_username,
  inviter_tag,
  inviter_avatar_url,
  inviter_avatar_url as avatar_url,
  guild_id,
  guild_name,
  channel_id,
  channel_name,
  invite_created_at,
  expires_at,
  scanned_at
from public.invite_links
where inviter_id is not null
order by guild_id, inviter_id, uses desc, invite_code;

grant select on public.invite_leaderboard to anon, authenticated;
