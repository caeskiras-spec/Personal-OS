// ─── Event model ─────────────────────────────────────────────────────────────
//
// CalendarEvent = {
//   id:    string          unique composite key
//   date:  'YYYY-MM-DD'
//   type:  'task' | 'habit' | 'workout'
//   title: string
//   color: string          CSS hex
//   refId: string          original record id
//   done?: boolean         tasks only
// }

export const TASK_PRIORITY_COLORS = {
  high:   '#ef4444',
  medium: '#6c63ff',
  low:    '#64748b',
}

export const WORKOUT_COLOR = '#22c55e'

/** tasks[] → CalendarEvent[] (only tasks with due_date) */
export function normalizeTaskEvents(tasks) {
  return tasks
    .filter(t => t.due_date)
    .map(t => ({
      id:    `task-${t.id}`,
      date:  t.due_date,
      type:  'task',
      title: t.title,
      color: TASK_PRIORITY_COLORS[t.priority] ?? TASK_PRIORITY_COLORS.medium,
      refId: t.id,
      done:  !!(t.done ?? t.status === 'done'),
    }))
}

/** habits[] + { [habitId]: string[] } completions → CalendarEvent[] */
export function normalizeHabitEvents(habits, completions) {
  const habitMap = new Map(habits.map(h => [h.id, h]))
  const events   = []
  for (const [habitId, dates] of Object.entries(completions)) {
    const habit = habitMap.get(habitId)
    if (!habit) continue
    for (const date of dates) {
      events.push({
        id:    `habit-${habitId}-${date}`,
        date,
        type:  'habit',
        title: `${habit.emoji} ${habit.name}`,
        color: habit.color ?? '#8b85ff',
        refId: habitId,
        done:  true,
      })
    }
  }
  return events
}

/** workouts[] → CalendarEvent[] (uses type emoji/color from workoutTypes join) */
export function normalizeWorkoutEvents(workouts) {
  return workouts
    .filter(w => w.date)
    .map(w => {
      const emoji = w.typeEmoji ?? '⚡'
      const name  = w.typeName  ?? w.type ?? 'Тренировка'
      return {
        id:    `workout-${w.id}`,
        date:  w.date,
        type:  'workout',
        title: w.duration
          ? `${emoji} ${name} · ${w.duration} мин`
          : `${emoji} ${name}`,
        color: w.typeColor ?? WORKOUT_COLOR,
        refId: w.id,
        done:  true,
      }
    })
}

export const NUTRITION_COLOR = '#10b981'

/**
 * foodEntries[] → CalendarEvent[] (one event per day, showing total kcal)
 * Groups all entries for a date into a single "🍽️ X ккал" chip.
 */
export function normalizeFoodEvents(foodEntries) {
  const byDate = {}
  for (const e of foodEntries) {
    if (!e.date) continue
    if (!byDate[e.date]) byDate[e.date] = { calories: 0, count: 0 }
    byDate[e.date].calories += e.calories ?? 0
    byDate[e.date].count++
  }
  return Object.entries(byDate).map(([date, { calories, count }]) => ({
    id:    `nutrition-${date}`,
    date,
    type:  'nutrition',
    title: `🍽️ ${Math.round(calories)} ккал`,
    color: NUTRITION_COLOR,
    refId: date,
    done:  true,
    calories,
    count,
  }))
}

export const SLEEP_COLOR = '#3b82f6'

/**
 * sleepEntries[] → CalendarEvent[] (one per entry, showing duration)
 */
export function normalizeSleepEvents(sleepEntries) {
  return sleepEntries
    .filter(e => e.date && e.durationMinutes > 0)
    .map(e => {
      const h = Math.floor(e.durationMinutes / 60)
      const m = e.durationMinutes % 60
      const dur = m === 0 ? `${h}ч` : `${h}ч ${m}м`
      return {
        id:    `sleep-${e.id}`,
        date:  e.date,
        type:  'sleep',
        title: `🌙 ${dur}`,
        color: SLEEP_COLOR,
        refId: e.id,
        done:  true,
      }
    })
}

export const FINANCE_COLOR = '#f59e0b'

/**
 * transactions[] → CalendarEvent[] (one event per day showing total expenses)
 */
export function normalizeFinanceEvents(transactions) {
  const byDate = {}
  for (const t of transactions) {
    if (!t.date) continue
    if (!byDate[t.date]) byDate[t.date] = { expense: 0, income: 0 }
    if (t.type === 'expense') byDate[t.date].expense += t.amount ?? 0
    if (t.type === 'income')  byDate[t.date].income  += t.amount ?? 0
  }
  return Object.entries(byDate).map(([date, { expense, income }]) => ({
    id:    `finance-${date}`,
    date,
    type:  'finance',
    title: expense > 0 ? `💸 ${Math.round(expense).toLocaleString('ru-RU')} ₽` : `💰 +${Math.round(income).toLocaleString('ru-RU')} ₽`,
    color: FINANCE_COLOR,
    refId: date,
    done:  true,
    expense,
    income,
  }))
}

export const MEETING_COLOR = '#a78bfa'

/**
 * meetings[] → CalendarEvent[] (one event per meeting, showing guest name + time)
 * meetings have start_at (timestamptz UTC) — convert to local date string
 */
export function normalizeMeetingEvents(meetings) {
  return meetings
    .filter(m => m.start_at && m.status !== 'cancelled')
    .map(m => {
      const start = new Date(m.start_at)
      const dateStr = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`
      const timeStr = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })
      return {
        id:    `meeting-${m.id}`,
        date:  dateStr,
        type:  'meeting',
        title: `📅 ${timeStr} ${m.guest_name}`,
        color: MEETING_COLOR,
        refId: m.id,
        done:  false,
      }
    })
}

/** CalendarEvent[] → Map<'YYYY-MM-DD', CalendarEvent[]> */
export function buildDayMap(events) {
  const map = new Map()
  for (const e of events) {
    if (!e.date) continue
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date).push(e)
  }
  return map
}
