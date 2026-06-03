'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertCircle, BarChart2 } from 'lucide-react'
import { useOS }                      from '../../lib/store'
import { MODULE_ICONS }               from '../../lib/moduleIcons'
import { supabase }                   from '../../lib/supabase'
import { tasksRepo }                  from '../../lib/db/tasks'
import { habitsRepo }                 from '../../lib/db/habits'
import { habitCompletionsRepo }       from '../../lib/db/habitCompletions'
import { focusSessionsRepo }          from '../../lib/db/focusSessions'
import { foodEntriesRepo }            from '../../lib/db/foodEntries'
import { sleepRepo }                  from '../../lib/db/sleep'
import { workoutsRepo }               from '../../lib/db/workouts'
import { transactionsRepo }           from '../../lib/db/transactions'
import { financeCategoriesRepo }      from '../../lib/db/financeCategories'
import { goalsRepo }                  from '../../lib/db/goals'
import { goalMilestonesRepo }         from '../../lib/db/goalMilestones'
import { profileRepo }                from '../../lib/db/profile'
import { getTodayStr }                from '../../lib/tasks-selectors'
import { isScheduledToday }           from '../../lib/habits-selectors'
import { computeProgress }            from '../../lib/goals-selectors'
import { fmtDuration }                from '../../lib/sleep-selectors'

// ─── date helpers ─────────────────────────────────────────────────────────────

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getPeriodRange(period) {
  const today    = getTodayStr()
  const todayD   = new Date(today + 'T00:00:00')
  if (period === 'week') {
    const dow  = todayD.getDay() === 0 ? 6 : todayD.getDay() - 1
    const mon  = new Date(todayD); mon.setDate(todayD.getDate() - dow)
    return { from: localStr(mon), to: today }
  }
  if (period === 'month') {
    const y = todayD.getFullYear(); const m = todayD.getMonth() + 1
    return { from: `${y}-${String(m).padStart(2,'0')}-01`, to: today }
  }
  return { from: '2000-01-01', to: today }
}

function buildBuckets(period, from) {
  const today  = getTodayStr()
  const todayD = new Date(today + 'T00:00:00')
  const WDAYS  = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
  const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

  if (period === 'week') {
    const fromD = new Date(from + 'T00:00:00')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(fromD); d.setDate(fromD.getDate() + i)
      const s = localStr(d)
      return { label: WDAYS[i], from: s, to: s, future: s > today }
    })
  }
  if (period === 'month') {
    const fromD = new Date(from + 'T00:00:00')
    const buckets = []
    for (let w = 0; w < 6; w++) {
      const ws = new Date(fromD); ws.setDate(fromD.getDate() + w * 7)
      if (localStr(ws) > today) break
      const we = new Date(ws); we.setDate(ws.getDate() + 6)
      buckets.push({ label: `Нед ${w+1}`, from: localStr(ws), to: localStr(we) > today ? today : localStr(we) })
    }
    return buckets
  }
  // all time: last 12 months
  return Array.from({ length: 12 }, (_, i) => {
    const m    = new Date(todayD.getFullYear(), todayD.getMonth() - (11 - i), 1)
    const mEnd = new Date(todayD.getFullYear(), todayD.getMonth() - (11 - i) + 1, 0)
    return {
      label: MONTHS[m.getMonth()],
      from:  localStr(m),
      to:    localStr(mEnd) > today ? today : localStr(mEnd),
      future: false,
    }
  })
}

function inRange(dateStr, from, to) {
  return dateStr && dateStr >= from && dateStr <= to
}

function fmtMoney(n) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
}

// ─── shared UI ────────────────────────────────────────────────────────────────

function AnalyticsCard({ modId, title, children }) {
  const mi = MODULE_ICONS[modId]
  return (
    <div className="bg-[#1d1d1d] border border-[#333] rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {mi && (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: mi.color+'20' }}>
            <mi.Icon className="w-3 h-3" style={{ color: mi.color }} />
          </div>
        )}
        <span className="text-[11px] font-semibold text-[#666] uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}

