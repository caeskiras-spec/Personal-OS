/**
 * lib/booking/slots.js — pure slot-generation logic (no DB, no side effects).
 *
 * Timezone conversion without external libraries:
 * We use the "fake-UTC" trick: build a Date with the clock values in UTC,
 * then measure how far that UTC point is from the same clock values in the
 * target timezone, and apply the correction.
 */

/**
 * Convert a local date+time in a specific IANA timezone to a UTC Date.
 * @param {string} dateStr  - "YYYY-MM-DD"
 * @param {string} timeHHMM - "HH:MM" (24-hour)
 * @param {string} tz       - IANA timezone string, e.g. "Europe/Moscow"
 * @returns {Date}
 */
export function localToUTC(dateStr, timeHHMM, tz) {
  const [Y, Mo, D] = dateStr.split('-').map(Number)
  const [h, m]     = timeHHMM.split(':').map(Number)

  // Create a Date treating the given clock values as UTC (naive, no TZ adjustment)
  const naiveMs = Date.UTC(Y, Mo - 1, D, h, m, 0, 0)

  // Find what that UTC instant looks like in the target timezone
  const tzRepr = new Date(naiveMs).toLocaleString('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })

  // en-CA format: "YYYY-MM-DD, HH:MM:SS"
  const tzAsUTCMs = new Date(tzRepr.replace(', ', 'T') + 'Z').getTime()

  // Correction: naiveMs - tzAsUTCMs gives the TZ offset in ms
  return new Date(naiveMs + (naiveMs - tzAsUTCMs))
}

/**
 * Get weekday (0=Mon … 6=Sun) from a "YYYY-MM-DD" string.
 * Uses local date construction — safe because it's day-level granularity.
 */
export function getWeekday(dateStr) {
  const [Y, M, D] = dateStr.split('-').map(Number)
  return (new Date(Y, M - 1, D).getDay() + 6) % 7
}

/**
 * Generate all candidate time slots for a given date, then remove:
 *   - slots that have already passed (< now)
 *   - slots that overlap with any existing meeting
 *
 * @param {object} params
 * @param {string}   params.dateStr       - "YYYY-MM-DD" (in owner's TZ)
 * @param {Array}    params.rules         - availability_rules rows for this weekday
 *                                          [{ start_time: "HH:MM", end_time: "HH:MM" }]
 * @param {number}   params.durationMin   - slot length in minutes
 * @param {number}   params.bufferMin     - buffer between slots in minutes
 * @param {string}   params.tz            - owner's IANA timezone
 * @param {Array}    params.busyRanges    - [{ start_at: string|Date, end_at: string|Date }]
 *                                          existing confirmed meetings (UTC timestamps)
 * @param {Date}     params.now           - current UTC time (default: new Date())
 * @returns {Array}  [{ startISO, endISO }] — UTC ISO strings for each free slot
 */
export function generateSlots({
  dateStr,
  rules,
  durationMin,
  bufferMin = 0,
  tz,
  busyRanges = [],
  now = new Date(),
}) {
  const slots = []

  for (const rule of rules) {
    // Normalize time strings ("HH:MM:SS" or "HH:MM" → "HH:MM")
    const startHHMM = rule.start_time.substring(0, 5)
    const endHHMM   = rule.end_time.substring(0, 5)

    const windowStart = localToUTC(dateStr, startHHMM, tz)
    const windowEnd   = localToUTC(dateStr, endHHMM,   tz)

    const stepMs = (durationMin + bufferMin) * 60000
    let cursor   = new Date(windowStart)

    while (cursor < windowEnd) {
      const slotEnd = new Date(cursor.getTime() + durationMin * 60000)

      // Don't exceed the availability window
      if (slotEnd > windowEnd) break

      // Skip slots that are entirely in the past
      if (slotEnd <= now) {
        cursor = new Date(cursor.getTime() + stepMs)
        continue
      }

      // Check overlap with busy ranges — [cursor, slotEnd) ∩ [busy.start, busy.end) ≠ ∅
      const overlaps = busyRanges.some(r => {
        const bs = new Date(r.start_at)
        const be = new Date(r.end_at)
        return cursor < be && slotEnd > bs
      })

      if (!overlaps) {
        slots.push({
          startISO: cursor.toISOString(),
          endISO:   slotEnd.toISOString(),
        })
      }

      cursor = new Date(cursor.getTime() + stepMs)
    }
  }

  return slots
}
