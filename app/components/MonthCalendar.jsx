'use client'

// ─── Shared locale constants ───────────────────────────────────────────────────

export const MONTHS    = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
export const MONTHS_G  = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
export const WEEKDAYS  = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
export const WEEKDAYS_F = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']

// ─── Shared date helpers ───────────────────────────────────────────────────────

export function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function getWeekStart(date) {
  const d   = new Date(date)
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  return d
}

export function getWeekDays(date) {
  const start = getWeekStart(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function getMonthCells(year, month) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const lastDay  = new Date(year, month + 1, 0).getDate()
  const cells    = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= lastDay; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// ─── CompactMonthCalendar ─────────────────────────────────────────────────────
//
// Dot-based compact month grid — used in HomeScreen CalendarWidget.
// CalendarModule uses its own MonthView with full EventChip pills.
//
// Props:
//   year, month  — calendar month to render
//   dayMap       — Map<'YYYY-MM-DD', CalendarEvent[]>
//   today        — 'YYYY-MM-DD' string for today highlight
//   onDayClick   — (date: Date) => void

export default function CompactMonthCalendar({ year, month, dayMap, today, onDayClick }) {
  const cells = getMonthCells(year, month)

  return (
    <div className="w-full select-none">
      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-0.5">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[8px] font-semibold text-text-8 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="h-9" />

          const ds      = localStr(date)
          const events  = dayMap.get(ds) ?? []
          const isToday = ds === today
          const dots    = events.slice(0, 4)
          const extra   = events.length - 4

          return (
            <div
              key={ds}
              onClick={(e) => onDayClick?.(date, e.currentTarget.getBoundingClientRect())}
              className={`h-9 flex flex-col items-center justify-start pt-1 rounded-md cursor-pointer transition-colors ${
                isToday
                  ? 'bg-[#6c63ff]/10 hover:bg-[#6c63ff]/15'
                  : 'hover:bg-surface-2'
              }`}
            >
              <span className={`text-[10px] font-semibold leading-none ${isToday ? 'text-[#6c63ff]' : 'text-text-5'}`}>
                {date.getDate()}
              </span>
              {events.length > 0 && (
                <div className="flex flex-wrap gap-[2px] mt-0.5 justify-center max-w-full px-0.5">
                  {dots.map(ev => (
                    <span
                      key={ev.id}
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{ backgroundColor: ev.color }}
                    />
                  ))}
                  {extra > 0 && (
                    <span className="text-[7px] text-text-7 leading-none self-center">+{extra}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
