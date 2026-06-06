'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertCircle, BarChart2 } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  ComposedChart, XAxis, Tooltip,
} from 'recharts'
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
    // 7 daily buckets — label = weekday name
    const fromD = new Date(from + 'T00:00:00')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(fromD); d.setDate(fromD.getDate() + i)
      const s = localStr(d)
      return { label: WDAYS[i], from: s, to: s, future: s > today }
    })
  }
  if (period === 'month') {
    // daily buckets for the full calendar month — label = day number
    const fromD  = new Date(from + 'T00:00:00')
    const result = []
    const cur    = new Date(fromD)
    while (localStr(cur) <= today) {
      const s = localStr(cur)
      result.push({ label: String(cur.getDate()), from: s, to: s, future: false })
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }
  // all-time: last 12 calendar months
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

function fmtM(m) {
  const h = Math.floor(m / 60); const min = m % 60
  return h > 0 ? (min > 0 ? `${h}ч ${min}м` : `${h}ч`) : `${m}м`
}

// ─── shared chart primitives ──────────────────────────────────────────────────

// Card with fixed height: header pinned top, chart fills remaining space
// CARD_H is the single source of truth for all analytics card heights
const CARD_H = 'h-[256px]'

function AnalyticsCard({ modId, title, stats = [], children }) {
  const mi = MODULE_ICONS[modId]
  return (
    <div className={`bg-card border border-border-2 rounded-xl flex flex-col p-4 gap-2 ${CARD_H}`}>
      {/* header: icon + title + inline key stats */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {mi && (
            <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
              style={{ background: mi.color + '20' }}>
              <mi.Icon className="w-3 h-3" style={{ color: mi.color }} />
            </div>
          )}
          <span className="text-[11px] font-semibold text-text-4 uppercase tracking-wider">{title}</span>
        </div>
        {stats.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            {stats.map(s => (
              <div key={s.label} className="flex flex-col items-end gap-0.5">
                <span className="text-sm font-bold leading-none" style={{ color: s.color || 'rgb(var(--text-rgb))' }}>
                  {s.value}
                </span>
                <span className="text-[9px] text-text-7 leading-none">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* chart area: fills remaining height */}
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  )
}

// Custom tooltip — dark/light theme via CSS vars
function ChartTip({ active, payload, label, fmt = v => v, names = [] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-panel border border-border-2 rounded-lg px-2.5 py-1.5 shadow-lg text-xs">
      {label && <p className="text-text-7 text-[10px] mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold leading-snug" style={{ color: p.color || p.fill }}>
          {names[i] ? `${names[i]}: ` : ''}{fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

// Shared XAxis style — interval thins labels for month (30 pts) automatically
function xAxisProps(n = 0) {
  return {
    tick: { fontSize: 9, fill: 'var(--color-text-8)', fontFamily: 'inherit' },
    tickLine: false,
    axisLine: false,
    // show ~6 labels regardless of bucket count; for ≤10 show all
    interval: n > 10 ? Math.floor(n / 6) : 0,
  }
}

// ChartEmpty — fills fixed card chart area (h-full), same minimal style as EmptyState compact
function ChartEmpty({ text, color }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: (color || '#6c63ff') + '20' }}>
        <BarChart2 className="w-4 h-4" style={{ color: color || '#6c63ff' }} />
      </div>
      <p className="text-[11px] text-text-7 text-center">{text || 'Нет данных за период'}</p>
    </div>
  )
}

function CardError() {
  return (
    <div className="h-full flex items-center justify-center gap-2 text-[11px] text-text-6">
      <AlertCircle className="w-3.5 h-3.5 text-[#ef4444]/60 shrink-0" />
      Не удалось загрузить
    </div>
  )
}

// Skeleton replicates card exact height
function CardSkeleton() {
  return (
    <div className={`bg-card border border-border-2 rounded-xl p-4 flex flex-col gap-3 ${CARD_H}`}>
      <div className="flex items-center justify-between shrink-0">
        <div className="h-4 w-24 bg-surface-2 rounded animate-pulse" />
        <div className="h-4 w-12 bg-surface-2 rounded animate-pulse" />
      </div>
      <div className="flex-1 min-h-0 bg-surface-2 rounded-lg animate-pulse" />
    </div>
  )
}

// ─── widget: TASKS ────────────────────────────────────────────────────────────

function TasksWidget({ tasks, buckets, range }) {
  const mi = MODULE_ICONS['tasks']

  const inPeriod = tasks.filter(t => {
    const d = t.status === 'done'
      ? (t.completed_at ? t.completed_at.slice(0,10) : t.due_date)
      : t.due_date
    return inRange(d, range.from, range.to)
  })
  const done        = inPeriod.filter(t => t.status === 'done').length
  const total       = inPeriod.length
  const completePct = total > 0 ? Math.round(done / total * 100) : 0

  const chartData = buckets.map(b => ({
    label: b.label,
    value: tasks.filter(t => {
      const d = t.completed_at ? t.completed_at.slice(0,10) : t.due_date
      return t.status === 'done' && inRange(d, b.from, b.to)
    }).length,
    future: b.future,
  }))

  const hasData = chartData.some(d => d.value > 0)

  return (
    <AnalyticsCard modId="tasks" title="Задачи" stats={[
      { label: 'выполнено', value: done, color: mi?.color },
      { label: '% из всех', value: `${completePct}%`,
        color: completePct >= 70 ? '#22c55e' : completePct > 0 ? '#f59e0b' : undefined },
    ]}>
      {!hasData
        ? <ChartEmpty text="Задач за период нет" color={mi?.color} />
        : <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="label" {...xAxisProps(chartData.length)} />
              <Tooltip content={<ChartTip fmt={v => `${v} задач`} />} cursor={{ fill: mi?.color + '15' }} />
              <Bar dataKey="value" radius={[3,3,0,0]}
                fill={mi?.color}
                fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
      }
    </AnalyticsCard>
  )
}

// ─── widget: HABITS ───────────────────────────────────────────────────────────

function HabitsWidget({ habits, completions, buckets, range }) {
  const mi = MODULE_ICONS['habits']

  if (!habits.length) return (
    <AnalyticsCard modId="habits" title="Привычки">
      <ChartEmpty text="Нет привычек" color={mi?.color} />
    </AnalyticsCard>
  )

  // avg completion % per bucket across all habits
  const chartData = buckets.map(b => {
    const bucketDays = Math.max(1,
      Math.round((new Date(b.to+'T00:00:00') - new Date(b.from+'T00:00:00')) / 86400000) + 1
    )
    const possible = habits.length * bucketDays
    const done     = habits.reduce((sum, h) => {
      return sum + (completions[h.id] || []).filter(d => inRange(d, b.from, b.to)).length
    }, 0)
    return { label: b.label, value: possible > 0 ? Math.round(done / possible * 100) : 0, future: b.future }
  })

  // overall avg for header
  const allDays = Math.max(1,
    Math.round((new Date(range.to+'T00:00:00') - new Date(range.from+'T00:00:00')) / 86400000) + 1
  )
  const totalDone = habits.reduce((sum, h) =>
    sum + (completions[h.id] || []).filter(d => inRange(d, range.from, range.to)).length, 0
  )
  const avgPct = Math.round(totalDone / (habits.length * allDays) * 100)

  const hasData = chartData.some(d => d.value > 0)

  return (
    <AnalyticsCard modId="habits" title="Привычки" stats={[
      { label: 'ср. выполнение', value: `${avgPct}%`, color: mi?.color },
      { label: 'привычек', value: habits.length },
    ]}>
      {!hasData
        ? <ChartEmpty text="Нет отметок за период" color={mi?.color} />
        : <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="habitsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={mi?.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={mi?.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" {...xAxisProps(chartData.length)} />
              <Tooltip content={<ChartTip fmt={v => `${v}%`} />} cursor={{ stroke: mi?.color + '40', strokeWidth: 1 }} />
              <Area
                type="monotone" dataKey="value"
                stroke={mi?.color} strokeWidth={1.5}
                fill="url(#habitsGrad)"
                dot={chartData.length <= 2 ? { r: 3, fill: mi?.color } : false}
                activeDot={{ r: 3, fill: mi?.color }}
              />
            </AreaChart>
          </ResponsiveContainer>
      }
    </AnalyticsCard>
  )
}

// ─── widget: FOCUS ────────────────────────────────────────────────────────────

function FocusWidget({ sessions, profile, buckets, range }) {
  const mi = MODULE_ICONS['focus']

  const inPeriod = sessions.filter(s => s.type === 'focus' && s.completed && inRange(s.date, range.from, range.to))
  const totalMin = inPeriod.reduce((s, x) => s + (x.duration_minutes || 0), 0)
  const goalMin  = profile?.focus_goal_minutes || 0

  const chartData = buckets.map(b => ({
    label: b.label,
    value: sessions
      .filter(s => s.type === 'focus' && s.completed && inRange(s.date, b.from, b.to))
      .reduce((s, x) => s + (x.duration_minutes || 0), 0),
    future: b.future,
  }))

  const hasData = chartData.some(d => d.value > 0)

  return (
    <AnalyticsCard modId="focus" title="Фокус" stats={[
      { label: 'суммарно', value: fmtM(totalMin), color: mi?.color },
      ...(goalMin > 0 ? [{ label: '% цели', value: `${Math.round(totalMin / goalMin * 100)}%` }] : []),
    ]}>
      {!hasData
        ? <ChartEmpty text="Нет сессий за период" color={mi?.color} />
        : <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={mi?.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={mi?.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" {...xAxisProps(chartData.length)} />
              <Tooltip content={<ChartTip fmt={fmtM} />} cursor={{ stroke: mi?.color + '40', strokeWidth: 1 }} />
              <Area
                type="monotone" dataKey="value"
                stroke={mi?.color} strokeWidth={1.5}
                fill="url(#focusGrad)"
                dot={chartData.length <= 2 ? { r: 3, fill: mi?.color } : false}
                activeDot={{ r: 3, fill: mi?.color }}
              />
            </AreaChart>
          </ResponsiveContainer>
      }
    </AnalyticsCard>
  )
}

// ─── widget: NUTRITION ────────────────────────────────────────────────────────

function NutritionWidget({ food, profile, buckets, range }) {
  const mi   = MODULE_ICONS['nutrition']
  const goal = profile?.calorie_goal || 0

  const inPeriod = food.filter(e => inRange(e.date, range.from, range.to))
  const days     = [...new Set(inPeriod.map(e => e.date))]
  const avgCal   = days.length
    ? Math.round(inPeriod.reduce((s, e) => s + e.calories, 0) / days.length)
    : 0

  const chartData = buckets.map(b => {
    const bE    = inPeriod.filter(e => inRange(e.date, b.from, b.to))
    const bDays = [...new Set(bE.map(e => e.date))].length || 1
    return {
      label: b.label,
      value: bE.length ? Math.round(bE.reduce((s, e) => s + e.calories, 0) / bDays) : 0,
      future: b.future,
    }
  })

  const hasData = chartData.some(d => d.value > 0)

  return (
    <AnalyticsCard modId="nutrition" title="Питание" stats={[
      { label: 'ср. ккал/день', value: avgCal || '—', color: mi?.color },
      ...(goal > 0 ? [{ label: 'цель', value: goal }] : []),
    ]}>
      {!hasData
        ? <ChartEmpty text="Нет данных за период" color={mi?.color} />
        : <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="nutritionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={mi?.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={mi?.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" {...xAxisProps(chartData.length)} />
              <Tooltip content={<ChartTip fmt={v => `${v} ккал`} />} cursor={{ stroke: mi?.color + '40', strokeWidth: 1 }} />
              <Area
                type="monotone" dataKey="value"
                stroke={mi?.color} strokeWidth={1.5}
                fill="url(#nutritionGrad)"
                dot={chartData.length <= 2 ? { r: 3, fill: mi?.color } : false}
                activeDot={{ r: 3, fill: mi?.color }}
              />
            </AreaChart>
          </ResponsiveContainer>
      }
    </AnalyticsCard>
  )
}

// ─── widget: SLEEP ────────────────────────────────────────────────────────────

function SleepWidget({ sleep, buckets, range }) {
  const mi = MODULE_ICONS['sleep']

  const inPeriod = sleep.filter(e => inRange(e.date, range.from, range.to))
  const avgMin   = inPeriod.length
    ? Math.round(inPeriod.reduce((s, e) => s + (e.durationMinutes || 0), 0) / inPeriod.length)
    : 0
  const withQ    = inPeriod.filter(e => e.quality != null)
  const avgQ     = withQ.length ? (withQ.reduce((s,e) => s + e.quality, 0) / withQ.length).toFixed(1) : null

  const chartData = buckets.map(b => {
    const bE = inPeriod.filter(e => inRange(e.date, b.from, b.to))
    return {
      label: b.label,
      value: bE.length
        ? Math.round(bE.reduce((s, e) => s + (e.durationMinutes || 0), 0) / bE.length)
        : 0,
      future: b.future,
    }
  })

  const hasData = chartData.some(d => d.value > 0)

  return (
    <AnalyticsCard modId="sleep" title="Сон" stats={[
      { label: 'ср. длит.', value: avgMin ? fmtDuration(avgMin) : '—', color: mi?.color },
      ...(avgQ ? [{ label: 'качество', value: `${avgQ}/5` }] : []),
    ]}>
      {!hasData
        ? <ChartEmpty text="Нет данных за период" color={mi?.color} />
        : <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={mi?.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={mi?.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" {...xAxisProps(chartData.length)} />
              <Tooltip content={<ChartTip fmt={v => fmtDuration(v)} />} cursor={{ stroke: mi?.color + '40', strokeWidth: 1 }} />
              <Area
                type="monotone" dataKey="value"
                stroke={mi?.color} strokeWidth={1.5}
                fill="url(#sleepGrad)"
                dot={chartData.length <= 2 ? { r: 3, fill: mi?.color } : false}
                activeDot={{ r: 3, fill: mi?.color }}
              />
            </AreaChart>
          </ResponsiveContainer>
      }
    </AnalyticsCard>
  )
}

// ─── widget: FITNESS ──────────────────────────────────────────────────────────

function FitnessWidget({ workouts, buckets, range }) {
  const mi = MODULE_ICONS['fitness']

  const inPeriod = workouts.filter(w => inRange((w.date || '').slice(0,10), range.from, range.to))
  const totalMin = inPeriod.reduce((s, w) => s + (w.duration || 0), 0)

  const chartData = buckets.map(b => ({
    label: b.label,
    value: workouts.filter(w => inRange((w.date || '').slice(0,10), b.from, b.to)).length,
    future: b.future,
  }))

  const hasData = chartData.some(d => d.value > 0)

  return (
    <AnalyticsCard modId="fitness" title="Тренировки" stats={[
      { label: 'тренировок', value: inPeriod.length, color: mi?.color },
      { label: 'суммарно',   value: fmtM(totalMin) },
    ]}>
      {!hasData
        ? <ChartEmpty text="Нет тренировок за период" color={mi?.color} />
        : <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="label" {...xAxisProps(chartData.length)} />
              <Tooltip content={<ChartTip fmt={v => `${v} тр.`} />} cursor={{ fill: mi?.color + '15' }} />
              <Bar dataKey="value" radius={[3,3,0,0]} fill={mi?.color} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
      }
    </AnalyticsCard>
  )
}

// ─── widget: FINANCE ──────────────────────────────────────────────────────────

function FinanceWidget({ transactions, buckets, range }) {
  const mi = MODULE_ICONS['finance']

  const inPeriod = transactions.filter(t => inRange(t.date, range.from, range.to))
  const income   = inPeriod.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense  = inPeriod.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net      = income - expense

  const chartData = buckets.map(b => {
    const bT = transactions.filter(t => inRange(t.date, b.from, b.to))
    return {
      label:   b.label,
      income:  Math.round(bT.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
      expense: Math.round(bT.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)),
      future:  b.future,
    }
  })

  const hasData = chartData.some(d => d.income > 0 || d.expense > 0)

  return (
    <AnalyticsCard modId="finance" title="Финансы" stats={[
      { label: 'нетто', value: `${net >= 0 ? '+' : '−'}${fmtMoney(Math.abs(net))} ₽`,
        color: net >= 0 ? '#22c55e' : '#ef4444' },
    ]}>
      {!hasData
        ? <ChartEmpty text="Нет транзакций за период" color={MODULE_ICONS['finance']?.color} />
        : <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" {...xAxisProps(chartData.length)} />
              <Tooltip
                content={<ChartTip fmt={v => `${fmtMoney(v)} ₽`} names={['Доходы', 'Расходы']} />}
                cursor={{ stroke: '#ffffff20', strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="income"  stroke="#22c55e" strokeWidth={1.5}
                fill="url(#incomeGrad)"
                dot={chartData.length <= 2 ? { r: 3, fill: '#22c55e' } : false}
                activeDot={{ r: 3, fill: '#22c55e' }} />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={1.5}
                fill="url(#expenseGrad)"
                dot={chartData.length <= 2 ? { r: 3, fill: '#ef4444' } : false}
                activeDot={{ r: 3, fill: '#ef4444' }} />
            </ComposedChart>
          </ResponsiveContainer>
      }
    </AnalyticsCard>
  )
}

// ─── widget: GOALS ────────────────────────────────────────────────────────────

function GoalsWidget({ goals, milestones }) {
  const mi     = MODULE_ICONS['goals']
  const active = goals.filter(g => g.status === 'active').slice(0, 8)

  if (!active.length) return (
    <AnalyticsCard modId="goals" title="Цели">
      <ChartEmpty text="Нет активных целей" color={MODULE_ICONS['goals']?.color} />
    </AnalyticsCard>
  )

  // BarChart: each bar = one goal, value = progress %
  const chartData = active.map(goal => ({
    label: (goal.icon || '').slice(0, 2),   // emoji as X label
    value: computeProgress(goal, milestones),
    color: goal.color || mi?.color,
    name:  goal.title,
  }))

  const avgPct = Math.round(chartData.reduce((s, d) => s + d.value, 0) / chartData.length)

  return (
    <AnalyticsCard modId="goals" title="Цели" stats={[
      { label: 'ср. прогресс', value: `${avgPct}%`, color: mi?.color },
      { label: 'активных', value: active.length },
    ]}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barCategoryGap="25%">
          <XAxis dataKey="label" {...xAxisProps(chartData.length)} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              return (
                <div className="bg-panel border border-border-2 rounded-lg px-2.5 py-1.5 shadow-lg text-xs">
                  <p className="text-text-5 mb-0.5 max-w-[140px] truncate">{d?.name}</p>
                  <p className="font-semibold" style={{ color: d?.color }}>{d?.value}%</p>
                </div>
              )
            }}
            cursor={{ fill: mi?.color + '15' }}
          />
          <Bar dataKey="value" radius={[3,3,0,0]} maxBarSize={32}
            fill={mi?.color} fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
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

  useEffect(() => {
    if (!userId) return

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.created_at) {
        const c       = new Date(user.created_at)
        const created = new Date(c.getFullYear(), c.getMonth(), c.getDate())
        const t       = new Date()
        const today   = new Date(t.getFullYear(), t.getMonth(), t.getDate())
        setDaysInSys(Math.max(1, Math.floor((today - created) / 86400000) + 1))
      }
    }).catch(() => {})

    const errors = {}
    const safe = (key, fn) => fn().catch(e => { errors[key] = true; console.error(`Analytics ${key}:`, e.message); return null })

    ;(async () => {
      const [tasks, habits, focus, food, sleep, workouts, transactions, categories, goals, milestones, profile] =
        await Promise.all([
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

  const visibleModules = activeModules.filter(id => ANALYTICS_MODULES.has(id))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">

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

          {/* Summary + period selector */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex gap-2 shrink-0">
              <div className="bg-card border border-border-2 rounded-xl px-4 py-2.5 min-w-[90px]">
                <p className="text-[10px] uppercase tracking-wider text-text-7">Модулей</p>
                <p className="text-xl font-bold text-text leading-snug">{activeModules.length}</p>
              </div>
              <div className="bg-card border border-border-2 rounded-xl px-4 py-2.5 min-w-[100px]">
                <p className="text-[10px] uppercase tracking-wider text-text-7">Дней в системе</p>
                {daysInSys === null
                  ? <div className="h-6 w-10 bg-surface-2 rounded animate-pulse mt-0.5" />
                  : <p className="text-xl font-bold text-text leading-snug">{daysInSys}</p>
                }
              </div>
            </div>

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

          {/* Widget grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ gridAutoFlow: 'dense' }}>
              {visibleModules.map(id => <CardSkeleton key={id} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ gridAutoFlow: 'dense' }}>
              {visibleModules.map(modId => {
                const d = allData

                let widget = null
                switch (modId) {
                  case 'tasks':
                    widget = loadErr.tasks || !d?.tasks
                      ? <AnalyticsCard modId="tasks" title="Задачи"><CardError /></AnalyticsCard>
                      : <TasksWidget tasks={d.tasks} buckets={buckets} range={range} />
                    break
                  case 'habits':
                    widget = loadErr.habits || !d?.habits
                      ? <AnalyticsCard modId="habits" title="Привычки"><CardError /></AnalyticsCard>
                      : <HabitsWidget habits={d.habits} completions={d.completions||{}} buckets={buckets} range={range} />
                    break
                  case 'focus':
                    widget = loadErr.focus || !d?.focus
                      ? <AnalyticsCard modId="focus" title="Фокус"><CardError /></AnalyticsCard>
                      : <FocusWidget sessions={d.focus} profile={d.profile} buckets={buckets} range={range} />
                    break
                  case 'nutrition':
                    widget = loadErr.food || !d?.food
                      ? <AnalyticsCard modId="nutrition" title="Питание"><CardError /></AnalyticsCard>
                      : <NutritionWidget food={d.food} profile={d.profile} buckets={buckets} range={range} />
                    break
                  case 'sleep':
                    widget = loadErr.sleep || !d?.sleep
                      ? <AnalyticsCard modId="sleep" title="Сон"><CardError /></AnalyticsCard>
                      : <SleepWidget sleep={d.sleep} buckets={buckets} range={range} />
                    break
                  case 'fitness':
                    widget = loadErr.workouts || !d?.workouts
                      ? <AnalyticsCard modId="fitness" title="Тренировки"><CardError /></AnalyticsCard>
                      : <FitnessWidget workouts={d.workouts} buckets={buckets} range={range} />
                    break
                  case 'finance':
                    widget = loadErr.transactions || !d?.transactions
                      ? <AnalyticsCard modId="finance" title="Финансы"><CardError /></AnalyticsCard>
                      : <FinanceWidget transactions={d.transactions} buckets={buckets} range={range} />
                    break
                  case 'goals':
                    widget = loadErr.goals || !d?.goals
                      ? <AnalyticsCard modId="goals" title="Цели"><CardError /></AnalyticsCard>
                      : <GoalsWidget goals={d.goals} milestones={d.milestones||[]} />
                    break
                  default:
                    break
                }

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
