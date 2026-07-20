const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  time,
  TimestampStyles,
} = require('discord.js');
const { parseInviteInput } = require('./lib/parseInviteInput');
const { getJoinRecord } = require('./joinTracker');

const commands = [
  new SlashCommandBuilder()
    .setName('checkinvites')
    .setDescription('Shows the top 10 inviters by invite uses (best link per user)'),
  new SlashCommandBuilder()
    .setName('track')
    .setDescription('Show how a user joined and which invite they used')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to track').setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName('user')
    .setDescription('Show all available information about a user')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to look up').setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Look up information about a Discord invite link')
    .addStringOption((option) =>
      option
        .setName('link')
        .setDescription('Invite code or URL (discord.gg / discord.com/invite)')
        .setRequired(true),
    ),
];

function requireAdmin(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return 'You need Administrator permission to use this command.';
  }

  return null;
}

async function handleCheckInvites(interaction) {
  const adminError = requireAdmin(interaction);
  if (adminError) {
    await interaction.reply({ content: adminError, ephemeral: true });
    return;
  }

  const botMember = interaction.guild.members.me;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: 'I need the **Manage Server** permission to read invite data.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const invites = await interaction.guild.invites.fetch();
    const bestInviteByInviter = new Map();

    for (const invite of invites.values()) {
      const inviter = invite.inviter;
      if (!inviter) {
        continue;
      }

      const existing = bestInviteByInviter.get(inviter.id);
      if (!existing || invite.uses > existing.uses) {
        bestInviteByInviter.set(inviter.id, {
          inviter,
          uses: invite.uses,
          url: invite.url,
        });
      }
    }

    const topInviters = [...bestInviteByInviter.values()]
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 10);

    if (topInviters.length === 0) {
      await interaction.editReply('No invite data found for this server.');
      return;
    }

    const lines = topInviters.map((entry, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      return `${medal} **${entry.inviter.tag}** — ${entry.uses} use${entry.uses === 1 ? '' : 's'}\n[${entry.url}](${entry.url})`;
    });

    const embed = new EmbedBuilder()
      .setTitle('Top 10 Inviters')
      .setColor(0x5865f2)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `${interaction.guild.name} • best link per user` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to fetch invites:', error);
    await interaction.editReply(
      'Failed to fetch invites. Make sure I have **Manage Server** permission and try again.',
    );
  }
}

function formatJoinMethod(record) {
  if (!record) {
    return 'No tracked join data yet. The bot only records joins after it is online with **Manage Server** permission.';
  }

  if (record.join_method === 'invite' && record.invite_url) {
    const inviter = record.inviter_tag ?? record.inviter_username ?? 'Unknown inviter';
    return `Joined via invite [${record.invite_code}](${record.invite_url}) by **${inviter}**`;
  }

  return 'Join method unknown (vanity URL, discovery, or joined before tracking started).';
}

