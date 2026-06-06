'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'
import { formatDueDate, getTodayStr } from '../../../lib/tasks-selectors'

/** Neutral formatter — no "Просрочено", just "Сегодня" / "Вчера" / "25 мая" */
function formatNeutralDate(dateStr) {
  if (!dateStr) return null
  const today = getTodayStr()
  const yestD = new Date(today + 'T00:00:00')
  yestD.setDate(yestD.getDate() - 1)
  const yesterday = [
    yestD.getFullYear(),
    String(yestD.getMonth() + 1).padStart(2, '0'),
    String(yestD.getDate()).padStart(2, '0'),
  ].join('-')
  if (dateStr === today)     return 'Сегодня'
  if (dateStr === yesterday) return 'Вчера'
  return new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const MONTHS     = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MONTHS_SH  = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
const WEEKDAYS   = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function getViewingFromValue(value) {
  if (value) {
    const d = new Date(value + 'T00:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  }
  const n = new Date()
  return { year: n.getFullYear(), month: n.getMonth() }
}

export default function DatePicker({ value, onChange, placeholder = 'Дата', compact = false, noOverdue = false }) {
  const [open,       setOpen]       = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const [viewing,    setViewing]    = useState(() => getViewingFromValue(value))
  // mode: 'day' | 'month' | 'year'
  const [mode,       setMode]       = useState('day')
  const containerRef = useRef(null)

  // Sync calendar view when value changes externally
  useEffect(() => {
    if (value) setViewing(getViewingFromValue(value))
  }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setMode('day')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const todayStr    = getTodayStr()
  const tomorrowStr = new Date(new Date(todayStr + 'T00:00:00').getTime() + 86400000).toISOString().split('T')[0]

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

  const getDays = () => {
    const { year, month } = viewing
    const firstDow  = (new Date(year, month, 1).getDay() + 6) % 7 // Mon = 0
    const lastDay   = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= lastDay; d++) cells.push(new Date(year, month, d))
    return cells
  }

  // Year grid: current year ± 6
  const getYears = () => {
    const base = viewing.year
    const years = []
    for (let y = base - 6; y <= base + 5; y++) years.push(y)
    return years
  }

  const pick = (dateStr) => { onChange(dateStr); setOpen(false); setMode('day') }

  const displayLabel = value
    ? (noOverdue ? formatNeutralDate(value) : formatDueDate(value))
    : placeholder

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          if (!open && containerRef.current) {
            const r = containerRef.current.getBoundingClientRect()
            setAlignRight(r.left + 240 > window.innerWidth - 8)
          }
          if (open) setMode('day')
          setOpen(o => !o)
        }}
        className={`flex items-center gap-1.5 rounded-lg border transition-colors ${
          compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'
        } ${
          value
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-border text-subtle hover:text-text hover:border-muted'
        }`}
      >
        <Calendar className="w-3 h-3 shrink-0" />
        <span className="truncate max-w-[90px]">{displayLabel}</span>
        {value && (
          <span
            onClick={e => { e.stopPropagation(); onChange(null) }}
            className="ml-0.5 text-subtle hover:text-text transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute z-50 top-full mt-1 w-60 bg-surface border border-border rounded-xl shadow-2xl p-3 animate-slide-up ${alignRight ? 'right-0' : 'left-0'}`}>

          {/* ── Day mode ─────────────────────────────────────────────────────── */}
          {mode === 'day' && (
            <>
              {/* Quick buttons */}
              <div className="flex gap-1.5 mb-3">
                <button
                  onClick={() => pick(todayStr)}
                  className={`flex-1 py-1 text-xs rounded-lg transition-colors font-medium ${
                    value === todayStr ? 'bg-accent text-white' : 'bg-muted/50 hover:bg-muted text-text'
                  }`}
                >
                  Сегодня
                </button>
                <button
                  onClick={() => pick(tomorrowStr)}
                  className={`flex-1 py-1 text-xs rounded-lg transition-colors font-medium ${
                    value === tomorrowStr ? 'bg-accent text-white' : 'bg-muted/50 hover:bg-muted text-text'
                  }`}
                >
                  Завтра
                </button>
                {value && (
                  <button
                    onClick={() => pick(null)}
                    className="flex-1 py-1 text-xs rounded-lg bg-muted/50 hover:bg-danger/20 text-subtle hover:text-danger transition-colors font-medium"
                  >
                    Очистить
                  </button>
                )}
              </div>

              {/* Month nav — tap month/year label to switch mode */}
              <div className="flex items-center justify-between mb-2">
                <button onClick={prevMonth} className="p-1 text-subtle hover:text-text transition-colors rounded">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMode('month')}
                  className="text-xs font-semibold text-text hover:text-accent transition-colors px-1"
                >
                  {MONTHS[viewing.month]} {viewing.year}
                </button>
                <button onClick={nextMonth} className="p-1 text-subtle hover:text-text transition-colors rounded">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-0.5">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-[10px] text-subtle py-0.5 select-none">{d}</div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {getDays().map((date, i) => {
                  if (!date) return <div key={`e${i}`} />
                  const ds = date.toISOString().split('T')[0]
                  const isSelected = ds === value
                  const isToday    = ds === todayStr
                  const now = new Date(todayStr + 'T00:00:00')
                  const isPast     = date < now && !isToday
                  return (
                    <button
                      key={ds}
                      onClick={() => pick(ds)}
                      className={`h-7 w-full rounded-lg text-[11px] font-medium transition-colors select-none ${
                        isSelected
                          ? 'bg-accent text-white'
                          : isToday
                          ? 'border border-accent/60 text-accent hover:bg-accent/20'
                          : isPast
                          ? 'text-subtle/50 hover:bg-muted/40'
                          : 'text-text hover:bg-muted/50'
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── Month mode ───────────────────────────────────────────────────── */}
          {mode === 'month' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setViewing(v => ({ ...v, year: v.year - 1 }))} className="p-1 text-subtle hover:text-text transition-colors rounded">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMode('year')}
                  className="text-xs font-semibold text-text hover:text-accent transition-colors px-1"
                >
                  {viewing.year}
                </button>
                <button onClick={() => setViewing(v => ({ ...v, year: v.year + 1 }))} className="p-1 text-subtle hover:text-text transition-colors rounded">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {MONTHS_SH.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => { setViewing(v => ({ ...v, month: i })); setMode('day') }}
                    className={`py-1.5 text-xs rounded-lg transition-colors font-medium ${
                      viewing.month === i
                        ? 'bg-accent text-white'
                        : 'bg-muted/30 hover:bg-muted text-text'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMode('day')}
                className="mt-3 w-full text-xs text-subtle hover:text-text transition-colors py-1"
              >
                ← Назад
              </button>
            </>
          )}

          {/* ── Year mode ────────────────────────────────────────────────────── */}
          {mode === 'year' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setViewing(v => ({ ...v, year: v.year - 12 }))} className="p-1 text-subtle hover:text-text transition-colors rounded">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-semibold text-text">Год</span>
                <button onClick={() => setViewing(v => ({ ...v, year: v.year + 12 }))} className="p-1 text-subtle hover:text-text transition-colors rounded">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {getYears().map(y => (
                  <button
                    key={y}
                    onClick={() => { setViewing(v => ({ ...v, year: y })); setMode('month') }}
                    className={`py-1.5 text-xs rounded-lg transition-colors font-medium ${
                      viewing.year === y
                        ? 'bg-accent text-white'
                        : 'bg-muted/30 hover:bg-muted text-text'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMode('month')}
                className="mt-3 w-full text-xs text-subtle hover:text-text transition-colors py-1"
              >
                ← Назад
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
