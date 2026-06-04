'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useOS }                from '../../../lib/store'
import { tasksRepo }            from '../../../lib/db/tasks'
import { habitsRepo }           from '../../../lib/db/habits'
import { habitCompletionsRepo } from '../../../lib/db/habitCompletions'
import { workoutsRepo }         from '../../../lib/db/workouts'
import { foodEntriesRepo }      from '../../../lib/db/foodEntries'
import { sleepRepo }            from '../../../lib/db/sleep'
import { transactionsRepo }     from '../../../lib/db/transactions'
import { getTodayStr }          from '../../../lib/tasks-selectors'
import {
  normalizeTaskEvents,
  normalizeHabitEvents,
  normalizeWorkoutEvents,
  normalizeFoodEvents,
  normalizeSleepEvents,
  normalizeFinanceEvents,
  buildDayMap,
} from '../../../lib/calendar-selectors'
import {
  MONTHS, MONTHS_G, WEEKDAYS, WEEKDAYS_F,
  localStr, getWeekStart, getWeekDays, getMonthCells,
} from '../MonthCalendar'

const LAYERS = [
  { key: 'tasks',     label: 'Задачи',     color: '#6c63ff' },
  { key: 'habits',    label: 'Привычки',   color: '#8b85ff' },
  { key: 'workouts',  label: 'Тренировки', color: '#22c55e' },
  { key: 'nutrition', label: 'Питание',    color: '#10b981' },
  { key: 'sleep',     label: 'Сон',        color: '#3b82f6' },
  { key: 'finance',   label: 'Финансы',    color: '#f59e0b' },
]

const TYPE_LABEL = { task: 'Задачи', habit: 'Привычки', workout: 'Тренировки', nutrition: 'Питание', sleep: 'Сон', finance: 'Финансы' }
const TYPE_COLOR = { task: '#6c63ff', habit: '#8b85ff', workout: '#22c55e', nutrition: '#10b981', sleep: '#3b82f6', finance: '#f59e0b' }
const TYPE_ORDER = ['task', 'habit', 'workout', 'nutrition', 'sleep', 'finance']

// ─── date helpers ─────────────────────────────────────────────────────────────

