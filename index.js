require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');
const { startSupabaseSync } = require('./supabaseSync');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('Missing DISCORD_TOKEN in environment. Copy .env.example to .env and add your bot token.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const checkInvitesCommand = new SlashCommandBuilder()
  .setName('checkinvites')
  .setDescription('Shows the top 10 inviters by invite uses (best link per user)');

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await client.application.commands.set([checkInvitesCommand]);
  console.log('Registered /checkinvites slash command.');

  startSupabaseSync(client);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'checkinvites') {
    return;
  }

  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'You need Administrator permission to use this command.',
      ephemeral: true,
    });
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
});

client.login(token);
