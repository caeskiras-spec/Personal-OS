import { getTodayStr } from './tasks-selectors'

// ISO weekday: 1=Пн … 7=Вс
function isoWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay() // 0=Sun
  return dow === 0 ? 7 : dow
}

export function isScheduledToday(habit) {
  if (!habit || habit.schedule !== 'custom') return true
  const today = getTodayStr()
  return (habit.schedule_days ?? []).includes(isoWeekday(today))
}

function isScheduledDate(dateStr, schedule, scheduleDays) {
  if (schedule !== 'custom') return true
  return (scheduleDays ?? []).includes(isoWeekday(dateStr))
}

function localStr(d) {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

/**
 * completions: string[] of 'YYYY-MM-DD' dates (all-time, any order)
 * Returns { current, best }
 * A missed scheduled day breaks the streak; a non-scheduled day is transparent.
 * Today being incomplete does NOT break the current streak.
 */
export function computeStreaks(completions, schedule = 'daily', scheduleDays = []) {
  const set = new Set(completions)
  const today = getTodayStr()

  // ── current streak ──
  let current = 0

  // Count today first (if scheduled & done)
  if (isScheduledDate(today, schedule, scheduleDays) && set.has(today)) {
    current++
  }

  // Walk backwards from yesterday
  const cursor = new Date(today + 'T00:00:00')
  cursor.setDate(cursor.getDate() - 1)

  for (let i = 0; i < 730; i++) {
    const s = localStr(cursor)
    if (!isScheduledDate(s, schedule, scheduleDays)) {
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    if (set.has(s)) {
      current++
    } else {
      break
    }
    cursor.setDate(cursor.getDate() - 1)
  }

  // ── best streak ──
  if (completions.length === 0) return { current, best: current }

  const sorted = [...completions].sort()
  const start  = new Date(sorted[0] + 'T00:00:00')
  const end    = new Date(today + 'T00:00:00')

  let best = 0
  let run  = 0
  const fwd = new Date(start)

  while (fwd <= end) {
    const s = localStr(fwd)
    if (isScheduledDate(s, schedule, scheduleDays)) {
      if (set.has(s)) {
        run++
        if (run > best) best = run
      } else if (s !== today) {
        run = 0
      }
    }
    fwd.setDate(fwd.getDate() + 1)
  }

  return { current, best: Math.max(best, current) }
}

/**
 * Returns completions for the last N days as a map { 'YYYY-MM-DD': true }
 * filtered for the given habitId.
 */
export function buildHeatmapData(completions, days = 35) {
  const set = new Set(completions)
  const today = new Date(getTodayStr() + 'T00:00:00')
  const result = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const s = localStr(d)
    result[s] = set.has(s)
  }
  return result
}
