'use client'

import { getTodayStr } from '../../../lib/tasks-selectors'
import { isScheduledToday } from '../../../lib/habits-selectors'

const DAYS_LABEL = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] // iso 1-7

function localStr(d) {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

function isoWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  return dow === 0 ? 7 : dow
}

function isScheduled(dateStr, schedule, scheduleDays) {
  if (schedule !== 'custom') return true
  return (scheduleDays ?? []).includes(isoWeekday(dateStr))
}

/**
 * Renders a 5-week (35 day) heatmap ending today.
 * completionDates: string[] of 'YYYY-MM-DD'
 * color: CSS color string (habit accent color)
 */
export default function HabitHeatmap({ completionDates = [], color = '#6c63ff', schedule = 'daily', scheduleDays = [] }) {
  const completionSet = new Set(completionDates)
  const today = getTodayStr()
  const todayDate = new Date(today + 'T00:00:00')

  // Build 35-day grid: 5 rows (weeks) × 7 cols (Mon-Sun)
  // Align so the last cell is today's weekday in the last column position
  const todayIso = isoWeekday(today) // 1-7
  const daysToShow = 35

  // Cells from oldest to newest
  const cells = []
  for (let i = daysToShow - 1; i >= 0; i--) {
    const d = new Date(todayDate)
    d.setDate(todayDate.getDate() - i)
    const s = localStr(d)
    const future = s > today
    const scheduled = isScheduled(s, schedule, scheduleDays)
    const done = completionSet.has(s)
    cells.push({ date: s, future, scheduled, done, iso: isoWeekday(s) })
  }

  // Group into weeks (rows of 7 starting Mon)
  // Pad the front so week rows align Mon-Sun
  const firstIso = cells[0].iso // 1-7
  const padFront = firstIso - 1 // how many empty cells before first real cell
  const padded = [...Array(padFront).fill(null), ...cells]
  const weeks = []
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7))
  }

  function cellStyle(cell) {
    if (!cell) return 'invisible'
    if (cell.future) return 'opacity-0 pointer-events-none'
    if (!cell.scheduled) return 'bg-muted/20 opacity-40'
    if (cell.done) return ''
    return 'bg-muted/30'
  }

  return (
    <div className="select-none">
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_LABEL.map(d => (
          <div key={d} className="text-center text-[9px] text-subtle">{d}</div>
        ))}
      </div>

      {/* Grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
          {week.map((cell, ci) => {
            if (!cell) return <div key={ci} className="h-5 rounded-sm" />
            const isToday = cell.date === today
            return (
              <div
                key={cell.date}
                title={cell.date}
                className={`h-5 rounded-sm transition-all ${cellStyle(cell)} ${isToday ? 'ring-1 ring-offset-1 ring-offset-bg' : ''}`}
                style={cell.done && cell.scheduled ? { backgroundColor: color, opacity: 0.85, ...(isToday ? { ringColor: color } : {}) } : {}}
              />
            )
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 justify-end">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted/30" />
          <span className="text-[9px] text-subtle">Пропущено</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.85 }} />
          <span className="text-[9px] text-subtle">Выполнено</span>
        </div>
      </div>
    </div>
  )
}
