'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import EmptyState from '../EmptyState'
import { Check, X, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { useOS } from '../../../lib/store'
import { MODULE_ICONS } from '../../../lib/moduleIcons'
import { habitsRepo } from '../../../lib/db/habits'
import { habitCompletionsRepo } from '../../../lib/db/habitCompletions'
import { getTodayStr } from '../../../lib/tasks-selectors'
import { computeStreaks, isScheduledToday } from '../../../lib/habits-selectors'
import HabitHeatmap from './HabitHeatmap'
import HabitMonthCalendar from './HabitMonthCalendar'
import HabitsCalendar from './HabitsCalendar'

// ─── constants ────────────────────────────────────────────────────────────────

const HABIT_COLORS = [
  '#6c63ff', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#8b5cf6', '#ec4899', '#64748b',
]

const HABIT_EMOJIS = [
  '💧','🏃','📚','🧘','💪','🥗','😴','✍️',
  '🎯','🌱','🧠','❤️','🎨','🎵','🚶','🏋️',
  '☀️','🌙','⭐','🔥','🧹','🛁','🍎','🥤',
]

const DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] // iso 1-7 → idx 0-6

// ─── toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 shadow-lg animate-slide-up">
      <AlertCircle className="w-4 h-4 text-danger shrink-0" />
      <span className="text-sm text-text">{msg}</span>
      <button onClick={onClose} className="text-subtle hover:text-text ml-1 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6 animate-pulse">
        <div className="w-10 h-10 rounded-xl bg-muted" />
        <div>
          <div className="w-24 h-5 bg-muted rounded mb-1" />
          <div className="w-32 h-3 bg-muted rounded" />
        </div>
      </div>
      <div className="flex gap-6 items-start flex-col lg:flex-row">
        <div className="flex-1 min-w-0 w-full">
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {[0, 1, 2].map(i => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 animate-pulse ${i > 0 ? 'border-t border-border' : ''}`}>
                <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
                <div className="flex-1 h-3.5 bg-muted rounded" style={{ width: `${45 + i * 15}%` }} />
                <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
              </div>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-72 lg:shrink-0 bg-surface border border-border rounded-xl p-4 animate-pulse">
          <div className="w-20 h-3 bg-muted rounded mb-4" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-muted/60" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── empty state ──────────────────────────────────────────────────────────────

// EmptyState replaced by shared app/components/EmptyState.jsx

// ─── emoji picker ─────────────────────────────────────────────────────────────
// Fixed-position popover — не участвует в flow, не сдвигает соседей,
// не клипается в overflow-hidden контейнерах.

function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, left: 0 })
  const triggerRef      = useRef(null)
  const popoverRef      = useRef(null)

  // Close on outside click (trigger + popover — оба не считаются «снаружи»)
  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (triggerRef.current?.contains(e.target)) return
      if (popoverRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handle(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open])

  const handleToggle = () => {
    if (open) { setOpen(false); return }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    // Estimated popover size: 8 cols × 28px + gaps + padding ≈ 252px wide, 112px tall
    const POP_W = 252
    const POP_H = 116
    const GAP   = 4
    let top  = rect.bottom + GAP
    let left = rect.left
    if (left + POP_W > window.innerWidth  - 8) left = window.innerWidth  - POP_W - 8
    if (top  + POP_H > window.innerHeight - 8) top  = rect.top - POP_H - GAP
    setPos({ top, left })
    setOpen(true)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-lg hover:border-accent/60 transition-colors shrink-0"
      >
        {value}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="fixed z-[60] bg-surface border border-border rounded-xl p-2 shadow-2xl animate-fade-in"
          style={{ top: pos.top, left: pos.left, maxWidth: 260, maxHeight: 160, overflowY: 'auto' }}
        >
          <div className="grid grid-cols-8 gap-0.5">
            {HABIT_EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => { onChange(e); setOpen(false) }}
                className={`w-7 h-7 flex items-center justify-center rounded text-base hover:bg-muted/60 transition-colors ${value === e ? 'bg-accent/20' : ''}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ─── color picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {HABIT_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full border-2 transition-all ${value === c ? 'border-text scale-110' : 'border-transparent hover:scale-105'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

// ─── schedule editor ──────────────────────────────────────────────────────────

function ScheduleEditor({ schedule, scheduleDays, onChange }) {
  const toggleDay = (iso) => {
    const cur = scheduleDays ?? []
    const next = cur.includes(iso) ? cur.filter(d => d !== iso) : [...cur, iso].sort()
    onChange({ schedule, schedule_days: next })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {[{ v: 'daily', l: 'Ежедневно' }, { v: 'custom', l: 'По дням' }].map(({ v, l }) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange({ schedule: v, schedule_days: scheduleDays })}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors border ${
              schedule === v
                ? 'bg-accent/20 text-accent border-accent/40'
                : 'text-subtle border-border hover:text-text'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {schedule === 'custom' && (
        <div className="flex gap-1">
          {DAYS_SHORT.map((d, i) => {
            const iso = i + 1
            const active = (scheduleDays ?? []).includes(iso)
            return (
              <button
                key={iso}
                type="button"
                onClick={() => toggleDay(iso)}
                className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                  active ? 'bg-accent/20 text-accent' : 'bg-muted/40 text-subtle hover:text-text'
                }`}
              >
                {d}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ habit, completionDates, onSave, onCancel, onDelete }) {
  const [fields, setFields] = useState({
    name:          habit.name,
    emoji:         habit.emoji,
    color:         habit.color,
    schedule:      habit.schedule,
    schedule_days: habit.schedule_days,
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [historyView,   setHistoryView]   = useState('weeks') // 'weeks' | 'month'

  const { current, best } = computeStreaks(completionDates, fields.schedule, fields.schedule_days)

  const handleSave = () => {
    if (!fields.name.trim()) return
    onSave(fields)
  }

  return (
    <div className="border-t border-border bg-bg px-4 py-4 flex flex-col gap-3 animate-slide-up">
      {/* Name */}
      <div className="flex items-center gap-2">
        <EmojiPicker value={fields.emoji} onChange={v => setFields(f => ({ ...f, emoji: v }))} />
        <input
          autoFocus
          type="text"
          value={fields.name}
          onChange={e => setFields(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }}
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent/60 transition-colors"
          placeholder="Название привычки"
        />
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-subtle uppercase tracking-wider">Цвет</span>
        <ColorPicker value={fields.color} onChange={v => setFields(f => ({ ...f, color: v }))} />
      </div>

      {/* Schedule */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-subtle uppercase tracking-wider">Расписание</span>
        <ScheduleEditor
          schedule={fields.schedule}
          scheduleDays={fields.schedule_days}
          onChange={({ schedule, schedule_days }) => setFields(f => ({ ...f, schedule, schedule_days }))}
        />
      </div>

      {/* Streaks */}
      <div className="flex gap-4 px-3 py-2 bg-surface border border-border rounded-lg">
        <div className="text-center">
          <div className="text-lg font-bold text-text">🔥 {current}</div>
          <div className="text-[10px] text-subtle mt-0.5">Текущий стрик</div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="text-lg font-bold text-text">⭐ {best}</div>
          <div className="text-[10px] text-subtle mt-0.5">Лучший стрик</div>
        </div>
      </div>

      {/* History: heatmap or month calendar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-subtle uppercase tracking-wider">История</span>
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            {[{ v: 'weeks', l: 'Недели' }, { v: 'month', l: 'Месяц' }].map(({ v, l }) => (
              <button
                key={v}
                type="button"
                onClick={() => setHistoryView(v)}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors border-r border-border last:border-r-0 ${
                  historyView === v ? 'bg-accent/20 text-accent' : 'text-subtle hover:text-text'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-3">
          {historyView === 'weeks' ? (
            <HabitHeatmap
              completionDates={completionDates}
              color={fields.color}
              schedule={fields.schedule}
              scheduleDays={fields.schedule_days}
            />
          ) : (
            <HabitMonthCalendar
              completionDates={completionDates}
              color={fields.color}
              schedule={fields.schedule}
              scheduleDays={fields.schedule_days}
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!fields.name.trim()}
            className="px-4 py-1.5 bg-accent hover:bg-accent-light disabled:bg-muted disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
          >
            Сохранить
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-1.5 text-subtle hover:text-text text-sm transition-colors">
            Отмена
          </button>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-subtle">Удалить?</span>
            <button type="button" onClick={onDelete} className="text-danger font-medium hover:text-danger/80 transition-colors">Да</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-subtle hover:text-text transition-colors">Нет</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-subtle hover:text-danger text-sm transition-colors">
            Удалить
          </button>
        )}
      </div>
    </div>
  )
}

// ─── habit card ────────────────────────────────────────────────────────────────

function HabitCard({
  habit, completionDates, isFirst, isExpanded, doneToday, scheduledToday,
  onToggleToday, onToggleExpand, onSave, onDelete, onMoveUp, onMoveDown,
  isFirst: isFirstHabit, isLast,
}) {
  const { current } = computeStreaks(completionDates, habit.schedule, habit.schedule_days)

  return (
    <div className={`${!isFirst ? 'border-t border-border' : ''}`}>
      {/* Main row */}
      <div className={`flex items-center gap-3 px-4 py-3 group ${!scheduledToday ? 'opacity-50' : ''}`}>
        {/* Emoji badge */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ backgroundColor: habit.color + '22', borderLeft: `3px solid ${habit.color}` }}
        >
          {habit.emoji}
        </div>

        {/* Name + streak */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-2 min-w-0 text-left"
        >
          <span className="text-sm text-text font-medium truncate">{habit.name}</span>
          {current > 0 && (
            <span className="text-xs text-warning shrink-0">🔥 {current}</span>
          )}
          {!scheduledToday && (
            <span className="text-[10px] text-subtle shrink-0 px-1.5 py-0.5 bg-muted/30 rounded">не сегодня</span>
          )}
        </button>

        {/* Reorder buttons (visible on hover) */}
        <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirstHabit}
            className="text-subtle hover:text-text disabled:opacity-20 transition-colors text-[10px] leading-none px-0.5"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="text-subtle hover:text-text disabled:opacity-20 transition-colors text-[10px] leading-none px-0.5"
          >
            ▼
          </button>
        </div>

        {/* Expand chevron */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-subtle hover:text-text transition-colors opacity-0 group-hover:opacity-100 shrink-0"
        >
          {isExpanded
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Toggle today */}
        <button
          type="button"
          onClick={onToggleToday}
          disabled={!scheduledToday}
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            doneToday
              ? 'border-success bg-success/20 text-success'
              : scheduledToday
                ? 'border-muted hover:border-accent'
                : 'border-muted/30 cursor-not-allowed'
          }`}
        >
          {doneToday && <Check className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Detail panel */}
      {isExpanded && (
        <DetailPanel
          habit={habit}
          completionDates={completionDates}
          onSave={(fields) => onSave(fields)}
          onCancel={onToggleExpand}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

// ─── quick add ────────────────────────────────────────────────────────────────

function QuickAdd({ onAdd }) {
  const [name,  setName]  = useState('')
  const [emoji, setEmoji] = useState('◎')
  const [color, setColor] = useState(HABIT_COLORS[0])
  const inputRef = useRef(null)

  const handleAdd = () => {
    if (!name.trim()) return
    onAdd({ name: name.trim(), emoji, color })
    setName('')
    setEmoji('◎')
    setColor(HABIT_COLORS[0])
    inputRef.current?.focus()
  }

  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Новая привычка..."
          className="flex-1 min-w-0 bg-transparent text-sm text-text placeholder:text-subtle outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0"><ColorPicker value={color} onChange={setColor} /></div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim()}
          className="px-3 py-1.5 bg-accent hover:bg-accent-light disabled:bg-muted disabled:cursor-not-allowed text-white text-xs rounded-lg font-medium transition-colors shrink-0"
        >
          Добавить
        </button>
      </div>
    </div>
  )
}

// ─── main component ────────────────────────────────────────────────────────────

export default function HabitsModule() {
  const { userId } = useOS()

  const [habits,      setHabits]      = useState([])
  const [completions, setCompletions] = useState({}) // { habitId: string[] }
  const [doneToday,   setDoneToday]   = useState(new Set())
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState(null)
  const [expandedId,  setExpandedId]  = useState(null)

  // ── load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return
    async function load() {
      try {
        const loaded = await habitsRepo.list(userId)
        setHabits(loaded)
        if (loaded.length > 0) {
          const ids = loaded.map(h => h.id)
          const [allComp, todaySet] = await Promise.all([
            habitCompletionsRepo.listAllByHabits(userId, ids),
            habitCompletionsRepo.listTodayByHabits(userId, ids),
          ])
          setCompletions(allComp)
          setDoneToday(todaySet)
        }
      } catch (e) {
        showToast('Ошибка загрузки'); console.error(e.message)
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

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const addHabit = useCallback(async ({ name, emoji, color }) => {
    if (!userId) return
    const position = habits.length
    const optimistic = {
      id: `tmp-${Date.now()}`, name, emoji, color,
      schedule: 'daily', schedule_days: [],
      streak: 0, best_streak: 0, position,
    }
    setHabits(prev => [...prev, optimistic])
    setCompletions(prev => ({ ...prev, [optimistic.id]: [] }))
    try {
      const saved = await habitsRepo.create(userId, { name, emoji, color, position })
      setHabits(prev => prev.map(h => h.id === optimistic.id ? saved : h))
      setCompletions(prev => {
        const { [optimistic.id]: _, ...rest } = prev
        return { ...rest, [saved.id]: [] }
      })
    } catch (e) {
      setHabits(prev => prev.filter(h => h.id !== optimistic.id))
      setCompletions(prev => { const { [optimistic.id]: _, ...rest } = prev; return rest })
      showToast('Не удалось добавить привычку'); console.error(e.message)
    }
  }, [userId, habits])

  const saveHabit = useCallback(async (id, fields) => {
    const original = habits.find(h => h.id === id)
    if (!original) return
    const updated = { ...original, ...fields }
    setHabits(prev => prev.map(h => h.id === id ? updated : h))
    setExpandedId(null)
    try {
      await habitsRepo.update(id, fields)
    } catch (e) {
      setHabits(prev => prev.map(h => h.id === id ? original : h))
      showToast('Не удалось сохранить'); console.error(e.message)
    }
  }, [habits])

  const deleteHabit = useCallback(async (id) => {
    const original = habits.find(h => h.id === id)
    setHabits(prev => prev.filter(h => h.id !== id))
    setExpandedId(null)
    try {
      await habitsRepo.remove(id)
    } catch (e) {
      if (original) setHabits(prev => [...prev, original].sort((a, b) => a.position - b.position))
      showToast('Не удалось удалить'); console.error(e.message)
    }
  }, [habits])

  const toggleToday = useCallback(async (habit) => {
    if (!isScheduledToday(habit)) return
    const wasD = doneToday.has(habit.id)
    const today = getTodayStr()

    // Optimistic
    setDoneToday(prev => {
      const next = new Set(prev)
      wasD ? next.delete(habit.id) : next.add(habit.id)
      return next
    })
    setCompletions(prev => {
      const cur = prev[habit.id] ?? []
      return {
        ...prev,
        [habit.id]: wasD ? cur.filter(d => d !== today) : [...cur, today],
      }
    })

    try {
      await habitCompletionsRepo.toggleByDate(userId, habit.id, today)
    } catch (e) {
      // Revert
      setDoneToday(prev => {
        const next = new Set(prev)
        wasD ? next.add(habit.id) : next.delete(habit.id)
        return next
      })
      setCompletions(prev => {
        const cur = prev[habit.id] ?? []
        return {
          ...prev,
          [habit.id]: wasD ? [...cur, today] : cur.filter(d => d !== today),
        }
      })
      showToast('Не удалось обновить'); console.error(e.message)
    }
  }, [userId, doneToday, completions])

  const moveHabit = useCallback(async (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= habits.length) return
    const reordered = [...habits]
    ;[reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]]
    const withPos = reordered.map((h, i) => ({ ...h, position: i }))
    setHabits(withPos)
    try {
      await Promise.all(withPos.map(h => habitsRepo.updatePosition(h.id, h.position)))
    } catch (e) {
      setHabits(habits) // revert
      showToast('Не удалось обновить порядок'); console.error(e.message)
    }
  }, [habits])

  // ── derived ──────────────────────────────────────────────────────────────────

  const todayHabits   = habits.filter(isScheduledToday)
  const doneCount     = todayHabits.filter(h => doneToday.has(h.id)).length
  const totalCount    = todayHabits.length

  // ── render ────────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* Header — full width */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: MODULE_ICONS.habits.color + '20' }}>
          <MODULE_ICONS.habits.Icon size={20} style={{ color: MODULE_ICONS.habits.color }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Привычки</h1>
          <p className="text-subtle text-sm">
            {totalCount > 0
              ? `${doneCount}/${totalCount} на сегодня · ${habits.length} всего`
              : `${habits.length} привычек`}
          </p>
        </div>
      </div>

      {/* Two-column layout: list (left) + calendar (right) */}
      <div className="flex gap-6 items-start flex-col lg:flex-row">

        {/* ── Left column: quick-add + habit list ── */}
        <div className="flex-1 min-w-0 w-full">
          <QuickAdd onAdd={addHabit} />

          {habits.length === 0 && (
            <EmptyState
              modId="habits"
              title="Привычек пока нет"
              description="Заведите первую привычку и начните строить новые ритмы"
              actionLabel="Создать привычку"
              onAction={() => inputRef.current?.focus()}
            />
          )}

          {habits.length > 0 && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden mt-5">
              {habits.map((habit, i) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  completionDates={completions[habit.id] ?? []}
                  isFirst={i === 0}
                  isFirstHabit={i === 0}
                  isLast={i === habits.length - 1}
                  isExpanded={expandedId === habit.id}
                  doneToday={doneToday.has(habit.id)}
                  scheduledToday={isScheduledToday(habit)}
                  onToggleToday={() => toggleToday(habit)}
                  onToggleExpand={() => setExpandedId(expandedId === habit.id ? null : habit.id)}
                  onSave={(fields) => saveHabit(habit.id, fields)}
                  onDelete={() => deleteHabit(habit.id)}
                  onMoveUp={() => moveHabit(i, -1)}
                  onMoveDown={() => moveHabit(i, 1)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right column: aggregate calendar ── */}
        <div className="w-full lg:w-72 lg:shrink-0">
          <HabitsCalendar habits={habits} completions={completions} />
        </div>

      </div>
    </div>
  )
}
