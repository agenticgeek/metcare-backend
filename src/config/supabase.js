const { createClient } = require('@supabase/supabase-js');

let client;

/**
 * Strip whitespace, wrapping quotes, and accidental "Bearer " from .env values.
 * Common causes of Supabase "Invalid API key": pasted quotes, trailing newline, wrong key type.
 */
function sanitizeEnv(value) {
  if (value == null) return '';
  let s = String(value).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (/^Bearer\s+/i.test(s)) {
    s = s.replace(/^Bearer\s+/i, '').trim();
  }
  return s;
}

function sanitizeUrl(value) {
  const s = sanitizeEnv(value);
  return s.replace(/\/+$/, '');
}

function getSupabase() {
  const url = sanitizeUrl(process.env.SUPABASE_URL);
  const serviceRoleKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Database is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (no extra quotes; use the service_role key from Supabase → Settings → API).'
    );
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      'SUPABASE_URL must start with https:// (copy Project URL from Supabase → Settings → API).'
    );
  }

  if (!serviceRoleKey.startsWith('eyJ')) {
    console.warn(
      '[supabase] SUPABASE_SERVICE_ROLE_KEY should look like a JWT (starts with eyJ). You may have pasted the wrong key or a truncated value.'
    );
  }

  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

module.exports = { getSupabase };
