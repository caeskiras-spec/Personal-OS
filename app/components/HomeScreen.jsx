'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, ChevronLeft, Plus, AlertCircle } from 'lucide-react'
import { useOS }                    from '../../lib/store'
import { MODULE_ICONS }             from '../../lib/moduleIcons'
import { tasksRepo }                from '../../lib/db/tasks'
import { habitsRepo }               from '../../lib/db/habits'
import { habitCompletionsRepo }     from '../../lib/db/habitCompletions'
import { focusSessionsRepo }        from '../../lib/db/focusSessions'
import { foodEntriesRepo }          from '../../lib/db/foodEntries'
import { sleepRepo }                from '../../lib/db/sleep'
import { transactionsRepo }         from '../../lib/db/transactions'
import { goalsRepo }                from '../../lib/db/goals'
import { goalMilestonesRepo }       from '../../lib/db/goalMilestones'
import { profileRepo }              from '../../lib/db/profile'
import { workoutsRepo }             from '../../lib/db/workouts'
import { journalRepo }              from '../../lib/db/journal'
import { projectsRepo }             from '../../lib/db/projects'
import {
  normalizeTaskEvents, normalizeHabitEvents, normalizeWorkoutEvents, buildDayMap,
} from '../../lib/calendar-selectors'
import CompactMonthCalendar, { MONTHS, localStr } from './MonthCalendar'
import DayPopover from './DayPopover'
import { getTodayAndOverdue, getTodayStr } from '../../lib/tasks-selectors'
import { isScheduledToday }         from '../../lib/habits-selectors'
import { getSessionsToday, sumMinutes } from '../../lib/focus-selectors'
import { sumMacros, getMealLabel }  from '../../lib/nutrition-selectors'
import { fmtDuration }              from '../../lib/sleep-selectors'
import { getPeriodSummary }         from '../../lib/finance-selectors'
import { computeProgress }          from '../../lib/goals-selectors'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtMins(m) {
  if (!m) return '0м'
  const h = Math.floor(m / 60); const min = m % 60
  return h > 0 ? (min > 0 ? `${h}ч ${min}м` : `${h}ч`) : `${min}м`
}

function fmtMoney(n) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.abs(n))
}

function timeAgo(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const dt = new Date(`${dateStr}T${timeStr}:00`)
  const diff = Math.floor((Date.now() - dt) / 60000)
  if (diff < 1)  return 'только что'
  if (diff < 60) return `${diff} мин назад`
  const h = Math.floor(diff / 60); const m = diff % 60
  return m > 0 ? `${h}ч ${m}м назад` : `${h}ч назад`
}

function qualityStars(q) {
  if (!q) return null
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={`text-[10px] ${i < q ? 'text-[#f59e0b]' : 'text-text-9'}`}>★</span>
  ))
}

// ─── WidgetCard shell ─────────────────────────────────────────────────────────

function WidgetCard({ modId, title, badge, children, className = '' }) {
  const router = useRouter()
  const mi = MODULE_ICONS[modId]
  return (
    <div
      onClick={() => router.push(`/modules/${modId}`)}
      className={`h-full bg-card border border-border-2 rounded-xl flex flex-col gap-2 p-4 cursor-pointer hover:bg-surface-2 hover:border-border-hover transition-all ${className}`}
    >
      {/* header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {mi && (
            <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: mi.color + '20' }}>
              <mi.Icon className="w-3 h-3" style={{ color: mi.color }} />
            </div>
          )}
          <span className="text-[11px] font-semibold text-text-4 uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {badge !== undefined && badge !== null && (
            <span className="text-[10px] text-text-6">{badge}</span>
          )}
          <ChevronRight className="w-3 h-3 text-text-9" />
        </div>
      </div>
      {/* content — min-h-0 allows flex shrinking; overflow-hidden clips to fixed height */}
      <div className="flex-1 min-h-0 overflow-hidden" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function WidgetSkeleton({ rows = 3 }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-7 bg-surface-2 rounded-lg animate-pulse" style={{ width: `${70 + i * 8}%` }} />
      ))}
    </div>
  )
}

