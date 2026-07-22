require('dotenv').config();

const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { commands, handleInteraction } = require('./commands');
const { startJoinTracker } = require('./joinTracker');
const { initializeInviteCaches } = require('./lib/inviteCache');
const { startSupabaseSync, getInviteCount } = require('./supabaseSync');

const token = process.env.DISCORD_TOKEN;


// ===========================
// BOT EINSTELLUNGEN
// ===========================

const BOT_CONFIG = {
  status: "dnd", // online | idle | dnd | invisible

  presence: {
    type: ActivityType.Playing,
    text: "mit Lokrogamer Zählen im BKT",

    // Nur nötig bei Streaming:
    url: "https://twitch.tv/lokrogamer"
  }
};


// ===========================
// TOKEN CHECK
// ===========================

if (!token) {
  console.error('Missing DISCORD_TOKEN in environment.');
  process.exit(1);
}


// ===========================
// CLIENT
// ===========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
});


// ===========================
// READY
// ===========================


const PRESENCES = [
  {
    text: () => `${client.guilds.cache.size} Server`,
    type: ActivityType.Watching
  },
  {
    text: () => `${getInviteCount()} Invites`,
    type: ActivityType.Watching
  },
  {
    text: () => "Sharpfalcon1 nest https://discord.gg/fEb37gCvCc",
    type: ActivityType.Playing
  },
  {
    text: () => "Join our official server https://discord.gg/cMNg8B4cQN",
    type: ActivityType.Playing
  }
];

let currentPresence = 0;

function updatePresence() {
  const presence = PRESENCES[currentPresence];

  client.user.setPresence({
    status: BOT_CONFIG.status,
    activities: [
      {
        name: presence.text(),
        type: presence.type
      }
    ]
  });

  currentPresence++;

  if (currentPresence >= PRESENCES.length) {
    currentPresence = 0;
  }
}
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Systeme starten
  await initializeInviteCaches(client);
  startJoinTracker(client);
  startSupabaseSync(client);


  // Status setzen
  client.user.setPresence({
    status: BOT_CONFIG.status,
    activities: [
      {
        name: "Starting...",
        type: ActivityType.Playing
      }
    ]
  });


  // kurz warten, damit Supabase den ersten Sync machen kann
  setTimeout(() => {
    updatePresence();

    setInterval(updatePresence, 5 * 60 * 1000);
  }, 5000);


  console.log("Presence gesetzt.");


  // Commands registrieren
  await client.application.commands.set(commands);
  console.log(`Registered ${commands.length} slash command(s).`);
});


// ===========================
// INTERACTIONS
// ===========================

client.on('interactionCreate', (interaction) => {
  handleInteraction(interaction, client);
});


// ===========================
// LOGIN
// ===========================

client.login(token);