function fmtShortDate(date) {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 shadow-lg animate-slide-up">
      <AlertCircle className="w-4 h-4 text-danger shrink-0" />
      <span className="text-sm text-text">{msg}</span>
      <button onClick={onClose} className="text-subtle hover:text-text transition-colors ml-1">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-muted" />
        <div className="w-28 h-5 bg-muted rounded" />
      </div>
      <div className="flex gap-2 mb-4">
        {[0, 1, 2].map(i => <div key={i} className="w-24 h-8 bg-muted rounded-lg" />)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(d => <div key={d} className="h-6 bg-muted rounded" />)}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-[88px] bg-surface border border-border rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── EventChip — compact colored pill for month / week cells ──────────────────

function EventChip({ event, onClick }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick?.(event) }}
      title={event.title}
      className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-left hover:opacity-75 transition-opacity truncate ${
        event.done && event.type === 'task' ? 'opacity-40' : ''
      }`}
      style={{ backgroundColor: event.color + '22', color: event.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
      <span className="truncate leading-tight">{event.title}</span>
    </button>
  )
}

// ─── Month view ───────────────────────────────────────────────────────────────

const MAX_CHIPS = 3

function MonthView({ current, dayMap, today, onDayClick, onEventClick }) {
  const year  = current.getFullYear()
  const month = current.getMonth()
  const cells = getMonthCells(year, month)

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-subtle py-1 select-none">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="min-h-[88px]" />

          const ds      = localStr(date)
          const events  = dayMap.get(ds) ?? []
          const shown   = events.slice(0, MAX_CHIPS)
          const extra   = events.length - MAX_CHIPS
          const isToday = ds === today

          return (
            <div
              key={ds}
              onClick={() => onDayClick(date)}
              className={`min-h-[88px] p-1.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-0.5 select-none ${
                isToday
                  ? 'border-accent/50 bg-accent/5 hover:bg-accent/10'
                  : 'border-border hover:border-muted hover:bg-surface/60'
              }`}
            >
              <span className={`text-[11px] font-semibold leading-none mb-0.5 ${
                isToday ? 'text-accent' : 'text-subtle'
              }`}>
                {date.getDate()}
              </span>
              {shown.map(ev => (
                <EventChip key={ev.id} event={ev} onClick={onEventClick} />
              ))}
              {extra > 0 && (
                <span className="text-[10px] text-subtle pl-1">+{extra}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({ current, dayMap, today, onDayClick, onEventClick }) {
  const days = getWeekDays(current)

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {days.map((d, i) => {
          const ds      = localStr(d)
          const isToday = ds === today
          return (
            <button
              key={ds}
              type="button"
              onClick={() => onDayClick(d)}
              className={`text-center py-2 rounded-lg transition-colors ${
                isToday ? 'bg-accent/10' : 'hover:bg-surface'
              }`}
            >
              <div className="text-[10px] text-subtle">{WEEKDAYS[i]}</div>
              <div className={`text-base font-semibold mt-0.5 ${isToday ? 'text-accent' : 'text-text'}`}>
                {d.getDate()}
              </div>
            </button>
          )
        })}
      </div>

      {/* Event columns */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const ds     = localStr(d)
          const events = dayMap.get(ds) ?? []
          const isToday = ds === today
          return (
            <div
              key={ds}
              className={`min-h-[140px] rounded-xl border p-2 flex flex-col gap-1 cursor-pointer transition-colors ${
                isToday ? 'border-accent/30 bg-accent/5' : 'bg-surface border-border hover:border-muted'
              }`}
              onClick={() => events.length === 0 && onDayClick(d)}
            >
              {events.length === 0 ? (
                <span className="text-[10px] text-subtle/30 text-center mt-4 select-none">—</span>
              ) : (
                events.map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={e => { e && onDayClick(d) }} />
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Day view ─────────────────────────────────────────────────────────────────

function DayQuickAdd({ dateStr, onAdd }) {
  const [title, setTitle] = useState('')

  const handle = () => {
    const t = title.trim()
    if (!t) return
    onAdd({ title: t, due_date: dateStr })
    setTitle('')
  }

  const formatted = fmtShortDate(new Date(dateStr + 'T00:00:00'))

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-surface border border-border rounded-xl mt-4">
      <div className="w-4 h-4 rounded-full border-2 border-dashed border-muted shrink-0" />
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handle()}
        placeholder={`Новая задача на ${formatted}...`}
        className="flex-1 bg-transparent text-sm text-text placeholder:text-subtle outline-none"
      />
      <button
        type="button"
        onClick={handle}
        disabled={!title.trim()}
        className="px-3 py-1 bg-accent hover:bg-accent-light disabled:bg-muted disabled:cursor-not-allowed text-white text-xs rounded-lg font-medium transition-colors shrink-0"
      >
        Добавить
      </button>
    </div>
  )
}

function DayView({ current, dayMap, today, onAddTask, onEventClick }) {
  const ds      = localStr(current)
  const events  = dayMap.get(ds) ?? []
  const dow     = (current.getDay() + 6) % 7   // 0=Mon
  const isToday = ds === today

  const dateLabel = `${WEEKDAYS_F[dow]}, ${current.getDate()} ${MONTHS_G[current.getMonth()]} ${current.getFullYear()}`

  const grouped = TYPE_ORDER.reduce((acc, type) => {
    acc[type] = events.filter(e => e.type === type)
    return acc
  }, {})

  return (
    <div className="max-w-xl">
      {/* Date header */}
      <div className={`flex items-center gap-3 mb-5 px-4 py-3 rounded-xl border ${
        isToday ? 'border-accent/50 bg-accent/5' : 'border-border bg-surface'
      }`}>
        <span className={`text-sm font-semibold capitalize ${isToday ? 'text-accent' : 'text-text'}`}>
          {dateLabel}
        </span>
        {isToday && (
          <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full shrink-0">Сегодня</span>
        )}
        <span className="ml-auto text-[10px] text-subtle">{events.length} событий</span>
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center opacity-50">
          <span className="text-3xl">▦</span>
          <p className="text-subtle text-sm">Нет событий в этот день</p>
        </div>
      )}

      {/* Events grouped by type */}
      {TYPE_ORDER.map(type => {
        const evs = grouped[type]
        if (!evs || evs.length === 0) return null
        const layerColor = TYPE_COLOR[type]

        return (
          <div key={type} className="mb-4">
            {/* Group header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: layerColor }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                {TYPE_LABEL[type]}
              </span>
              <span className="text-[10px] text-subtle/60">{evs.length}</span>
            </div>

            {/* Event items */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {evs.map((ev, i) => (
                <div
                  key={ev.id}
                  onClick={() => ev.type === 'task' && onEventClick(ev)}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    i > 0 ? 'border-t border-border' : ''
                  } ${ev.type === 'task' ? 'cursor-pointer hover:bg-muted/20 group' : ''}`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: ev.color }}
                  />
                  <span className={`flex-1 text-sm leading-tight ${
                    ev.done && ev.type === 'task' ? 'line-through text-subtle' : 'text-text'
                  }`}>
                    {ev.title}
                  </span>
                  {ev.type === 'task' && (
                    <ChevronRight className="w-3.5 h-3.5 text-subtle opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Quick-add task */}
      <DayQuickAdd dateStr={ds} onAdd={onAddTask} />
    </div>
  )
}

