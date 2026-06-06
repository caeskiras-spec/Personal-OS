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
import { computeProgress }            from '../../lib/goals-selectors'
import { fmtDuration }                from '../../lib/sleep-selectors'

// ─── date helpers ─────────────────────────────────────────────────────────────

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getPeriodRange(period) {
  const today  = getTodayStr()
  const todayD = new Date(today + 'T00:00:00')
  if (period === 'week') {
    const dow = todayD.getDay() === 0 ? 6 : todayD.getDay() - 1
    const mon = new Date(todayD); mon.setDate(todayD.getDate() - dow)
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

// Matches WidgetCard header style from HomeScreen exactly
function AnalyticsCard({ modId, title, children }) {
  const mi = MODULE_ICONS[modId]
  return (
    <div className="bg-card border border-border-2 rounded-xl flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 shrink-0">
        {mi && (
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ background: mi.color + '20' }}>
            <mi.Icon className="w-3 h-3" style={{ color: mi.color }} />
          </div>
        )}
        <span className="text-[11px] font-semibold text-text-4 uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex flex-col gap-3 min-h-0">
        {children}
      </div>
    </div>
  )
}

function StatRow({ stats }) {
  return (
    <div className={`grid gap-2 ${stats.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
      {stats.map(({ label, value, sub, color }) => (
        <div key={label} className="bg-surface rounded-lg px-3 py-2.5">
          <p className="text-[10px] text-text-7 mb-1 leading-none">{label}</p>
          <p className="text-lg font-bold leading-none" style={{ color: color || 'rgb(var(--text-rgb))' }}>{value}</p>
          {sub && <p className="text-[10px] text-text-7 mt-1 leading-none">{sub}</p>}
        </div>
      ))}
    </div>
  )
}

function MiniBarChart({ data, color = '#6c63ff' }) {
  if (!data?.length) return null
  const maxVal = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-[3px] h-12">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className="w-full rounded-sm transition-all"
              style={{
                height: `${Math.max(2, Math.round(d.value / maxVal * 100))}%`,
                minHeight: '2px',
                background: d.future ? 'rgb(var(--muted-rgb)/0.3)' : color + 'cc',
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[8px] text-text-8 leading-none">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressBar({ pct, color = '#6c63ff', label }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex justify-between items-center gap-2">
          <span className="text-[10px] text-text-5 truncate">{label}</span>
          <span className="text-[10px] text-text-7 shrink-0">{pct}%</span>
        </div>
      )}
      <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-4 gap-1.5">
      <BarChart2 className="w-5 h-5 text-text-8" />
      <p className="text-[11px] text-text-7 text-center">{text || 'Нет данных за период'}</p>
    </div>
  )
}

function CardError() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-text-6 py-2">
      <AlertCircle className="w-3.5 h-3.5 text-[#ef4444]/60 shrink-0" />
      Не удалось загрузить
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="bg-card border border-border-2 rounded-xl p-4 flex flex-col gap-3">
      <div className="h-4 w-24 bg-surface-2 rounded animate-pulse" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-14 bg-surface-2 rounded-lg animate-pulse" />
        <div className="h-14 bg-surface-2 rounded-lg animate-pulse" />
      </div>
      <div className="h-12 bg-surface-2 rounded animate-pulse" />
    </div>
  )
}

// ─── TASKS widget ─────────────────────────────────────────────────────────────

function TasksWidget({ tasks, buckets, range }) {
  const inPeriod = tasks.filter(t => {
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

  const mi = MODULE_ICONS['tasks']
  return (
    <AnalyticsCard modId="tasks" title="Задачи">
      {total === 0
        ? <EmptyState text="Задач за период нет" />
        : <>
            <StatRow stats={[
              { label: 'Выполнено',    value: done,            color: mi?.color },
              { label: '% завершения', value: `${completePct}%`,
                color: completePct >= 70 ? '#22c55e' : '#f59e0b' },
            ]} />
            <MiniBarChart data={barData} color={mi?.color} />
          </>
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
    const dates   = completions[h.id] || []
    const inP     = dates.filter(d => inRange(d, range.from, range.to)).length
    const daysInP = Math.max(1, Math.ceil((new Date(range.to+'T00:00:00') - new Date(range.from+'T00:00:00')) / 86400000) + 1)
    return { habit: h, inP, pct: Math.round(inP / daysInP * 100) }
  })

  const avgPct = Math.round(allRates.reduce((s, r) => s + r.pct, 0) / allRates.length)
  const mi = MODULE_ICONS['habits']

  return (
    <AnalyticsCard modId="habits" title="Привычки">
      <StatRow stats={[
        { label: 'Ср. выполнение', value: `${avgPct}%`, color: mi?.color },
        { label: 'Привычек',       value: habits.length },
      ]} />
      {allRates.every(r => r.inP === 0)
        ? <EmptyState text="Нет отметок за период" />
        : <div className="flex flex-col gap-2">
            {allRates.map(({ habit, pct }) => (
              <ProgressBar key={habit.id} pct={pct} color={habit.color || mi?.color}
                label={`${habit.emoji || ''} ${habit.name}`} />
            ))}
          </div>
      }
    </AnalyticsCard>
  )
}

// ─── FOCUS widget ─────────────────────────────────────────────────────────────

function FocusWidget({ sessions, profile, buckets, range }) {
  const inPeriod = sessions.filter(s => s.type === 'focus' && s.completed && inRange(s.date, range.from, range.to))
  const totalMin = inPeriod.reduce((s, x) => s + (x.duration_minutes || 0), 0)
  const goalMin  = profile?.focus_goal_minutes || 0

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

  const mi = MODULE_ICONS['focus']
  return (
    <AnalyticsCard modId="focus" title="Фокус">
      {totalMin === 0
        ? <EmptyState text="Нет сессий за период" />
        : <>
            <StatRow stats={[
              { label: 'Время',   value: fmtM(totalMin), color: mi?.color },
              { label: 'Сессий', value: inPeriod.length },
              ...(goalMin > 0 ? [{ label: '% цели', value: `${Math.round(totalMin/goalMin*100)}%` }] : []),
            ]} />
            <MiniBarChart data={barData} color={mi?.color} />
          </>
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
  const n        = days.length || 1
  const avgCal   = Math.round(inPeriod.reduce((s, e) => s + e.calories, 0) / n)
  const avgProt  = Math.round(inPeriod.reduce((s, e) => s + (Number(e.protein)||0), 0) / n)
  const avgFat   = Math.round(inPeriod.reduce((s, e) => s + (Number(e.fat)||0), 0) / n)
  const avgCarbs = Math.round(inPeriod.reduce((s, e) => s + (Number(e.carbs)||0), 0) / n)

  const barData = buckets.map(b => {
    const bE    = inPeriod.filter(e => inRange(e.date, b.from, b.to))
    const bDays = [...new Set(bE.map(e => e.date))].length || 1
    return { label: b.label, value: Math.round(bE.reduce((s,e) => s+e.calories, 0) / bDays), future: b.future }
  })

  const mi = MODULE_ICONS['nutrition']
  return (
    <AnalyticsCard modId="nutrition" title="Питание">
      <StatRow stats={[
        { label: 'Ср. ккал/день', value: avgCal, color: mi?.color,
          sub: goal > 0 ? `цель ${goal}` : undefined },
        { label: 'Б / Ж / У', value: `${avgProt}/${avgFat}/${avgCarbs}г` },
      ]} />
      <MiniBarChart data={barData} color={mi?.color} />
      {goal > 0 && <ProgressBar pct={Math.round(avgCal/goal*100)} color={mi?.color} label="Ср. % цели калорий" />}
    </AnalyticsCard>
  )
}

// ─── SLEEP widget ─────────────────────────────────────────────────────────────

function SleepWidget({ sleep, buckets, range }) {
  const inPeriod = sleep.filter(e => inRange(e.date, range.from, range.to))

  if (!inPeriod.length) return (
    <AnalyticsCard modId="sleep" title="Сон"><EmptyState text="Нет данных за период" /></AnalyticsCard>
  )

  const avgMin = Math.round(inPeriod.reduce((s, e) => s + (e.durationMinutes||0), 0) / inPeriod.length)
  const withQ  = inPeriod.filter(e => e.quality != null)
  const avgQ   = withQ.length ? (withQ.reduce((s,e) => s+e.quality, 0) / withQ.length).toFixed(1) : null

  const barData = buckets.map(b => {
    const bE = inPeriod.filter(e => inRange(e.date, b.from, b.to))
    return { label: b.label, value: bE.length ? Math.round(bE.reduce((s,e) => s+(e.durationMinutes||0),0) / bE.length) : 0, future: b.future }
  })

  const mi = MODULE_ICONS['sleep']
  return (
    <AnalyticsCard modId="sleep" title="Сон">
      <StatRow stats={[
        { label: 'Ср. длит.',  value: fmtDuration(avgMin), color: mi?.color },
        ...(avgQ ? [{ label: 'Ср. качество', value: `${avgQ}/5` }] : []),
        { label: 'Ночей',      value: inPeriod.length },
      ]} />
      <MiniBarChart data={barData} color={mi?.color} />
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
  const types    = [...new Map(inPeriod.filter(w => w.typeName).map(w => [w.typeName, w])).values()].slice(0, 4)

  const barData = buckets.map(b => ({
    label: b.label,
    value: workouts.filter(w => inRange((w.date||'').slice(0,10), b.from, b.to)).length,
    future: b.future,
  }))

  function fmtM(m) {
    const h = Math.floor(m/60); const min = m%60
    return h > 0 ? (min > 0 ? `${h}ч ${min}м` : `${h}ч`) : `${m}м`
  }

  const mi = MODULE_ICONS['fitness']
  return (
    <AnalyticsCard modId="fitness" title="Тренировки">
      <StatRow stats={[
        { label: 'Тренировок',  value: inPeriod.length, color: mi?.color },
        { label: 'Общее время', value: fmtM(totalMin) },
      ]} />
      <MiniBarChart data={barData} color={mi?.color} />
      {types.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {types.map(w => (
            <span key={w.typeName}
              className="flex items-center gap-1 px-2 py-0.5 bg-surface rounded-full text-[10px] text-text-5 border border-border-2">
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

  const catMap = {}
  inPeriod.filter(t => t.type==='expense').forEach(t => {
    const k = t.categoryId || 'other'
    catMap[k] = (catMap[k] || 0) + t.amount
  })
  const topCats = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0, 4)

  const netBarData = buckets.map(b => {
    const bTxns = transactions.filter(t => inRange(t.date, b.from, b.to))
    const bInc  = bTxns.filter(t=>t.type==='income').reduce((s,t) => s+t.amount,0)
    const bExp  = bTxns.filter(t=>t.type==='expense').reduce((s,t) => s+t.amount,0)
    return { label: b.label, value: Math.max(0, bInc - bExp), future: b.future }
  })

  return (
    <AnalyticsCard modId="finance" title="Финансы">
      <StatRow stats={[
        { label: 'Доходы',  value: `${fmtMoney(income)} ₽`,  color: '#22c55e' },
        { label: 'Расходы', value: `${fmtMoney(expense)} ₽`, color: '#ef4444' },
        { label: 'Нетто',   value: `${net >= 0 ? '+' : '−'}${fmtMoney(Math.abs(net))} ₽`,
          color: net >= 0 ? '#22c55e' : '#ef4444' },
      ]} />
      <MiniBarChart data={netBarData} color={MODULE_ICONS['finance']?.color} />
      {topCats.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] text-text-8 uppercase tracking-wider">Топ расходы</p>
          {topCats.map(([catId, total]) => {
            const cat = categories.find(c => c.id === catId)
            return (
              <div key={catId} className="flex items-center justify-between">
                <span className="text-[11px] text-text-4">{cat ? `${cat.emoji} ${cat.name}` : 'Прочее'}</span>
                <span className="text-[11px] text-text-6">{fmtMoney(total)} ₽</span>
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
      <div className="flex flex-col gap-2.5">
        {active.map(goal => {
          const pct = computeProgress(goal, milestones)
          return (
            <div key={goal.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-text-4 truncate">{goal.icon} {goal.title}</span>
                <span className="text-[10px] text-text-6 shrink-0">{pct}%</span>
              </div>
              <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: goal.color || '#8b5cf6' }} />
              </div>
            </div>
          )
        })}
      </div>
    </AnalyticsCard>
  )
}

// ─── ANALYTICS SCREEN ─────────────────────────────────────────────────────────

const ANALYTICS_MODULES = new Set(['tasks', 'habits', 'focus', 'nutrition', 'sleep', 'fitness', 'finance', 'goals'])

const PERIOD_TABS = [
  { key: 'week',  label: 'Неделя'    },
  { key: 'month', label: 'Месяц'     },
  { key: 'all',   label: 'Всё время' },
]

export default function AnalyticsScreen() {
  const { activeModules, userId } = useOS()

  const [period,    setPeriod]    = useState('month')
  const [allData,   setAllData]   = useState(null)
  const [loadErr,   setLoadErr]   = useState({})
  const [loading,   setLoading]   = useState(true)
  const [daysInSys, setDaysInSys] = useState(null)

  // ── load all data once ────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.created_at) {
        const c       = new Date(user.created_at)
        const created = new Date(c.getFullYear(), c.getMonth(), c.getDate())
        const t       = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate())
        setDaysInSys(Math.max(1, Math.floor((today - created) / 86400000) + 1))
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

  const range   = useMemo(() => getPeriodRange(period),           [period])
  const buckets = useMemo(() => buildBuckets(period, range.from), [period, range.from])

  // modules that have analytics widgets, filtered by user's active modules
  const visibleModules = activeModules.filter(id => ANALYTICS_MODULES.has(id))

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Аналитика</h1>
        <p className="text-text-7 text-sm mt-0.5">Прогресс по активным модулям</p>
      </div>

      {visibleModules.length === 0 ? (
        <div className="bg-card border border-border-2 rounded-xl p-10 text-center">
          <p className="text-text-6 text-sm">Добавьте модули для отображения аналитики</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* Top summary + period selector row */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

            {/* Summary chips */}
            <div className="flex gap-2 flex-shrink-0">
              <div className="bg-card border border-border-2 rounded-xl px-4 py-2.5 flex flex-col gap-0.5 min-w-[90px]">
                <p className="text-[10px] uppercase tracking-wider text-text-7">Модулей</p>
                <p className="text-xl font-bold text-text">{activeModules.length}</p>
              </div>
              <div className="bg-card border border-border-2 rounded-xl px-4 py-2.5 flex flex-col gap-0.5 min-w-[90px]">
                <p className="text-[10px] uppercase tracking-wider text-text-7">Дней в системе</p>
                {daysInSys === null
                  ? <div className="h-7 w-10 bg-surface-2 rounded animate-pulse mt-0.5" />
                  : <p className="text-xl font-bold text-text">{daysInSys}</p>
                }
              </div>
            </div>

            {/* Period selector */}
            <div className="flex gap-1 bg-surface rounded-xl p-1 sm:ml-auto">
              {PERIOD_TABS.map(t => (
                <button key={t.key} onClick={() => setPeriod(t.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    period === t.key
                      ? 'bg-card border border-border-2 text-text shadow-sm'
                      : 'text-text-6 hover:text-text'
                  }`}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Widget grid — same adaptive grid as HomeScreen */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ gridAutoFlow: 'dense' }}>
              {visibleModules.map(id => <CardSkeleton key={id} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ gridAutoFlow: 'dense' }}>
              {visibleModules.map(modId => {
                const d = allData

                const renderWidget = () => {
                  switch (modId) {
                    case 'tasks':
                      if (loadErr.tasks || !d?.tasks)
                        return <AnalyticsCard modId="tasks" title="Задачи"><CardError /></AnalyticsCard>
                      return <TasksWidget tasks={d.tasks} buckets={buckets} range={range} />
                    case 'habits':
                      if (loadErr.habits || !d?.habits)
                        return <AnalyticsCard modId="habits" title="Привычки"><CardError /></AnalyticsCard>
                      return <HabitsWidget habits={d.habits} completions={d.completions||{}} range={range} />
                    case 'focus':
                      if (loadErr.focus || !d?.focus)
                        return <AnalyticsCard modId="focus" title="Фокус"><CardError /></AnalyticsCard>
                      return <FocusWidget sessions={d.focus} profile={d.profile} buckets={buckets} range={range} />
                    case 'nutrition':
                      if (loadErr.food || !d?.food)
                        return <AnalyticsCard modId="nutrition" title="Питание"><CardError /></AnalyticsCard>
                      return <NutritionWidget food={d.food} profile={d.profile} buckets={buckets} range={range} />
                    case 'sleep':
                      if (loadErr.sleep || !d?.sleep)
                        return <AnalyticsCard modId="sleep" title="Сон"><CardError /></AnalyticsCard>
                      return <SleepWidget sleep={d.sleep} buckets={buckets} range={range} />
                    case 'fitness':
                      if (loadErr.workouts || !d?.workouts)
                        return <AnalyticsCard modId="fitness" title="Тренировки"><CardError /></AnalyticsCard>
                      return <FitnessWidget workouts={d.workouts} buckets={buckets} range={range} />
                    case 'finance':
                      if (loadErr.transactions || !d?.transactions)
                        return <AnalyticsCard modId="finance" title="Финансы"><CardError /></AnalyticsCard>
                      return <FinanceWidget transactions={d.transactions} categories={d.categories||[]} buckets={buckets} range={range} />
                    case 'goals':
                      if (loadErr.goals || !d?.goals)
                        return <AnalyticsCard modId="goals" title="Цели"><CardError /></AnalyticsCard>
                      return <GoalsWidget goals={d.goals} milestones={d.milestones||[]} />
                    default:
                      return null
                  }
                }

                const widget = renderWidget()
                if (!widget) return null
                return <div key={modId}>{widget}</div>
              })}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
