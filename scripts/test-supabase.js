require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const table = process.env.SUPABASE_TABLE?.trim() || 'invite_links';

if (!url || !key || key === 'your_service_role_key_here') {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { count, error: countError } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Could not read invite_links:', countError.message);
    console.error('Did you run supabase/schema.sql in the Supabase SQL Editor?');
    process.exit(1);
  }

  const { data: sample, error: sampleError } = await supabase
    .from('invite_leaderboard')
    .select('guild_name, inviter_tag, uses, url')
    .order('uses', { ascending: false })
    .limit(3);

  if (sampleError) {
    console.error('Table works, but invite_leaderboard view is missing:', sampleError.message);
    console.error('Re-run the full supabase/schema.sql file.');
    process.exit(1);
  }

  console.log('Supabase connection OK');
  console.log(`Project: ${url}`);
  console.log(`Rows in ${table}: ${count ?? 0}`);
  console.log('Sample leaderboard rows:', sample);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
