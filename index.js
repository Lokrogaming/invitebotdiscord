require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { commands, handleInteraction } = require('./commands');
const { startJoinTracker } = require('./joinTracker');
const { initializeInviteCaches } = require('./lib/inviteCache');
const { startSupabaseSync } = require('./supabaseSync');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('Missing DISCORD_TOKEN in environment. Copy .env.example to .env and add your bot token.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await client.application.commands.set(commands);
  console.log(`Registered ${commands.length} slash command(s).`);

  await initializeInviteCaches(client);
  startJoinTracker(client);
  startSupabaseSync(client);
});

client.on('interactionCreate', (interaction) => handleInteraction(interaction, client));

client.login(token);
