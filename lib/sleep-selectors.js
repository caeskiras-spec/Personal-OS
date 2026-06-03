import { getTodayStr } from './tasks-selectors'

/** Compute duration_minutes from bedtime/wake_time strings (HH:mm), handling midnight crossing */
export function calcDuration(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return 0
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeTime.split(':').map(Number)
  let mins = (wh * 60 + wm) - (bh * 60 + bm)
  if (mins <= 0) mins += 24 * 60  // crossed midnight
  return mins
}

/** Format minutes as "Xч Yм" */
export function fmtDuration(minutes) {
  if (!minutes || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}ч`
  return `${h}ч ${m}м`
}

/** Build 35-day heatmap { 'YYYY-MM-DD': { minutes, quality, ratio } } */
export function buildSleepHeatmap(entries, goalMinutes, days = 35) {
  const today     = getTodayStr()
  const todayDate = new Date(today + 'T00:00:00')
  const map = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayDate)
    d.setDate(todayDate.getDate() - i)
    const s = localStr(d)
    map[s] = { minutes: 0, quality: null, ratio: 0 }
  }
  for (const e of entries) {
    if (!(e.date in map)) continue
    map[e.date].minutes = e.durationMinutes ?? 0
    map[e.date].quality = e.quality ?? null
    const goal = goalMinutes > 0 ? goalMinutes : 480
    map[e.date].ratio = Math.min(map[e.date].minutes / goal, 1)
  }
  return map
}

/**
 * Average duration & quality for the given period.
 * period: 'week' = last 7 days ending today
 *         'month' = current calendar month (1st → today), local dates
 */
export function getAverages(entries, period = 'week') {
  const today     = getTodayStr()
  const todayDate = new Date(today + 'T00:00:00')
  let fromStr, toStr

  if (period === 'month') {
    const first = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
    fromStr = localStr(first)
    toStr   = today
  } else {
    // last 7 days including today
    const cutoff = new Date(todayDate)
    cutoff.setDate(todayDate.getDate() - 6)
    fromStr = localStr(cutoff)
    toStr   = today
  }

  const recent = entries.filter(e => e.date >= fromStr && e.date <= toStr)
  if (recent.length === 0) return { avgMinutes: 0, avgQuality: null, count: 0, from: fromStr, to: toStr }

  const withMins  = recent.filter(e => (e.durationMinutes ?? 0) > 0)
  const totalMins = withMins.reduce((s, e) => s + e.durationMinutes, 0)
  const avgMins   = withMins.length > 0 ? Math.round(totalMins / withMins.length) : 0

  const withQ    = recent.filter(e => e.quality != null)
  const avgQ     = withQ.length > 0 ? withQ.reduce((s, e) => s + e.quality, 0) / withQ.length : null

  return { avgMinutes: avgMins, avgQuality: avgQ, count: recent.length, from: fromStr, to: toStr }
}

export const SLEEP_COLOR = '#3b82f6'

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
