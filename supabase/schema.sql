-- Run this in the Supabase SQL Editor before enabling the bot sync.
-- Lovable can read from invite_links using the anon key (SELECT policy below).

create table if not exists public.invite_links (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null,
  url text not null,
  uses integer not null default 0,
  max_uses integer,
  temporary boolean not null default false,
  inviter_id text,
  inviter_username text,
  inviter_tag text,
  guild_id text not null,
  guild_name text not null,
  channel_id text,
  channel_name text,
  invite_created_at timestamptz,
  expires_at timestamptz,
  scanned_at timestamptz not null default now()
);

create index if not exists invite_links_guild_id_idx on public.invite_links (guild_id);
create index if not exists invite_links_inviter_id_idx on public.invite_links (inviter_id);
create index if not exists invite_links_uses_idx on public.invite_links (uses desc);
create index if not exists invite_links_scanned_at_idx on public.invite_links (scanned_at desc);

alter table public.invite_links enable row level security;

drop policy if exists "Public read access for invite_links" on public.invite_links;
create policy "Public read access for invite_links"
  on public.invite_links
  for select
  using (true);

-- Best-performing invite link per inviter per server (matches /checkinvites logic).
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

grant select on public.invite_links to anon, authenticated;
grant select on public.invite_leaderboard to anon, authenticated;

-- The bot uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS for writes.
-- Lovable uses the anon/publishable key and reads invite_links or invite_leaderboard.
