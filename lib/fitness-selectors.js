import { getTodayStr } from './tasks-selectors'

function localStr(d) {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

/** Returns the Monday of the current week as a Date */
function getWeekStartDate() {
  const today = new Date(getTodayStr() + 'T00:00:00')
  const dow   = today.getDay() // 0 = Sun
  today.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow))
  return today
}

/** Returns the Sunday of the current week as a Date */
function getWeekEndDate() {
  const start = getWeekStartDate()
  start.setDate(start.getDate() + 6)   // Mon + 6 = Sun
  return start
}

/** Returns the first day of the current month as YYYY-MM-DD */
function getMonthStartStr() {
  const today = new Date(getTodayStr() + 'T00:00:00')
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
}

/** Returns the last day of the current month as YYYY-MM-DD */
function getMonthEndStr() {
  const today = new Date(getTodayStr() + 'T00:00:00')
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return localStr(lastDay)
}

/**
 * Stats for the chosen period ('week' | 'month').
 * Returns { count, duration (min), calories }.
 * Uses slice(0,10) to guard against Supabase returning date+timezone suffixes.
 */
export function getStatsForPeriod(workouts, period = 'week') {
  const today = getTodayStr()
  const start = period === 'week'
    ? localStr(getWeekStartDate())
    : getMonthStartStr()
  // end = last day of current week (Sun) or current month
  const end = period === 'week' ? localStr(getWeekEndDate()) : getMonthEndStr()
  const filtered = workouts.filter(w => {
    const d = (w.date || '').slice(0, 10)
    return d >= start && d <= end
  })
  return {
    count:    filtered.length,
    duration: filtered.reduce((s, w) => s + (w.duration || 0), 0),
    calories: filtered.reduce((s, w) => s + (w.calories || 0), 0),
  }
}

/** Number of workouts in the current ISO week (Mon–Sun). */
export function getWeeklyCount(workouts) {
  const start = localStr(getWeekStartDate())
  const end   = localStr(getWeekEndDate())
  return workouts.filter(w => {
    const d = (w.date || '').slice(0, 10)
    return d >= start && d <= end
  }).length
}

/**
 * 35-day heatmap: { 'YYYY-MM-DD': boolean }
 * true = at least one workout on that day.
 */
export function buildWorkoutHeatmap(workouts, days = 35) {
  const dateSet = new Set(workouts.map(w => (w.date || '').slice(0, 10)))
  const today   = new Date(getTodayStr() + 'T00:00:00')
  const result  = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const s   = localStr(d)
    result[s] = dateSet.has(s)
  }
  return result
}

/**
 * Groups workouts by date (descending).
 * Returns [{ date: 'YYYY-MM-DD', workouts: Workout[] }].
 */
export function groupWorkoutsByDate(workouts) {
  const map = new Map()
  for (const w of workouts) {
    if (!map.has(w.date)) map.set(w.date, [])
    map.get(w.date).push(w)
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, ws]) => ({ date, workouts: ws }))
}

// ─── Calories API (for future Nutrition module) ───────────────────────────────

/**
 * Total calories burned on a specific date.
 * Usage in Nutrition: netCalories = eaten − getCaloriesBurnedByDate(workouts, date)
 */
export function getCaloriesBurnedByDate(workouts, date) {
  return workouts
    .filter(w => w.date === date && w.calories)
    .reduce((s, w) => s + (w.calories ?? 0), 0)
}

/**
 * Total calories burned in [from, to] inclusive (both 'YYYY-MM-DD').
 */
export function getCaloriesBurnedByDateRange(workouts, from, to) {
  return workouts
    .filter(w => w.date >= from && w.date <= to && w.calories)
    .reduce((s, w) => s + (w.calories ?? 0), 0)
}
