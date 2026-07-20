const { PermissionFlagsBits } = require('discord.js');
const { createSupabaseClient, getSupabaseConfig } = require('./lib/supabase');
const { detectUsedInvite, refreshInviteCache } = require('./lib/inviteCache');

function buildJoinRecord(member, usedInvite) {
  const record = {
    user_id: member.id,
    username: member.user.username,
    user_tag: member.user.tag,
    avatar_url: member.user.displayAvatarURL({ size: 128 }),
    guild_id: member.guild.id,
    guild_name: member.guild.name,
    joined_at: member.joinedAt?.toISOString() ?? new Date().toISOString(),
    tracked_at: new Date().toISOString(),
    join_method: usedInvite ? 'invite' : 'unknown',
    invite_code: null,
    invite_url: null,
    inviter_id: null,
    inviter_username: null,
    inviter_tag: null,
    inviter_avatar_url: null,
  };

  if (usedInvite) {
    record.invite_code = usedInvite.code;
    record.invite_url = usedInvite.url;
    record.inviter_id = usedInvite.inviter?.id ?? null;
    record.inviter_username = usedInvite.inviter?.username ?? null;
    record.inviter_tag = usedInvite.inviter?.tag ?? null;
    record.inviter_avatar_url = usedInvite.inviter?.displayAvatarURL({ size: 128 }) ?? null;
  }

  return record;
}

async function saveJoinRecord(record) {
  const config = getSupabaseConfig();
  if (!config) {
    return;
  }

  const supabase = createSupabaseClient(config);
  const { error } = await supabase.from(config.joinsTable).upsert(record, {
    onConflict: 'user_id,guild_id',
  });

  if (error) {
    console.error('[JoinTracker] Failed to save join record:', error.message);
  }
}

async function getJoinRecord(guildId, userId) {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  const supabase = createSupabaseClient(config);
  const { data, error } = await supabase
    .from(config.joinsTable)
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function startJoinTracker(client) {
  client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    const botMember = guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return;
    }

    try {
      const usedInvite = await detectUsedInvite(guild);
      const record = buildJoinRecord(member, usedInvite);
      await saveJoinRecord(record);

      if (usedInvite) {
        console.log(
          `[JoinTracker] ${member.user.tag} joined ${guild.name} via ${usedInvite.code} (${usedInvite.url})`,
        );
      } else {
        console.log(`[JoinTracker] ${member.user.tag} joined ${guild.name} (invite unknown)`);
      }
    } catch (error) {
      console.error(`[JoinTracker] Failed to track join for ${member.user.tag}:`, error.message);

      try {
        await refreshInviteCache(guild);
      } catch (refreshError) {
        console.error('[JoinTracker] Failed to refresh invite cache:', refreshError.message);
      }
    }
  });
}

module.exports = { startJoinTracker, getJoinRecord, buildJoinRecord };
