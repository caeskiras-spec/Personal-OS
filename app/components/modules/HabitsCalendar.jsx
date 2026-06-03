'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { getTodayStr } from '../../../lib/tasks-selectors'

// Same locale constants as DatePicker
const MONTHS   = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function localStr(d) {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

/**
 * Aggregate calendar — shows all habits' completions as colored dots.
 *
 * Props:
 *   habits:      Habit[]                  — full list of user habits
 *   completions: { [habitId]: string[] }  — all-time completion dates per habit
 *
 * No data fetching — data flows from parent HabitsModule (zero extra requests).
 */
export default function HabitsCalendar({ habits = [], completions = {} }) {
  const today = getTodayStr()

  const [viewing, setViewing] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })

  const [popover,   setPopover]   = useState(null) // { date, x, y, items }
  const popoverRef                = useRef(null)
  const containerRef              = useRef(null)

  // Close popover on outside click
  useEffect(() => {
    if (!popover) return
    const handle = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setPopover(null)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [popover])

  // Close popover on Escape
  useEffect(() => {
    if (!popover) return
    const handle = (e) => { if (e.key === 'Escape') setPopover(null) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [popover])

  const prevMonth = () => {
    setPopover(null)
    setViewing(v => ({
      month: v.month === 0 ? 11 : v.month - 1,
      year:  v.month === 0 ? v.year - 1 : v.year,
    }))
  }
  const nextMonth = () => {
    setPopover(null)
    setViewing(v => ({
      month: v.month === 11 ? 0 : v.month + 1,
      year:  v.month === 11 ? v.year + 1 : v.year,
    }))
  }

  // Build date → habits[] index (all-time, all habits)
  const dateIndex = {}
  for (const habit of habits) {
    for (const ds of (completions[habit.id] ?? [])) {
      if (!dateIndex[ds]) dateIndex[ds] = []
      dateIndex[ds].push(habit)
    }
  }

  // Month grid cells (null = Mon-align padding)
  const cells = (() => {
    const { year, month } = viewing
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7  // Mon = 0
    const lastDay  = new Date(year, month + 1, 0).getDate()
    const out = []
    for (let i = 0; i < firstDow; i++) out.push(null)
    for (let d = 1; d <= lastDay; d++) out.push(new Date(year, month, d))
    return out
  })()

  const handleDayClick = (e, ds) => {
    const items = dateIndex[ds] ?? []
    if (items.length === 0) return
    // Toggle: same date closes
    if (popover?.date === ds) { setPopover(null); return }

    const rect = e.currentTarget.getBoundingClientRect()
    const gap  = 8

    // Prefer right of cell; fall back to left if would overflow
    let x = rect.right + gap
    let y = rect.top
    const popW = 190
    const popH = 20 + items.length * 28
    if (x + popW > window.innerWidth - 8) x = rect.left - popW - gap
    if (y + popH > window.innerHeight - 8) y = window.innerHeight - popH - 8

    setPopover({ date: ds, x, y, items })
  }

  const popDate = popover
    ? new Date(popover.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : ''

  return (
    <div ref={containerRef} className="bg-surface border border-border rounded-xl p-4 select-none">
      {/* Section label */}
      <p className="text-[10px] text-subtle uppercase tracking-wider mb-3">Общий календарь</p>

      {/* Month navigation — same style as DatePicker */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 text-subtle hover:text-text transition-colors rounded"
          aria-label="Предыдущий месяц"
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
          aria-label="Следующий месяц"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Weekday headers — same style as DatePicker */}
      <div className="grid grid-cols-7 mb-0.5">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[9px] text-subtle py-0.5">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="h-10" />

          const ds      = localStr(date)
          const items   = dateIndex[ds] ?? []
          const isToday = ds === today
          const dots    = items.slice(0, 3)
          const extra   = items.length - 3
          const active  = popover?.date === ds

          return (
            <button
              key={ds}
              type="button"
              onClick={e => handleDayClick(e, ds)}
              className={`h-10 w-full flex flex-col items-center justify-start pt-1 rounded-lg transition-colors relative ${
                items.length > 0
                  ? 'hover:bg-muted/50 cursor-pointer'
                  : 'cursor-default'
              } ${isToday ? 'bg-accent/10' : ''} ${active ? 'ring-1 ring-accent/50' : ''}`}
            >
              <span className={`text-[10px] font-medium leading-tight ${
                isToday ? 'text-accent' : 'text-subtle'
              }`}>
                {date.getDate()}
              </span>

              {/* Colored dots — up to 3 + "+N" */}
              {dots.length > 0 && (
                <div className="flex gap-[2px] items-center mt-0.5 flex-wrap justify-center">
                  {dots.map(h => (
                    <span
                      key={h.id}
                      className="w-[5px] h-[5px] rounded-full shrink-0"
                      style={{ backgroundColor: h.color }}
                    />
                  ))}
                  {extra > 0 && (
                    <span className="text-[7px] text-subtle leading-none font-medium">+{extra}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Popover — fixed, close-on-outside-click */}
      {popover && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-surface border border-border rounded-xl shadow-2xl animate-fade-in"
          style={{ left: popover.x, top: popover.y, minWidth: 170, maxWidth: 240 }}
        >
          {/* Popover header */}
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-border">
            <span className="text-[10px] text-subtle capitalize">{popDate}</span>
            <button
              type="button"
              onClick={() => setPopover(null)}
              className="text-subtle hover:text-text transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Habit list */}
          <div className="flex flex-col gap-0 py-1.5">
            {popover.items.map(h => (
              <div key={h.id} className="flex items-center gap-2 px-3 py-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: h.color }}
                />
                <span className="text-sm text-text leading-tight">{h.emoji} {h.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