async function handleTrack(interaction) {
  const adminError = requireAdmin(interaction);
  if (adminError) {
    await interaction.reply({ content: adminError, ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const target = interaction.options.getUser('user', true);
  let record = null;

  try {
    record = await getJoinRecord(interaction.guild.id, target.id);
  } catch (error) {
    console.error('Failed to fetch join record:', error);
    await interaction.editReply('Could not load join tracking data from the database.');
    return;
  }

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Join tracking — ${target.tag}`)
    .setThumbnail(target.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'User', value: `${target} (\`${target.id}\`)`, inline: false },
      {
        name: 'Joined server',
        value: member?.joinedAt
          ? time(member.joinedAt, TimestampStyles.RelativeTime)
          : record?.joined_at
            ? time(new Date(record.joined_at), TimestampStyles.RelativeTime)
            : 'Unknown',
        inline: true,
      },
      {
        name: 'Join method',
        value: formatJoinMethod(record),
        inline: false,
      },
    )
    .setTimestamp();

  if (record?.invite_code) {
    embed.addFields(
      { name: 'Invite code', value: `\`${record.invite_code}\``, inline: true },
      { name: 'Invite URL', value: record.invite_url ?? 'Unknown', inline: false },
    );
  }

  if (record?.inviter_id) {
    embed.addFields({
      name: 'Inviter',
      value: `${record.inviter_tag ?? record.inviter_username ?? 'Unknown'} (\`${record.inviter_id}\`)`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleUser(interaction) {
  const adminError = requireAdmin(interaction);
  if (adminError) {
    await interaction.reply({ content: adminError, ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const target = interaction.options.getUser('user', true);
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  let record = null;

  try {
    record = await getJoinRecord(interaction.guild.id, target.id);
  } catch (error) {
    console.error('Failed to fetch join record:', error);
  }

  const roles = member
    ? member.roles.cache
        .filter((role) => role.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => role.toString())
        .slice(0, 15)
        .join(', ') || 'None'
    : 'Not in server';

  const embed = new EmbedBuilder()
    .setColor(member?.displayColor || 0x5865f2)
    .setTitle(`User info — ${target.tag}`)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Username', value: target.username, inline: true },
      { name: 'Display name', value: member?.displayName ?? target.globalName ?? target.username, inline: true },
      { name: 'User ID', value: `\`${target.id}\``, inline: true },
      {
        name: 'Account created',
        value: time(target.createdAt, TimestampStyles.RelativeTime),
        inline: true,
      },
      {
        name: 'Joined server',
        value: member?.joinedAt
          ? time(member.joinedAt, TimestampStyles.RelativeTime)
          : 'Not in server',
        inline: true,
      },
      {
        name: 'Bot account',
        value: target.bot ? 'Yes' : 'No',
        inline: true,
      },
      { name: 'Roles', value: roles, inline: false },
      { name: 'Join tracking', value: formatJoinMethod(record), inline: false },
    )
    .setTimestamp();

  if (record) {
    embed.addFields(
      {
        name: 'Tracked at',
        value: time(new Date(record.tracked_at), TimestampStyles.RelativeTime),
        inline: true,
      },
      {
        name: 'Invite code',
        value: record.invite_code ? `\`${record.invite_code}\`` : 'N/A',
        inline: true,
      },
    );

    if (record.invite_url) {
      embed.addFields({ name: 'Invite URL', value: record.invite_url, inline: false });
    }

    if (record.inviter_tag || record.inviter_id) {
      embed.addFields({
        name: 'Inviter',
        value: `${record.inviter_tag ?? record.inviter_username ?? 'Unknown'}${record.inviter_id ? ` (\`${record.inviter_id}\`)` : ''}`,
        inline: false,
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleInvite(interaction, client) {
  const adminError = requireAdmin(interaction);
  if (adminError) {
    await interaction.reply({ content: adminError, ephemeral: true });
    return;
  }

  const input = interaction.options.getString('link', true);
  const code = parseInviteInput(input);

  if (!code) {
    await interaction.reply({
      content: 'Invalid invite input. Use an invite code or a `discord.gg` / `discord.com/invite` link.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const invite = await client.fetchInvite(code, { withCounts: true, withExpiration: true });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Invite — ${invite.code}`)
      .setURL(invite.url)
      .addFields(
        { name: 'Code', value: `\`${invite.code}\``, inline: true },
        { name: 'URL', value: invite.url, inline: false },
        { name: 'Uses', value: `${invite.uses ?? 0}`, inline: true },
        {
          name: 'Max uses',
          value: invite.maxUses ? `${invite.maxUses}` : 'Unlimited',
          inline: true,
        },
        {
          name: 'Temporary',
          value: invite.temporary ? 'Yes (kick after disconnect)' : 'No',
          inline: true,
        },
        {
          name: 'Expires',
          value: invite.expiresAt ? time(invite.expiresAt, TimestampStyles.RelativeTime) : 'Never',
          inline: true,
        },
        {
          name: 'Created',
          value: invite.createdAt ? time(invite.createdAt, TimestampStyles.RelativeTime) : 'Unknown',
          inline: true,
        },
        {
          name: 'Server',
          value: invite.guild ? `${invite.guild.name} (\`${invite.guild.id}\`)` : 'Unknown',
          inline: false,
        },
        {
          name: 'Channel',
          value: invite.channel ? `#${invite.channel.name} (\`${invite.channel.id}\`)` : 'Unknown',
          inline: false,
        },
        {
          name: 'Inviter',
          value: invite.inviter
            ? `${invite.inviter.tag} (\`${invite.inviter.id}\`)`
            : 'Unknown / widget',
          inline: false,
        },
      )
      .setTimestamp();

    if (invite.guild?.iconURL()) {
      embed.setThumbnail(invite.guild.iconURL({ size: 128 }));
    }

    if (invite.inviter) {
      embed.setAuthor({
        name: invite.inviter.tag,
        iconURL: invite.inviter.displayAvatarURL({ size: 128 }),
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to fetch invite:', error);
    await interaction.editReply(
      `Could not fetch invite \`${code}\`. It may be expired, invalid, or inaccessible.`,
    );
  }
}

async function handleInteraction(interaction, client) {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  switch (interaction.commandName) {
    case 'checkinvites':
      await handleCheckInvites(interaction);
      break;
    case 'track':
      await handleTrack(interaction);
      break;
    case 'user':
      await handleUser(interaction);
      break;
    case 'invite':
      await handleInvite(interaction, client);
      break;
    default:
      break;
  }
}

module.exports = { commands, handleInteraction };
