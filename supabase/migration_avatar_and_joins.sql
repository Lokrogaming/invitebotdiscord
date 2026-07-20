-- Run on existing databases to add avatar URLs and join tracking.

alter table public.invite_links
  add column if not exists inviter_avatar_url text;

create table if not exists public.member_joins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  username text,
  user_tag text,
  avatar_url text,
  guild_id text not null,
  guild_name text not null,
  join_method text not null default 'unknown',
  invite_code text,
  invite_url text,
  inviter_id text,
  inviter_username text,
  inviter_tag text,
  inviter_avatar_url text,
  joined_at timestamptz,
  tracked_at timestamptz not null default now(),
  unique (user_id, guild_id)
);

create index if not exists member_joins_guild_id_idx on public.member_joins (guild_id);
create index if not exists member_joins_user_id_idx on public.member_joins (user_id);

alter table public.member_joins enable row level security;

drop policy if exists "Public read access for member_joins" on public.member_joins;
create policy "Public read access for member_joins"
  on public.member_joins
  for select
  using (true);

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

grant select on public.member_joins to anon, authenticated;
grant select on public.invite_leaderboard to anon, authenticated;