function WidgetEmpty({ msg, modId }) {
  const router = useRouter()
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-text-7">{msg}</span>
      <button
        onClick={e => { e.stopPropagation(); router.push(`/modules/${modId}`) }}
        className="flex items-center gap-1 text-[10px] text-[#6c63ff] hover:text-[#8b85ff] transition-colors shrink-0"
      >
        <Plus className="w-2.5 h-2.5" /> Добавить
      </button>
    </div>
  )
}

function WidgetError() {
  return (
    <div className="flex items-center gap-2 py-1 text-[11px] text-text-6">
      <AlertCircle className="w-3.5 h-3.5 text-[#ef4444]/60 shrink-0" />
      <span>Не удалось загрузить</span>
    </div>
  )
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct, color = '#6c63ff' }) {
  return (
    <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  )
}

// ─── MiniRing ─────────────────────────────────────────────────────────────────

function MiniRing({ pct, color, size = 32 }) {
  const sw = 3; const r = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const off = circ * (1 - Math.max(0, Math.min(1, pct / 100)))
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={sw} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: TASKS
// ═══════════════════════════════════════════════════════════════════════════════

function TasksWidget() {
  const { userId } = useOS()
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!userId) return
    tasksRepo.list(userId)
      .then(list => setTasks(list))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId])

  const toggle = useCallback(async (task, e) => {
    e.stopPropagation()
    const snap = tasks
    setTasks(p => p.map(t => t.id === task.id
      ? { ...t, done: !task.done, status: task.done ? 'todo' : 'done', completed_at: task.done ? null : new Date().toISOString() }
      : t))
    try { await tasksRepo.toggleComplete(task.id, task.done) }
    catch { setTasks(snap) }
  }, [tasks])

  const visible = getTodayAndOverdue(tasks)
  const done    = visible.filter(t => t.status === 'done').length
  const shown   = visible.slice(0, 5)
  const more    = visible.length - shown.length

  return (
    <WidgetCard modId="tasks" title="Задачи" badge={loading ? '' : `${done}/${visible.length}`} className="lg:col-span-2">
      {loading ? <WidgetSkeleton /> : error ? <WidgetError /> : (
        <div className="flex flex-col gap-0.5">
          {visible.length === 0 ? (
            <WidgetEmpty msg="На сегодня задач нет" modId="tasks" />
          ) : (
            <>
              {shown.map(task => {
                const isDone = task.status === 'done'
                const overdue = !isDone && task.due_date && task.due_date < getTodayStr()
                return (
                  <div key={task.id} className="flex items-center gap-2.5 py-1.5 rounded-lg px-1 hover:bg-surface-3 transition-colors group">
                    <button
                      onClick={e => toggle(task, e)}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isDone ? 'bg-[#22c55e] border-[#22c55e]' : 'border-[#444] hover:border-[#6c63ff]'
                      }`}
                    >
                      {isDone && <Check className="w-2.5 h-2.5 text-white" />}
                    </button>
                    <span className={`flex-1 text-xs min-w-0 truncate ${isDone ? 'line-through text-text-7' : 'text-text-2'}`}>
                      {task.title}
                    </span>
                    {overdue && !isDone && (
                      <span className="text-[10px] text-[#ef4444] shrink-0">просрочено</span>
                    )}
                  </div>
                )
              })}
              {more > 0 && (
                <p className="text-[10px] text-text-7 pt-1 pl-1">ещё {more}...</p>
              )}
            </>
          )}
        </div>
      )}
    </WidgetCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: HABITS
// ═══════════════════════════════════════════════════════════════════════════════

function HabitsWidget() {
  const { userId } = useOS()
  const [habits,    setHabits]    = useState([])
  const [doneToday, setDoneToday] = useState(new Set())
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(false)

  useEffect(() => {
    if (!userId) return
    async function load() {
      try {
        const list = await habitsRepo.list(userId)
        setHabits(list)
        if (list.length) {
          const done = await habitCompletionsRepo.listTodayByHabits(userId, list.map(h => h.id))
          setDoneToday(done)
        }
      } catch { setError(true) }
      finally { setLoading(false) }
    }
    load()
  }, [userId])

  const toggle = useCallback(async (habit, e) => {
    e.stopPropagation()
    if (!isScheduledToday(habit)) return
    const was = doneToday.has(habit.id)
    setDoneToday(p => { const n = new Set(p); was ? n.delete(habit.id) : n.add(habit.id); return n })
    try { await habitCompletionsRepo.toggleByDate(userId, habit.id) }
    catch { setDoneToday(p => { const n = new Set(p); was ? n.add(habit.id) : n.delete(habit.id); return n }) }
  }, [userId, doneToday])

  const scheduled = habits.filter(isScheduledToday)
  const doneCount = scheduled.filter(h => doneToday.has(h.id)).length

  return (
    <WidgetCard modId="habits" title="Привычки" badge={loading ? '' : `${doneCount}/${scheduled.length}`}>
      {loading ? <WidgetSkeleton rows={2} /> : error ? <WidgetError /> : (
        <>
          {scheduled.length === 0 ? (
            <WidgetEmpty msg="Привычек нет" modId="habits" />
          ) : (
            <>
              <ProgressBar pct={scheduled.length ? doneCount / scheduled.length * 100 : 0} color="#8b85ff" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {scheduled.map(h => {
                  const done = doneToday.has(h.id)
                  return (
                    <button key={h.id} onClick={e => toggle(h, e)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                        done ? 'text-[#22c55e]' : 'text-subtle border-border hover:border-[#444] hover:text-text-2'
                      }`}
                      style={done ? { background: (h.color||'#22c55e')+'18', borderColor: (h.color||'#22c55e')+'50', color: h.color||'#22c55e' } : {}}
                    >
                      {done && <Check className="w-2.5 h-2.5 shrink-0" />}
                      <span>{h.emoji}</span>
                      <span className="truncate max-w-[80px]">{h.name}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: FOCUS
// ═══════════════════════════════════════════════════════════════════════════════

function FocusWidget() {
  const { userId } = useOS()
  const [mins,   setMins]   = useState(0)
  const [goal,   setGoal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!userId) return
    Promise.all([focusSessionsRepo.list(userId), profileRepo.get(userId)])
      .then(([sessions, profile]) => {
        setMins(sumMinutes(getSessionsToday(sessions)))
        setGoal(profile?.focus_goal_minutes ?? 0)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId])

  const pct = goal > 0 ? Math.min(100, Math.round(mins / goal * 100)) : 0

  return (
    <WidgetCard modId="focus" title="Фокус">
      {loading ? <WidgetSkeleton rows={2} /> : error ? <WidgetError /> : (
        <>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-text">{fmtMins(mins)}</span>
            {goal > 0 && <span className="text-xs text-text-6 mb-0.5">из {fmtMins(goal)}</span>}
          </div>
          {goal > 0 ? (
            <>
              <ProgressBar pct={pct} color="#f97316" />
              <p className="text-[10px] text-text-6">{pct}% дневной цели</p>
            </>
          ) : (
            <p className="text-[10px] text-text-7 mt-1">Цель не задана — настройте в модуле</p>
          )}
          {mins === 0 && <p className="text-xs text-text-7">Сессий сегодня нет</p>}
        </>
      )}
    </WidgetCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: NUTRITION
// ═══════════════════════════════════════════════════════════════════════════════

function NutritionWidget() {
  const { userId } = useOS()
  const [macros,    setMacros]    = useState(null)
  const [goal,      setGoal]      = useState(0)
  const [lastEntry, setLastEntry] = useState(null)
  const [timer,     setTimer]     = useState('')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(false)

  useEffect(() => {
    if (!userId) return
    const today = getTodayStr()
    Promise.all([foodEntriesRepo.listByDate(userId, today), profileRepo.get(userId)])
      .then(([entries, profile]) => {
        setMacros(sumMacros(entries))
        setGoal(profile?.calorie_goal ?? 0)
        const last = [...entries].sort((a, b) => (b.time||'00:00').localeCompare(a.time||'00:00'))[0]
        setLastEntry(last ?? null)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId])

  // live timer
  useEffect(() => {
    if (!lastEntry) return
    const update = () => setTimer(timeAgo(lastEntry.date, lastEntry.time) ?? '')
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [lastEntry])

  const pct = goal > 0 && macros ? Math.min(100, Math.round(macros.calories / goal * 100)) : 0

  return (
    <WidgetCard modId="nutrition" title="Питание">
      {loading ? <WidgetSkeleton rows={2} /> : error ? <WidgetError /> : (
        <>
          {!macros || macros.calories === 0 ? (
            <WidgetEmpty msg="Нет данных за сегодня" modId="nutrition" />
          ) : (
            <>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-text">{Math.round(macros.calories)}</span>
                <span className="text-xs text-text-6 mb-0.5">{goal > 0 ? `/ ${goal} ккал` : 'ккал'}</span>
              </div>
              {goal > 0 && <ProgressBar pct={pct} color="#10b981" />}
              <div className="flex gap-3 mt-1">
                {[
                  { label: 'Б', val: macros.protein,  color: '#6c63ff' },
                  { label: 'Ж', val: macros.fat,       color: '#f59e0b' },
                  { label: 'У', val: macros.carbs,     color: '#10b981' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
                    <span className="text-[11px] text-text-4">{Math.round(val)}г</span>
                  </div>
                ))}
              </div>
              {lastEntry && timer && (
                <p className="text-[10px] text-text-7 mt-1">
                  {getMealLabel(lastEntry.mealType)} · {timer}
                </p>
              )}
            </>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: SLEEP
// ═══════════════════════════════════════════════════════════════════════════════

function SleepWidget() {
  const { userId } = useOS()
  const [entry,   setEntry]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!userId) return
    sleepRepo.list(userId)
      .then(list => {
        const sorted = [...list].sort((a, b) => (b.date||'').localeCompare(a.date||''))
        setEntry(sorted[0] ?? null)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId])

  return (
    <WidgetCard modId="sleep" title="Сон">
      {loading ? <WidgetSkeleton rows={2} /> : error ? <WidgetError /> : (
        <>
          {!entry ? (
            <WidgetEmpty msg="Записей нет" modId="sleep" />
          ) : (
            <>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-text">
                  {fmtDuration(entry.durationMinutes)}
                </span>
                {entry.quality && (
                  <div className="flex mb-0.5">{qualityStars(entry.quality)}</div>
                )}
              </div>
              {entry.bedtime && entry.wakeTime && (
                <p className="text-[10px] text-text-6">{entry.bedtime} → {entry.wakeTime}</p>
              )}
              <p className="text-[10px] text-text-7 mt-0.5">
                {entry.date === getTodayStr() ? 'Прошлой ночью'
                  : new Date(entry.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              </p>
            </>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: FINANCE
// ═══════════════════════════════════════════════════════════════════════════════

function FinanceWidget() {
  const { userId } = useOS()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!userId) return
    transactionsRepo.list(userId)
      .then(list => setSummary(getPeriodSummary(list, 'month')))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId])

  const monthLabel = new Date().toLocaleDateString('ru-RU', { month: 'long' })

  return (
    <WidgetCard modId="finance" title="Финансы" badge={monthLabel}>
      {loading ? <WidgetSkeleton rows={2} /> : error ? <WidgetError /> : (
        <>
          {!summary || (summary.income === 0 && summary.expense === 0) ? (
            <WidgetEmpty msg="Транзакций нет" modId="finance" />
          ) : (
            <>
              <div className="flex items-end gap-1.5">
                <span className={`text-2xl font-bold ${summary.net >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {summary.net >= 0 ? '+' : '−'}{fmtMoney(summary.net)}
                </span>
                <span className="text-xs text-text-6 mb-0.5">₽</span>
              </div>
              <div className="flex gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#22c55e]">↑</span>
                  <span className="text-[11px] text-text-4">{fmtMoney(summary.income)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#ef4444]">↓</span>
                  <span className="text-[11px] text-text-4">{fmtMoney(summary.expense)}</span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: GOALS
// ═══════════════════════════════════════════════════════════════════════════════

function GoalsWidget() {
  const { userId } = useOS()
  const [goals,      setGoals]      = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)

  useEffect(() => {
    if (!userId) return
    Promise.all([goalsRepo.list(userId), goalMilestonesRepo.listAll(userId)])
      .then(([g, m]) => { setGoals(g); setMilestones(m) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId])

  const active = goals.filter(g => g.status === 'active').slice(0, 3)

  return (
    <WidgetCard modId="goals" title="Цели">
      {loading ? <WidgetSkeleton rows={2} /> : error ? <WidgetError /> : (
        <>
          {active.length === 0 ? (
            <WidgetEmpty msg="Нет активных целей" modId="goals" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {active.map(goal => {
                const pct = computeProgress(goal, milestones)
                return (
                  <div key={goal.id} className="flex items-center gap-3">
                    <MiniRing pct={pct} color={goal.color} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-2 truncate leading-tight">{goal.icon} {goal.title}</p>
                      <p className="text-[10px] text-text-6">{pct}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: FITNESS
// ═══════════════════════════════════════════════════════════════════════════════

function FitnessWidget() {
  const { userId } = useOS()
  const [workouts, setWorkouts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  useEffect(() => {
    if (!userId) return
    workoutsRepo.list(userId)
      .then(setWorkouts)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId])

  const weekRange = useMemo(() => {
    const today = new Date()
    const diff  = today.getDay() === 0 ? 6 : today.getDay() - 1
    const mon   = new Date(today); mon.setDate(today.getDate() - diff)
    const sun   = new Date(mon);  sun.setDate(mon.getDate() + 6)
    const fmt   = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    return { mon: fmt(mon), sun: fmt(sun) }
  }, [])

  const weekWorkouts = workouts.filter(w => w.date >= weekRange.mon && w.date <= weekRange.sun)
  const last         = workouts[0] ?? null

  return (
    <WidgetCard modId="fitness" title="Тренировки" badge={loading ? '' : `${weekWorkouts.length} на неделе`}>
      {loading ? <WidgetSkeleton rows={2} /> : error ? <WidgetError /> : (
        <>
          {weekWorkouts.length === 0 && !last ? (
            <WidgetEmpty msg="Тренировок нет" modId="fitness" />
          ) : (
            <>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-text">{weekWorkouts.length}</span>
                <span className="text-xs text-text-6 mb-0.5">тренировок на неделе</span>
              </div>
              {last && (
                <p className="text-[10px] text-text-7 mt-1">
                  Последняя: {last.typeEmoji} {last.typeName}
                  {' · '}
                  {new Date(last.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </p>
              )}
            </>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: JOURNAL
// ═══════════════════════════════════════════════════════════════════════════════

const MOOD_EMOJI = { awful: '😞', bad: '😔', ok: '😐', good: '🙂', great: '😄', amazing: '🤩' }

function JournalWidget() {
  const { userId } = useOS()
  const router = useRouter()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!userId) return
    journalRepo.list(userId)
      .then(setEntries)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId])

  const last     = entries[0] ?? null
  const todayStr = getTodayStr()
  const hasToday = last?.date === todayStr

  return (
    <WidgetCard modId="journal" title="Дневник">
      {loading ? <WidgetSkeleton rows={2} /> : error ? <WidgetError /> : (
        <>
          {!last ? (
            <WidgetEmpty msg="Записей нет" modId="journal" />
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-2 truncate leading-snug">
                    {last.title || 'Без заголовка'}
                  </p>
                  <p className="text-[10px] text-text-7 mt-0.5">
                    {new Date(last.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                {last.mood && (
                  <span className="text-base leading-none shrink-0">{MOOD_EMOJI[last.mood] ?? ''}</span>
                )}
              </div>
              {!hasToday && (
                <button
                  onClick={e => { e.stopPropagation(); router.push('/modules/journal') }}
                  className="mt-2 flex items-center gap-1 text-[10px] text-[#6c63ff] hover:text-[#8b85ff] transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" /> Написать сегодня
                </button>
              )}
            </>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: PROJECTS
// ═══════════════════════════════════════════════════════════════════════════════

function ProjectsWidget() {
  const { userId } = useOS()
  const [projects, setProjects] = useState([])
  const [tasks,    setTasks]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  useEffect(() => {
    if (!userId) return
    Promise.all([projectsRepo.list(userId), tasksRepo.list(userId)])
      .then(([p, t]) => { setProjects(p); setTasks(t) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId])

  const active      = projects.filter(p => p.status === 'active')
  const activeShown = active.slice(0, 3)

  return (
    <WidgetCard modId="projects" title="Проекты" badge={loading ? '' : `${active.length} активных`}>
      {loading ? <WidgetSkeleton rows={2} /> : error ? <WidgetError /> : (
        <>
          {activeShown.length === 0 ? (
            <WidgetEmpty msg="Нет активных проектов" modId="projects" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {activeShown.map(proj => {
                const projTasks = tasks.filter(t => t.project_id === proj.id)
                const done  = projTasks.filter(t => t.status === 'done').length
                const total = projTasks.length
                const pct   = total > 0 ? Math.round(done / total * 100) : 0
                return (
                  <div key={proj.id} className="flex items-center gap-2.5">
                    <span className="text-base leading-none shrink-0">{proj.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs text-text-2 truncate">{proj.name}</span>
                        {total > 0 && <span className="text-[10px] text-text-7 shrink-0">{done}/{total}</span>}
                      </div>
                      {total > 0 && <ProgressBar pct={pct} color={proj.color} />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: CALENDAR — compact month grid + day popover
// ═══════════════════════════════════════════════════════════════════════════════

const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

function CalendarWidget() {
  const { userId } = useOS()

  // ── primary data (for grid dots) ──
  const [tasks,       setTasks]       = useState([])
  const [habits,      setHabits]      = useState([])
  const [completions, setCompletions] = useState({})
  const [workouts,    setWorkouts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(false)

  // ── extra data (lazy-loaded on first day click, for popover) ──
  const [foodEntries,  setFoodEntries]  = useState([])
  const [sleepEntries, setSleepEntries] = useState([])
  const [transactions, setTransactions] = useState([])
  const [goals,        setGoals]        = useState([])
  const extraLoadedRef = useRef(false)

  // ── ui state ──
  const [current,      setCurrent]      = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [anchorRect,   setAnchorRect]   = useState(null)

  // Load primary data
  useEffect(() => {
    if (!userId) return
    async function load() {
      try {
        const [tList, hList, wList] = await Promise.all([
          tasksRepo.list(userId),
          habitsRepo.list(userId),
          workoutsRepo.list(userId),
        ])
        setTasks(tList); setHabits(hList); setWorkouts(wList)
        if (hList.length > 0) {
          const comp = await habitCompletionsRepo.listAllByHabits(userId, hList.map(h => h.id))
          setCompletions(comp)
        }
      } catch { setError(true) }
      finally { setLoading(false) }
    }
    load()
  }, [userId])

  // Lazy-load extra data for popover (on first day click)
  const loadExtra = useCallback(async () => {
    if (extraLoadedRef.current || !userId) return
    extraLoadedRef.current = true
    try {
      const [food, sleep, txs, gs] = await Promise.all([
        foodEntriesRepo.listAll(userId),
        sleepRepo.list(userId),
        transactionsRepo.list(userId),
        goalsRepo.list(userId),
      ])
      setFoodEntries(food); setSleepEntries(sleep); setTransactions(txs); setGoals(gs)
    } catch { /* silent — popover shows partial data */ }
  }, [userId])

  const today = getTodayStr()

  const dayMap = useMemo(() => buildDayMap([
    ...normalizeTaskEvents(tasks),
    ...normalizeHabitEvents(habits, completions),
    ...normalizeWorkoutEvents(workouts),
  ]), [tasks, habits, completions, workouts])

  // Derive full day data for the popover
  const popoverDayData = useMemo(() => {
    if (!selectedDate) return null
    const ds = localStr(selectedDate)

    const dayFood = foodEntries.filter(f => f.date === ds)
    const food = dayFood.length > 0 ? {
      calories: dayFood.reduce((s, f) => s + (f.calories ?? 0), 0),
      protein:  dayFood.reduce((s, f) => s + (f.protein  ?? 0), 0),
      fat:      dayFood.reduce((s, f) => s + (f.fat      ?? 0), 0),
      carbs:    dayFood.reduce((s, f) => s + (f.carbs    ?? 0), 0),
    } : null

    return {
      tasks:        tasks.filter(t => t.due_date === ds),
      habits:       habits.filter(h => (completions[h.id] ?? []).includes(ds)),
      workouts:     workouts.filter(w => w.date === ds),
      food,
      sleep:        sleepEntries.find(s => s.date === ds) ?? null,
      transactions: transactions.filter(t => t.date === ds),
      goals:        goals.filter(g => g.deadline === ds),
    }
  }, [selectedDate, tasks, habits, completions, workouts, foodEntries, sleepEntries, transactions, goals])

  const year  = current.getFullYear()
  const month = current.getMonth()

  const navigate = (dir, e) => {
    e.stopPropagation()
    setCurrent(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + dir); return d })
  }

  const goToday = (e) => { e.stopPropagation(); setCurrent(new Date()) }

  const handleDayClick = useCallback((date, rect) => {
    setSelectedDate(date)
    setAnchorRect(rect)
    loadExtra()
  }, [loadExtra])

  const closePopover = useCallback(() => {
    setSelectedDate(null)
    setAnchorRect(null)
  }, [])

  // Compact skeleton
  const CalSkeleton = () => (
    <div className="flex flex-col gap-0.5 h-full">
      <div className="grid grid-cols-7 gap-px mb-0.5">
        {Array.from({length: 7}).map((_,i) => <div key={i} className="h-3 bg-surface-2 rounded animate-pulse" />)}
      </div>
      {Array.from({length: 5}).map((_,i) => (
        <div key={i} className="grid grid-cols-7 gap-px">
          {Array.from({length: 7}).map((_,j) => <div key={j} className="h-9 bg-surface-2 rounded-md animate-pulse" />)}
        </div>
      ))}
    </div>
  )

  return (
    <>
      <WidgetCard modId="calendar" title="Календарь">
        {loading ? <CalSkeleton /> : error ? <WidgetError /> : (
          <div className="h-full flex flex-col gap-1.5">
            {/* Month navigation */}
            <div className="flex items-center justify-between shrink-0">
              <button onClick={e => navigate(-1, e)} className="p-0.5 rounded text-text-7 hover:text-text transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button onClick={goToday} className="text-[10px] text-text-6 hover:text-[#6c63ff] transition-colors font-medium">
                {MONTHS_SHORT[month]} {year}
              </button>
              <button onClick={e => navigate(1, e)} className="p-0.5 rounded text-text-7 hover:text-text transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Compact month grid — clicks open the day popover */}
            <div className="flex-1 min-h-0">
              <CompactMonthCalendar
                year={year}
                month={month}
                dayMap={dayMap}
                today={today}
                onDayClick={handleDayClick}
              />
            </div>
          </div>
        )}
      </WidgetCard>

      {/* Day popover rendered via portal — outside the widget DOM tree */}
      {selectedDate && popoverDayData && (
        <DayPopover
          date={selectedDate}
          dateStr={localStr(selectedDate)}
          today={today}
          anchor={anchorRect}
          dayData={popoverDayData}
          onClose={closePopover}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET MAP
// ═══════════════════════════════════════════════════════════════════════════════

const WIDGET_MAP = {
  tasks:     TasksWidget,
  habits:    HabitsWidget,
  focus:     FocusWidget,
  nutrition: NutritionWidget,
  sleep:     SleepWidget,
  finance:   FinanceWidget,
  goals:     GoalsWidget,
  fitness:   FitnessWidget,
  journal:   JournalWidget,
  projects:  ProjectsWidget,
  calendar:  CalendarWidget,
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function HomeScreen() {
  const { activeModules } = useOS()
  const router = useRouter()

  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  // modules that have a dashboard widget, in user-defined order
  const widgetModules = activeModules.filter(id => id in WIDGET_MAP)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="text-text-6 text-sm capitalize">{today}</p>
        <h1 className="text-2xl font-bold text-text mt-1">Сегодня</h1>
      </div>

      {/* Empty state */}
      {activeModules.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center text-2xl">⊞</div>
          <div>
            <p className="text-text font-semibold">Нет активных модулей</p>
            <p className="text-text-6 text-sm mt-1">Добавьте модули, чтобы начать</p>
          </div>
          <button
            onClick={() => router.push('/modules')}
            className="mt-1 bg-[#6c63ff] hover:bg-[#8b85ff] text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Выбрать модули
          </button>
        </div>
      ) : (
        /* Adaptive auto-layout grid:
           - 4 cols on desktop, 2 on tablet, 1 on mobile
           - All normal widgets: 1×1 cells (uniform 160px height)
           - Calendar widget: 2 cols × 2 rows (prominently larger)
           - grid-auto-flow: dense fills gaps when modules are disabled */
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          style={{ gridAutoFlow: 'dense', gridAutoRows: '160px' }}
        >
          {widgetModules.map(id => {
            const W = WIDGET_MAP[id]
            const isCalendar = id === 'calendar'
            return (
              <div
                key={id}
                className={isCalendar ? 'sm:col-span-2 row-span-2' : ''}
              >
                <W />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