function StatGrid({ stats }) {
  return (
    <div className={`grid gap-3 ${stats.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
      {stats.map(({ label, value, sub, color }) => (
        <div key={label} className="bg-[#161616] border border-[#252525] rounded-xl px-3 py-3">
          <p className="text-[10px] text-[#444] mb-1">{label}</p>
          <p className="text-xl font-bold" style={{ color: color || '#f0f0f0' }}>{value}</p>
          {sub && <p className="text-[10px] text-[#444] mt-0.5">{sub}</p>}
        </div>
      ))}
    </div>
  )
}

function MiniBarChart({ data, color = '#6c63ff', unit = '', showLabels = true }) {
  if (!data?.length) return null
  const maxVal = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-1 h-14">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full">
            <div
              className="w-full rounded-sm min-h-[2px] transition-all"
              style={{
                height: `${Math.max(2, Math.round(d.value / maxVal * 100))}%`,
                background: d.future ? '#222' : color,
                opacity: d.future ? 0.3 : 1,
              }}
            />
          </div>
        ))}
      </div>
      {showLabels && (
        <div className="flex gap-1">
          {data.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-[8px] text-[#333]">{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ pct, color = '#6c63ff', label }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-[#555] truncate max-w-[160px]">{label}</span>
          <span className="text-[10px] text-[#444]">{pct}%</span>
        </div>
      )}
      <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <p className="text-xs text-[#444] text-center py-3">{text || 'Недостаточно данных'}</p>
  )
}

function WidgetError() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[#555] py-2">
      <AlertCircle className="w-3.5 h-3.5 text-[#ef4444]/60 shrink-0" />не удалось загрузить
    </div>
  )
}

function WidgetSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[80, 60, 90].map((w, i) => (
        <div key={i} className="h-6 bg-[#222] rounded animate-pulse" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

// ─── TASKS widget ─────────────────────────────────────────────────────────────

function TasksWidget({ tasks, buckets, range, period }) {
  const inPeriod    = tasks.filter(t => {
    const d = t.status === 'done' ? (t.completed_at ? t.completed_at.slice(0,10) : t.due_date) : t.due_date
    return inRange(d, range.from, range.to)
  })
  const done        = inPeriod.filter(t => t.status === 'done').length
  const total       = inPeriod.length
  const completePct = total > 0 ? Math.round(done / total * 100) : 0

  const barData = buckets.map(b => ({
    label: b.label,
    value: tasks.filter(t => {
      const d = t.completed_at ? t.completed_at.slice(0,10) : t.due_date
      return t.status === 'done' && inRange(d, b.from, b.to)
    }).length,
    future: b.future,
  }))

  return (
    <AnalyticsCard modId="tasks" title="Задачи">
      <StatGrid stats={[
        { label: 'Выполнено',  value: done, color: '#6c63ff' },
        { label: '% завершения', value: `${completePct}%`, color: completePct >= 70 ? '#22c55e' : '#f59e0b' },
      ]} />
      {total === 0
        ? <EmptyState text="Задач за период нет" />
        : <MiniBarChart data={barData} color="#6c63ff" />
      }
    </AnalyticsCard>
  )
}

// ─── HABITS widget ────────────────────────────────────────────────────────────

function HabitsWidget({ habits, completions, range }) {
  if (!habits.length) return (
    <AnalyticsCard modId="habits" title="Привычки"><EmptyState text="Нет привычек" /></AnalyticsCard>
  )

  const allRates = habits.map(h => {
    const dates    = completions[h.id] || []
    const inP      = dates.filter(d => inRange(d, range.from, range.to)).length
    const daysInP  = Math.max(1, Math.ceil((new Date(range.to+'T00:00:00') - new Date(range.from+'T00:00:00')) / 86400000) + 1)
    const pct      = Math.round(inP / daysInP * 100)
    return { habit: h, inP, pct }
  })

  const avgPct = Math.round(allRates.reduce((s, r) => s + r.pct, 0) / allRates.length)

  return (
    <AnalyticsCard modId="habits" title="Привычки">
      <StatGrid stats={[
        { label: 'Ср. выполнение', value: `${avgPct}%`, color: '#8b85ff' },
        { label: 'Привычек', value: habits.length },
      ]} />
      <div className="flex flex-col gap-2">
        {allRates.map(({ habit, pct }) => (
          <ProgressBar key={habit.id} pct={pct} color={habit.color || '#8b85ff'}
            label={`${habit.emoji} ${habit.name}`} />
        ))}
      </div>
      {allRates.every(r => r.inP === 0) && <EmptyState text="Нет отметок за период" />}
    </AnalyticsCard>
  )
}

// ─── FOCUS widget ─────────────────────────────────────────────────────────────

function FocusWidget({ sessions, profile, buckets, range }) {
  const inPeriod = sessions.filter(s => s.type === 'focus' && s.completed && inRange(s.date, range.from, range.to))
  const totalMin = inPeriod.reduce((s, x) => s + (x.duration_minutes || 0), 0)
  const goalMin  = profile?.focus_goal_minutes || 0
  const sessions7 = inPeriod.length

  const barData = buckets.map(b => ({
    label: b.label,
    value: sessions.filter(s => s.type === 'focus' && s.completed && inRange(s.date, b.from, b.to))
                   .reduce((s, x) => s + (x.duration_minutes || 0), 0),
    future: b.future,
  }))

  function fmtM(m) {
    const h = Math.floor(m/60); const min = m%60
    return h > 0 ? (min > 0 ? `${h}ч ${min}м` : `${h}ч`) : `${m}м`
  }

  return (
    <AnalyticsCard modId="focus" title="Фокус">
      <StatGrid stats={[
        { label: 'Время фокуса', value: fmtM(totalMin), color: '#f97316' },
        { label: 'Сессий',       value: sessions7 },
        ...(goalMin > 0 ? [{ label: 'Достиг цели', value: inPeriod.length > 0 ? `${Math.round(totalMin/goalMin*100)}%` : '0%' }] : []),
      ]} />
      {totalMin === 0
        ? <EmptyState text="Нет сессий за период" />
        : <MiniBarChart data={barData} color="#f97316" unit="м" />
      }
    </AnalyticsCard>
  )
}

// ─── NUTRITION widget ─────────────────────────────────────────────────────────

function NutritionWidget({ food, profile, buckets, range }) {
  const inPeriod = food.filter(e => inRange(e.date, range.from, range.to))
  const goal     = profile?.calorie_goal || 0

  if (!inPeriod.length) return (
    <AnalyticsCard modId="nutrition" title="Питание"><EmptyState text="Нет данных за период" /></AnalyticsCard>
  )

  const days     = [...new Set(inPeriod.map(e => e.date))]
  const avgCal   = Math.round(inPeriod.reduce((s, e) => s + e.calories, 0) / days.length)
  const avgProt  = Math.round(inPeriod.reduce((s, e) => s + (Number(e.protein)||0), 0) / days.length)
  const avgFat   = Math.round(inPeriod.reduce((s, e) => s + (Number(e.fat)||0), 0) / days.length)
  const avgCarbs = Math.round(inPeriod.reduce((s, e) => s + (Number(e.carbs)||0), 0) / days.length)

  const barData = buckets.map(b => {
    const bEntries = inPeriod.filter(e => inRange(e.date, b.from, b.to))
    const bDays    = [...new Set(bEntries.map(e => e.date))].length || 1
    return { label: b.label, value: Math.round(bEntries.reduce((s,e) => s+e.calories, 0) / bDays), future: b.future }
  })

  return (
    <AnalyticsCard modId="nutrition" title="Питание">
      <StatGrid stats={[
        { label: 'Ср. ккал/день', value: avgCal, color: '#10b981',
          sub: goal > 0 ? `цель ${goal}` : undefined },
        { label: 'Б / Ж / У',    value: `${avgProt}/${avgFat}/${avgCarbs}г` },
      ]} />
      <MiniBarChart data={barData} color="#10b981" />
      {goal > 0 && <ProgressBar pct={Math.round(avgCal/goal*100)} color="#10b981" label="Ср. % цели калорий" />}
    </AnalyticsCard>
  )
}

// ─── SLEEP widget ─────────────────────────────────────────────────────────────

function SleepWidget({ sleep, buckets, range }) {
  const inPeriod = sleep.filter(e => inRange(e.date, range.from, range.to))

  if (!inPeriod.length) return (
    <AnalyticsCard modId="sleep" title="Сон"><EmptyState text="Нет данных за период" /></AnalyticsCard>
  )

  const avgMin   = Math.round(inPeriod.reduce((s, e) => s + (e.durationMinutes||0), 0) / inPeriod.length)
  const withQ    = inPeriod.filter(e => e.quality != null)
  const avgQ     = withQ.length ? (withQ.reduce((s,e) => s+e.quality, 0) / withQ.length).toFixed(1) : null

  const barData = buckets.map(b => {
    const bE   = inPeriod.filter(e => inRange(e.date, b.from, b.to))
    const bAvg = bE.length ? Math.round(bE.reduce((s,e) => s+(e.durationMinutes||0),0) / bE.length) : 0
    return { label: b.label, value: bAvg, future: b.future }
  })

  return (
    <AnalyticsCard modId="sleep" title="Сон">
      <StatGrid stats={[
        { label: 'Ср. длительность', value: fmtDuration(avgMin), color: '#3b82f6' },
        ...(avgQ ? [{ label: 'Ср. качество', value: `${avgQ}/5` }] : []),
        { label: 'Ночей',            value: inPeriod.length },
      ]} />
      <MiniBarChart data={barData} color="#3b82f6" />
    </AnalyticsCard>
  )
}

// ─── FITNESS widget ───────────────────────────────────────────────────────────

function FitnessWidget({ workouts, buckets, range }) {
  const inPeriod = workouts.filter(w => inRange((w.date||'').slice(0,10), range.from, range.to))

  if (!inPeriod.length) return (
    <AnalyticsCard modId="fitness" title="Тренировки"><EmptyState text="Нет тренировок за период" /></AnalyticsCard>
  )

  const totalMin = inPeriod.reduce((s, w) => s + (w.duration||0), 0)
  const types    = [...new Map(inPeriod.filter(w => w.typeName).map(w => [w.typeName, w])).values()]
    .slice(0, 4)

  const barData = buckets.map(b => ({
    label: b.label,
    value: workouts.filter(w => inRange((w.date||'').slice(0,10), b.from, b.to)).length,
    future: b.future,
  }))

  function fmtM(m) {
    const h = Math.floor(m/60); const min = m%60
    return h > 0 ? (min > 0 ? `${h}ч ${min}м` : `${h}ч`) : `${m}м`
  }

  return (
    <AnalyticsCard modId="fitness" title="Тренировки">
      <StatGrid stats={[
        { label: 'Тренировок',  value: inPeriod.length, color: '#22c55e' },
        { label: 'Общее время', value: fmtM(totalMin) },
      ]} />
      <MiniBarChart data={barData} color="#22c55e" />
      {types.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {types.map(w => (
            <span key={w.typeName}
              className="flex items-center gap-1 px-2 py-0.5 bg-[#161616] border border-[#252525] rounded-full text-[10px] text-[#888]"
            >
              <span>{w.typeEmoji}</span>{w.typeName}
            </span>
          ))}
        </div>
      )}
    </AnalyticsCard>
  )
}

// ─── FINANCE widget ───────────────────────────────────────────────────────────

function FinanceWidget({ transactions, categories, buckets, range }) {
  const inPeriod = transactions.filter(t => inRange(t.date, range.from, range.to))

  if (!inPeriod.length) return (
    <AnalyticsCard modId="finance" title="Финансы"><EmptyState text="Нет транзакций за период" /></AnalyticsCard>
  )

  const income  = inPeriod.filter(t => t.type==='income').reduce((s,t) => s+t.amount, 0)
  const expense = inPeriod.filter(t => t.type==='expense').reduce((s,t) => s+t.amount, 0)
  const net     = income - expense

  // top expense categories
  const catMap = {}
  inPeriod.filter(t => t.type==='expense').forEach(t => {
    const k = t.categoryId || 'other'
    catMap[k] = (catMap[k] || 0) + t.amount
  })
  const topCats = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0, 4)

  const netBarData = buckets.map(b => {
    const bTxns   = transactions.filter(t => inRange(t.date, b.from, b.to))
    const bIncome = bTxns.filter(t=>t.type==='income').reduce((s,t) => s+t.amount,0)
    const bExp    = bTxns.filter(t=>t.type==='expense').reduce((s,t) => s+t.amount,0)
    return { label: b.label, value: Math.max(0, bIncome - bExp), future: b.future }
  })

  return (
    <AnalyticsCard modId="finance" title="Финансы">
      <StatGrid stats={[
        { label: 'Доходы',  value: `${fmtMoney(income)} ₽`, color: '#22c55e' },
        { label: 'Расходы', value: `${fmtMoney(expense)} ₽`, color: '#ef4444' },
        { label: 'Нетто',   value: `${net >= 0 ? '+' : '−'}${fmtMoney(Math.abs(net))} ₽`,
          color: net >= 0 ? '#22c55e' : '#ef4444' },
      ]} />
      <MiniBarChart data={netBarData} color="#f59e0b" />
      {topCats.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] text-[#333] uppercase tracking-wider">Топ расходы</p>
          {topCats.map(([catId, total]) => {
            const cat = categories.find(c => c.id === catId)
            return (
              <div key={catId} className="flex items-center justify-between">
                <span className="text-[11px] text-[#888]">{cat ? `${cat.emoji} ${cat.name}` : 'Прочее'}</span>
                <span className="text-[11px] text-[#555]">{fmtMoney(total)} ₽</span>
              </div>
            )
          })}
        </div>
      )}
    </AnalyticsCard>
  )
}

// ─── GOALS widget ─────────────────────────────────────────────────────────────

function GoalsWidget({ goals, milestones }) {
  const active = goals.filter(g => g.status === 'active')

  if (!active.length) return (
    <AnalyticsCard modId="goals" title="Цели"><EmptyState text="Нет активных целей" /></AnalyticsCard>
  )

  return (
    <AnalyticsCard modId="goals" title="Цели">
      <div className="flex flex-col gap-3">
        {active.map(goal => {
          const pct = computeProgress(goal, milestones)
          return (
            <div key={goal.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#ccc] truncate">{goal.icon} {goal.title}</span>
                <span className="text-[10px] text-[#555] shrink-0 ml-2">{pct}%</span>
              </div>
              <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: goal.color || '#8b5cf6' }} />
              </div>
            </div>
          )
        })}
      </div>
    </AnalyticsCard>
  )
}

// ─── WIDGET MAP ───────────────────────────────────────────────────────────────

const WIDE_MODULES = new Set(['tasks', 'finance', 'nutrition'])

// ─── ANALYTICS SCREEN ─────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const { activeModules, userId } = useOS()

  const [period,      setPeriod]      = useState('month')
  const [allData,     setAllData]     = useState(null)
  const [loadErr,     setLoadErr]     = useState({})
  const [loading,     setLoading]     = useState(true)
  const [daysInSys,   setDaysInSys]   = useState(null)

  // ── load all data once ────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return

    // days in system (local date, inclusive)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.created_at) {
        const c = new Date(user.created_at)
        const created = new Date(c.getFullYear(), c.getMonth(), c.getDate())
        const today   = new Date(); const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        setDaysInSys(Math.max(1, Math.floor((t - created) / 86400000) + 1))
      }
    }).catch(() => {})

    const errors = {}
    const safe = (key, fn) => fn().catch(e => { errors[key] = true; console.error(`Analytics ${key}:`, e.message); return null })

    ;(async () => {
      const [tasks, habits, focus, food, sleep, workouts, transactions, categories, goals, milestones, profile] = await Promise.all([
        safe('tasks',        () => tasksRepo.list(userId)),
        safe('habits',       () => habitsRepo.list(userId)),
        safe('focus',        () => focusSessionsRepo.list(userId)),
        safe('food',         () => foodEntriesRepo.listAll(userId)),
        safe('sleep',        () => sleepRepo.list(userId)),
        safe('workouts',     () => workoutsRepo.list(userId)),
        safe('transactions', () => transactionsRepo.list(userId)),
        safe('categories',   () => financeCategoriesRepo.list(userId)),
        safe('goals',        () => goalsRepo.list(userId)),
        safe('milestones',   () => goalMilestonesRepo.listAll(userId)),
        safe('profile',      () => profileRepo.get(userId)),
      ])

      // completions: only load if habits succeeded
      let completions = {}
      if (habits?.length) {
        try { completions = await habitCompletionsRepo.listAllByHabits(userId, habits.map(h => h.id)) }
        catch { errors.completions = true }
      }

      setAllData({ tasks, habits, completions, focus, food, sleep, workouts, transactions, categories, goals, milestones, profile })
      setLoadErr(errors)
      setLoading(false)
    })()
  }, [userId])

  // ── period ────────────────────────────────────────────────────────────────

  const range   = useMemo(() => getPeriodRange(period),          [period])
  const buckets = useMemo(() => buildBuckets(period, range.from), [period, range.from])

  // ── render ────────────────────────────────────────────────────────────────

  const PERIOD_TABS = [
    { key: 'week',  label: 'Неделя'   },
    { key: 'month', label: 'Месяц'    },
    { key: 'all',   label: 'Всё время'},
  ]

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#f0f0f0]">Аналитика</h1>
        <p className="text-[#555] text-sm mt-1">Прогресс по вашим активностям</p>
      </div>

      {activeModules.length === 0 ? (
        <div className="bg-[#1d1d1d] border border-[#333] rounded-xl p-10 text-center">
          <p className="text-[#555] text-sm">Добавьте модули для отображения аналитики</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* Top stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1d1d1d] border border-[#333] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-widest text-[#444] mb-2">Активных модулей</p>
              <p className="text-4xl font-bold text-[#6c63ff]">{activeModules.length}</p>
            </div>
            <div className="bg-[#1d1d1d] border border-[#333] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-widest text-[#444] mb-2">Дней в системе</p>
              {daysInSys === null
                ? <div className="h-10 w-16 bg-[#222] rounded animate-pulse" />
                : <p className="text-4xl font-bold text-[#f0f0f0]">{daysInSys}</p>
              }
            </div>
          </div>

          {/* Period selector */}
          <div className="flex gap-1 bg-[#111] rounded-xl p-1">
            {PERIOD_TABS.map(t => (
              <button key={t.key} onClick={() => setPeriod(t.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  period === t.key ? 'bg-[#2a2a2a] text-[#f0f0f0]' : 'text-[#555] hover:text-[#f0f0f0]'
                }`}
              >{t.label}</button>
            ))}
          </div>

          {/* Widgets */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className={`bg-[#1d1d1d] border border-[#333] rounded-xl p-5 ${i <= 2 ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
                  <WidgetSkeleton />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-min">
              {activeModules.map(modId => {
                const d = allData
                const isWide = WIDE_MODULES.has(modId)

                const renderWidget = () => {
                  switch (modId) {
                    case 'tasks':
                      if (loadErr.tasks || !d?.tasks) return <AnalyticsCard modId="tasks" title="Задачи"><WidgetError /></AnalyticsCard>
                      return <TasksWidget tasks={d.tasks} buckets={buckets} range={range} period={period} />
                    case 'habits':
                      if (loadErr.habits || !d?.habits) return <AnalyticsCard modId="habits" title="Привычки"><WidgetError /></AnalyticsCard>
                      return <HabitsWidget habits={d.habits} completions={d.completions||{}} range={range} />
                    case 'focus':
                      if (loadErr.focus || !d?.focus) return <AnalyticsCard modId="focus" title="Фокус"><WidgetError /></AnalyticsCard>
                      return <FocusWidget sessions={d.focus} profile={d.profile} buckets={buckets} range={range} />
                    case 'nutrition':
                      if (loadErr.food || !d?.food) return <AnalyticsCard modId="nutrition" title="Питание"><WidgetError /></AnalyticsCard>
                      return <NutritionWidget food={d.food} profile={d.profile} buckets={buckets} range={range} />
                    case 'sleep':
                      if (loadErr.sleep || !d?.sleep) return <AnalyticsCard modId="sleep" title="Сон"><WidgetError /></AnalyticsCard>
                      return <SleepWidget sleep={d.sleep} buckets={buckets} range={range} />
                    case 'fitness':
                      if (loadErr.workouts || !d?.workouts) return <AnalyticsCard modId="fitness" title="Тренировки"><WidgetError /></AnalyticsCard>
                      return <FitnessWidget workouts={d.workouts} buckets={buckets} range={range} />
                    case 'finance':
                      if (loadErr.transactions || !d?.transactions) return <AnalyticsCard modId="finance" title="Финансы"><WidgetError /></AnalyticsCard>
                      return <FinanceWidget transactions={d.transactions} categories={d.categories||[]} buckets={buckets} range={range} />
                    case 'goals':
                      if (loadErr.goals || !d?.goals) return <AnalyticsCard modId="goals" title="Цели"><WidgetError /></AnalyticsCard>
                      return <GoalsWidget goals={d.goals} milestones={d.milestones||[]} />
                    default:
                      return null
                  }
                }

                const widget = renderWidget()
                if (!widget) return null
                return (
                  <div key={modId} className={isWide ? 'sm:col-span-2 lg:col-span-2' : ''}>
                    {widget}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
