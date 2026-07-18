const { createClient } = require('@supabase/supabase-js');
const { PermissionFlagsBits } = require('discord.js');

const INSERT_CHUNK_SIZE = 500;

function getSupabaseConfig() {
  if (process.env.SUPABASE_ENABLED !== 'true') {
    return null;
  }

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const table = process.env.SUPABASE_TABLE?.trim() || 'invite_links';
  const placeholderKeys = new Set(['your_service_role_key_here', 'your-service-role-key']);

  if (!url || !key || placeholderKeys.has(key)) {
    console.warn(
      '[Supabase] SUPABASE_ENABLED=true but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Sync disabled.',
    );
    return null;
  }

  return { url, key, table };
}

async function collectInviteRows(discordClient) {
  const rows = [];
  const scannedAt = new Date().toISOString();

  for (const guild of discordClient.guilds.cache.values()) {
    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      continue;
    }

    try {
      const invites = await guild.invites.fetch();

      for (const invite of invites.values()) {
        rows.push({
          invite_code: invite.code,
          url: invite.url,
          uses: invite.uses ?? 0,
          max_uses: invite.maxUses,
          temporary: invite.temporary ?? false,
          inviter_id: invite.inviter?.id ?? null,
          inviter_username: invite.inviter?.username ?? null,
          inviter_tag: invite.inviter?.tag ?? null,
          guild_id: guild.id,
          guild_name: guild.name,
          channel_id: invite.channelId ?? invite.channel?.id ?? null,
          channel_name: invite.channel?.name ?? null,
          invite_created_at: invite.createdAt?.toISOString() ?? null,
          expires_at: invite.expiresAt?.toISOString() ?? null,
          scanned_at: scannedAt,
        });
      }
    } catch (error) {
      console.error(
        `[Supabase] Failed to fetch invites for ${guild.name} (${guild.id}):`,
        error.message,
      );
    }
  }

  return rows;
}

async function syncInvitesToSupabase(discordClient, config, supabase) {
  const rows = await collectInviteRows(discordClient);

  console.log(
    `[Supabase] Collected ${rows.length} invite link(s) across ${discordClient.guilds.cache.size} server(s).`,
  );

  const { error: deleteError } = await supabase.from(config.table).delete().not('guild_id', 'is', null);
  if (deleteError) {
    throw deleteError;
  }

  if (rows.length === 0) {
    console.log('[Supabase] Sync complete. Table cleared, no invite links to insert.');
    return;
  }

  for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + INSERT_CHUNK_SIZE);
    const { error: insertError } = await supabase.from(config.table).insert(chunk);
    if (insertError) {
      throw insertError;
    }
  }

  console.log(`[Supabase] Sync complete. Wrote ${rows.length} row(s).`);
}

function startSupabaseSync(discordClient) {
  const config = getSupabaseConfig();
  if (!config) {
    console.log('[Supabase] Sync disabled. Set SUPABASE_ENABLED=true in .env to enable.');
    return;
  }

  const supabase = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const intervalMinutes = Number.parseInt(process.env.SUPABASE_SCAN_INTERVAL_MINUTES || '30', 10);
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  let syncInProgress = false;

  async function runSync() {
    if (syncInProgress) {
      console.log('[Supabase] Sync already in progress, skipping.');
      return;
    }

    syncInProgress = true;
    try {
      await syncInvitesToSupabase(discordClient, config, supabase);
    } catch (error) {
      console.error('[Supabase] Sync failed:', error.message);
    } finally {
      syncInProgress = false;
    }
  }

  runSync();
  setInterval(runSync, intervalMs);
  console.log(`[Supabase] Sync enabled. Running on startup and every ${intervalMinutes} minute(s).`);
}

module.exports = { startSupabaseSync };
