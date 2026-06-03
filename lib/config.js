// ─── Feature flags ────────────────────────────────────────────────────────────

/**
 * AUTH_ENABLED = true  → Supabase Auth; userId = auth.uid()
 * AUTH_ENABLED = false → dev-bypass; userId = NEXT_PUBLIC_DEV_USER_ID
 *
 * Step 2B: keep true, then enable RLS and migrate data.
 */
export const AUTH_ENABLED = true
