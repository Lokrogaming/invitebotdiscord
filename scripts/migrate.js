require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const password = process.env.SUPABASE_DB_PASSWORD?.trim();
const projectRef = process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!password || !projectRef) {
  console.error('Add these to your .env file:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_DB_PASSWORD=your_database_password');
  console.error('');
  console.error('Find the database password in Supabase → Project Settings → Database.');
  console.error('Or run supabase/migration_avatar_and_joins.sql manually in the SQL Editor.');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'supabase', 'migration_avatar_and_joins.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function main() {
  const client = new Client({
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  await client.query(sql);
  await client.end();

  console.log('Migration applied successfully.');
  console.log('Restart the bot to sync with inviter_avatar_url.');
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
