const { createClient } = require('@supabase/supabase-js');

const PLACEHOLDER_KEYS = new Set(['your_service_role_key_here', 'your-service-role-key']);

function getSupabaseConfig() {
  if (process.env.SUPABASE_ENABLED !== 'true') {
    return null;
  }

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const table = process.env.SUPABASE_TABLE?.trim() || 'invite_links';
  const joinsTable = process.env.SUPABASE_JOINS_TABLE?.trim() || 'member_joins';

  if (!url || !key || PLACEHOLDER_KEYS.has(key)) {
    return null;
  }

  return { url, key, table, joinsTable };
}

function createSupabaseClient(config = getSupabaseConfig()) {
  if (!config) {
    return null;
  }

  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = { getSupabaseConfig, createSupabaseClient };
