import { createClient } from '@supabase/supabase-js'

// Lazy singleton — only instantiated on first access.
// Prevents next build from failing when SUPABASE_SERVICE_ROLE_KEY is absent at build time.
let _client = null

function getAdmin() {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY // server-only — no NEXT_PUBLIC prefix
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  _client = createClient(url, key)
  return _client
}

// Proxy so existing `supabaseAdmin.from(...)` call-sites keep working unchanged.
export const supabaseAdmin = new Proxy(
  {},
  { get(_t, prop) { return getAdmin()[prop] } }
)