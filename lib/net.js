/**
 * lib/net.js — resilient network helpers for Supabase Auth calls.
 *
 * Problem: On iOS/WebKit and after Railway/Supabase cold starts, fetch can fail
 * with TypeError "Load failed" or "Failed to fetch". Supabase JS v2 wraps most
 * errors into { data, error } but some network failures arrive as thrown TypeErrors
 * or as error.message containing the raw fetch error string.
 *
 * Solution: authWithRetry() wraps a supabase auth call and:
 *   1. Catches thrown TypeErrors (WebKit style)
 *   2. Detects network-error strings in returned error.message
 *   3. Retries with exponential backoff (default: 2 retries, 1.2s / 2.4s)
 *   4. Always returns { data, error } — never throws — so callers stay clean
 */

// Strings that indicate a transient network failure worth retrying
const NETWORK_MSGS = [
  'load failed',
  'failed to fetch',
  'networkerror',
  'network request failed',
  'request timed out',
  'the internet connection appears to be offline',
]

export function isNetworkError(errOrMsg) {
  const raw = typeof errOrMsg === 'string'
    ? errOrMsg
    : (errOrMsg?.message ?? errOrMsg?.name ?? '')
  const lower = raw.toLowerCase()
  return NETWORK_MSGS.some(m => lower.includes(m))
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Wrap a supabase auth call with automatic retry on transient network errors.
 *
 * @param {() => Promise<{ data, error }>} fn  — zero-arg factory returning a supabase call
 * @param {{ retries?: number, baseDelay?: number }} opts
 * @returns {Promise<{ data: any, error: any }>}  — always resolves, never throws
 */
export async function authWithRetry(fn, { retries = 2, baseDelay = 1200 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn()

      // Supabase returns { data, error }
      if (result?.error && isNetworkError(result.error.message)) {
        if (attempt < retries) {
          await sleep(baseDelay * Math.pow(2, attempt))
          continue
        }
        // Exhausted retries — return with a friendly message
        return {
          data: result.data,
          error: { ...result.error, message: 'Ошибка соединения — проверьте интернет и попробуйте снова' },
        }
      }

      return result
    } catch (err) {
      // Thrown TypeError (WebKit "Load failed" style)
      if (isNetworkError(err) && attempt < retries) {
        await sleep(baseDelay * Math.pow(2, attempt))
        continue
      }
      // Normalize thrown error into supabase shape
      return {
        data: null,
        error: {
          message: isNetworkError(err)
            ? 'Ошибка соединения — проверьте интернет и попробуйте снова'
            : (err?.message ?? 'Что-то пошло не так'),
        },
      }
    }
  }
  return { data: null, error: { message: 'Ошибка соединения — проверьте интернет и попробуйте снова' } }
}

/**
 * Wrap supabase.auth.getSession() so it never hangs forever.
 * Returns null session on failure instead of throwing / never resolving.
 */
export async function getSessionSafe(supabase) {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session ?? null
  } catch {
    return null
  }
}
