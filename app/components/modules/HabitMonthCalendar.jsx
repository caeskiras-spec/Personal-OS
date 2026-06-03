'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getTodayStr } from '../../../lib/tasks-selectors'

// Same constants as DatePicker for locale consistency
const MONTHS   = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function localStr(d) {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

function isScheduledDate(dateStr, schedule, scheduleDays) {
  if (schedule !== 'custom') return true
  const d   = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  const iso = dow === 0 ? 7 : dow
  return (scheduleDays ?? []).includes(iso)
}

/**
 * Inline monthly calendar (read-only).
 * completionDates — string[] of 'YYYY-MM-DD'
 * color           — habit accent color
 * schedule        — 'daily' | 'custom'
 * scheduleDays    — int[] ISO weekdays 1=Пн…7=Вс
 */
export default function HabitMonthCalendar({
  completionDates = [],
  color           = '#6c63ff',
  schedule        = 'daily',
  scheduleDays    = [],
}) {
  const today     = getTodayStr()
  const todayDate = new Date(today + 'T00:00:00')

  const [viewing, setViewing] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })

  const completionSet = new Set(completionDates)

  const prevMonth = () => setViewing(v => {
    const m = v.month === 0 ? 11 : v.month - 1
    const y = v.month === 0 ? v.year - 1 : v.year
    return { year: y, month: m }
  })

  const nextMonth = () => setViewing(v => {
    const m = v.month === 11 ? 0 : v.month + 1
    const y = v.month === 11 ? v.year + 1 : v.year
    return { year: y, month: m }
  })

  // Build cells: null = padding, Date = real day
  const cells = (() => {
    const { year, month } = viewing
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7 // Mon = 0
    const lastDay  = new Date(year, month + 1, 0).getDate()
    const out = []
    for (let i = 0; i < firstDow; i++) out.push(null)
    for (let d = 1; d <= lastDay; d++) out.push(new Date(year, month, d))
    return out
  })()

  return (
    <div className="select-none">
      {/* Month navigation — same style as DatePicker */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 text-subtle hover:text-text transition-colors rounded"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-text">
          {MONTHS[viewing.month]} {viewing.year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 text-subtle hover:text-text transition-colors rounded"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Weekday headers — same style as DatePicker */}
      <div className="grid grid-cols-7 mb-0.5">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] text-subtle py-0.5">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="h-8" />

          const ds        = localStr(date)
          const done      = completionSet.has(ds)
          const isToday   = ds === today
          const isFuture  = date > todayDate
          const isPast    = date < todayDate
          const scheduled = isScheduledDate(ds, schedule, scheduleDays)
          const missed    = scheduled && isPast && !done

          return (
            <div key={ds} className="flex flex-col items-center gap-0.5 py-0.5">
              <div
                title={ds}
                className={`
                  w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-medium transition-colors
                  ${done
                    ? 'text-white'
                    : isToday
                    ? 'border border-accent/60 text-accent'
                    : !scheduled
                    ? 'text-subtle/30'
                    : isFuture
                    ? 'text-text/60'
                    : 'text-subtle'
                  }
                `}
                style={done ? { backgroundColor: color, opacity: 0.88 } : {}}
              >
                {date.getDate()}
              </div>

              {/* Missed scheduled day — small danger dot below the number */}
              {missed && (
                <div className="w-1 h-1 rounded-full bg-danger/50" />
              )}
              {/* Spacer to keep row height uniform when no dot */}
              {!missed && <div className="w-1 h-1" />}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 justify-end">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-danger/50" />
          <span className="text-[9px] text-subtle">Пропущено</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-md" style={{ backgroundColor: color, opacity: 0.88 }} />
          <span className="text-[9px] text-subtle">Выполнено</span>
        </div>
      </div>
    </div>
  )
}
