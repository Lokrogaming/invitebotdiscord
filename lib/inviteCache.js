const { PermissionFlagsBits } = require('discord.js');

const inviteCaches = new Map();

async function refreshInviteCache(guild) {
  const invites = await guild.invites.fetch();
  const cache = new Map();

  for (const invite of invites.values()) {
    cache.set(invite.code, invite.uses ?? 0);
  }

  inviteCaches.set(guild.id, cache);
  return cache;
}

async function detectUsedInvite(guild) {
  const previousCache = inviteCaches.get(guild.id) ?? new Map();
  const invites = await guild.invites.fetch();
  const nextCache = new Map();
  let usedInvite = null;

  for (const invite of invites.values()) {
    const nextUses = invite.uses ?? 0;
    const previousUses = previousCache.get(invite.code) ?? 0;

    if (nextUses > previousUses && !usedInvite) {
      usedInvite = invite;
    }

    nextCache.set(invite.code, nextUses);
  }

  inviteCaches.set(guild.id, nextCache);
  return usedInvite;
}

async function initializeInviteCaches(client) {
  for (const guild of client.guilds.cache.values()) {
    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      continue;
    }

    try {
      await refreshInviteCache(guild);
    } catch (error) {
      console.error(`[InviteCache] Failed to cache invites for ${guild.name}:`, error.message);
    }
  }
}

module.exports = {
  refreshInviteCache,
  detectUsedInvite,
  initializeInviteCaches,
};