// ─── Navigation header ────────────────────────────────────────────────────────

function NavHeader({ view, setView, current, navigate, goToday, layers, setLayers }) {
  const y   = current.getFullYear()
  const m   = current.getMonth()

  // Human-readable period label
  let label = ''
  if (view === 'month') {
    label = `${MONTHS[m]} ${y}`
  } else if (view === 'week') {
    const days  = getWeekDays(current)
    const first = days[0]
    const last  = days[6]
    if (first.getMonth() === last.getMonth()) {
      label = `${first.getDate()} – ${last.getDate()} ${MONTHS_G[m]} ${y}`
    } else {
      label = `${first.getDate()} ${MONTHS_G[first.getMonth()]} – ${last.getDate()} ${MONTHS_G[last.getMonth()]} ${y}`
    }
  } else {
    const dow = (current.getDay() + 6) % 7
    label = `${WEEKDAYS[dow]}, ${current.getDate()} ${MONTHS_G[m]}`
  }

  return (
    <div className="flex flex-col gap-3 mb-5">
      {/* Row 1: view toggle + navigation */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View mode */}
        <div className="flex rounded-lg overflow-hidden border border-border">
          {[{ v: 'month', l: 'Месяц' }, { v: 'week', l: 'Неделя' }, { v: 'day', l: 'День' }].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                view === v ? 'bg-accent/20 text-accent' : 'text-subtle hover:text-text'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Prev / label / Next */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 text-subtle hover:text-text transition-colors rounded-lg hover:bg-surface"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[180px] text-center text-sm font-semibold text-text select-none">
            {label}
          </span>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 text-subtle hover:text-text transition-colors rounded-lg hover:bg-surface"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Today */}
        <button
          onClick={goToday}
          className="px-3 py-1.5 text-xs font-medium border border-border text-subtle hover:text-accent hover:border-accent/40 rounded-lg transition-colors"
        >
          Сегодня
        </button>
      </div>

      {/* Row 2: layer toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        {LAYERS.map(layer => {
          const active = layers[layer.key]
          return (
            <button
              key={layer.key}
              type="button"
              onClick={() => setLayers(l => ({ ...l, [layer.key]: !l[layer.key] }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                active ? 'opacity-100' : 'opacity-40 border-border text-subtle'
              }`}
              style={active ? {
                color:           layer.color,
                borderColor:     layer.color + '60',
                backgroundColor: layer.color + '15',
              } : {}}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
                style={{ backgroundColor: active ? layer.color : '#555' }}
              />
              {layer.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CalendarModule() {
  const { userId } = useOS()
  const router     = useRouter()

  // ── raw data ──
  const [tasks,         setTasks]         = useState([])
  const [habits,        setHabits]        = useState([])
  const [completions,   setCompletions]   = useState({})
  const [workouts,      setWorkouts]      = useState([])
  const [foodEntries,   setFoodEntries]   = useState([])
  const [sleepEntries,  setSleepEntries]  = useState([])
  const [transactions,  setTransactions]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState(null)

  // ── ui state ──
  const [view,    setView]    = useState('month')
  const [current, setCurrent] = useState(() => new Date())
  const [layers,  setLayers]  = useState({ tasks: true, habits: true, workouts: true, nutrition: true, sleep: true, finance: true })

  const today = getTodayStr()

  // ── load all sources in parallel ─────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return
    async function load() {
      try {
        const [taskList, habitList, workoutList, foodList, sleepList, txList] = await Promise.all([
          tasksRepo.list(userId),
          habitsRepo.list(userId),
          workoutsRepo.list(userId),
          foodEntriesRepo.listAll(userId),
          sleepRepo.list(userId),
          transactionsRepo.list(userId),
        ])
        setTasks(taskList)
        setHabits(habitList)
        setWorkouts(workoutList)
        setFoodEntries(foodList)
        setSleepEntries(sleepList)
        setTransactions(txList)

        // Completions require habit IDs — one extra round-trip
        if (habitList.length > 0) {
          const comp = await habitCompletionsRepo.listAllByHabits(
            userId, habitList.map(h => h.id)
          )
          setCompletions(comp)
        }
      } catch (e) {
        showToast('Ошибка загрузки данных'); console.error(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = (msg) => setToast(msg)

  // ── event map (re-derived when data or layer toggles change) ─────────────────

  const dayMap = useMemo(() => {
    const events = [
      ...(layers.tasks     ? normalizeTaskEvents(tasks)                 : []),
      ...(layers.habits    ? normalizeHabitEvents(habits, completions)  : []),
      ...(layers.workouts  ? normalizeWorkoutEvents(workouts)           : []),
      ...(layers.nutrition ? normalizeFoodEvents(foodEntries)           : []),
      ...(layers.sleep     ? normalizeSleepEvents(sleepEntries)         : []),
      ...(layers.finance   ? normalizeFinanceEvents(transactions)       : []),
    ]
    return buildDayMap(events)
  }, [tasks, habits, completions, workouts, foodEntries, sleepEntries, transactions, layers])

  // ── navigation ────────────────────────────────────────────────────────────────

  const navigate = useCallback((dir) => {
    setCurrent(prev => {
      const d = new Date(prev)
      if (view === 'day')   d.setDate(d.getDate() + dir)
      if (view === 'week')  d.setDate(d.getDate() + 7 * dir)
      if (view === 'month') d.setMonth(d.getMonth() + dir)
      return d
    })
  }, [view])

  const goToday = () => setCurrent(new Date())

  const goToDay = useCallback((date) => {
    setCurrent(new Date(date))
    setView('day')
  }, [])

  // ── task creation (optimistic) ────────────────────────────────────────────────

  const addTask = useCallback(async ({ title, due_date }) => {
    if (!userId || !title.trim()) return
    const optimistic = {
      id: `tmp-${Date.now()}`, title, text: title,
      status: 'todo', done: false, priority: 'medium',
      due_date, description: '', tags: [], project_id: null,
      recurrence: 'none', completed_at: null,
    }
    setTasks(prev => [optimistic, ...prev])
    try {
      const saved = await tasksRepo.create(userId, { title, due_date, priority: 'medium' })
      setTasks(prev => prev.map(t => t.id === optimistic.id ? saved : t))
    } catch (e) {
      setTasks(prev => prev.filter(t => t.id !== optimistic.id))
      showToast('Не удалось создать задачу'); console.error(e.message)
    }
  }, [userId])

  // ── event click (tasks → navigate to tasks module) ────────────────────────────

  const handleEventClick = useCallback((event) => {
    if (event.type === 'task')      router.push('/modules/tasks')
    if (event.type === 'nutrition') router.push('/modules/nutrition')
    if (event.type === 'sleep')     router.push('/modules/sleep')
    if (event.type === 'finance')   router.push('/modules/finance')
  }, [router])

  // ── render ────────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* Module header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: '#0891b215', color: '#0891b2' }}>
          ▦
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Календарь</h1>
          <p className="text-subtle text-sm">Задачи · Привычки · Тренировки</p>
        </div>
      </div>

      {/* Nav header: view toggle + date nav + layer filters */}
      <NavHeader
        view={view}       setView={setView}
        current={current}
        navigate={navigate}
        goToday={goToday}
        layers={layers}   setLayers={setLayers}
      />

      {/* Active view */}
      {view === 'month' && (
        <MonthView
          current={current}
          dayMap={dayMap}
          today={today}
          onDayClick={goToDay}
          onEventClick={handleEventClick}
        />
      )}
      {view === 'week' && (
        <WeekView
          current={current}
          dayMap={dayMap}
          today={today}
          onDayClick={goToDay}
          onEventClick={handleEventClick}
        />
      )}
      {view === 'day' && (
        <DayView
          current={current}
          dayMap={dayMap}
          today={today}
          onAddTask={addTask}
          onEventClick={handleEventClick}
        />
      )}
    </div>
  )
}
