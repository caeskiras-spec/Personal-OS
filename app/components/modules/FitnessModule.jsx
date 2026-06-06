'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, X, Check, AlertCircle, Edit2, Target, Watch } from 'lucide-react'
import EmptyState from '../EmptyState'
import { useOS }              from '../../../lib/store'
import { MODULE_ICONS }       from '../../../lib/moduleIcons'
import { workoutsRepo }       from '../../../lib/db/workouts'
import { workoutTypesRepo }   from '../../../lib/db/workoutTypes'
import { profileRepo }        from '../../../lib/db/profile'
import DatePicker             from './DatePicker'
import { getTodayStr }        from '../../../lib/tasks-selectors'
import {
  getStatsForPeriod,
  getWeeklyCount,
  groupWorkoutsByDate,
} from '../../../lib/fitness-selectors'

// ─── Design constants ──────────────────────────────────────────────────────────

const TYPE_COLORS = [
  '#ef4444','#f59e0b','#22c55e','#3b82f6',
  '#8b5cf6','#06b6d4','#ec4899','#6c63ff',
]
const TYPE_EMOJIS = [
  '🏋️','🏃','👟','🧘','🏊','🚴','⚡','🔥',
  '💪','🤸','⛹️','🏌️','🎾','⚽','🏀','🥊',
]

const EMPTY_FORM = (date) => ({
  typeId:    null,
  typeName:  '',
  typeEmoji: '⚡',
  typeColor: '#22c55e',
  duration:  '',
  calories:  '',
  notes:     '',
  date:      date || getTodayStr(),
  exercises: [],
})

// ─── Local helpers ─────────────────────────────────────────────────────────────

function localStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

function formatDate(dateStr) {
  const today = getTodayStr()
  const yestD = new Date(today + 'T00:00:00')
  yestD.setDate(yestD.getDate() - 1)
  const yesterday = localStr(yestD)
  if (dateStr === today)     return 'Сегодня'
  if (dateStr === yesterday) return 'Вчера'
  return new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formToPayload(form) {
  return {
    typeId:    form.typeId,
    typeName:  form.typeName  || '',
    duration:  Number(form.duration) || 0,
    calories:  form.calories  ? Number(form.calories) : null,
    notes:     form.notes     || '',
    date:      form.date      || getTodayStr(),
    exercises: form.exercises || [],
  }
}

/**
 * Backward compat: old sets have { reps, weight } without usedWeight.
 * Treat old weight > 0 as usedWeight = true.
 */
function normalizeSet(s) {
  if (s.usedWeight !== undefined) return s
  return {
    reps:       s.reps      ?? '',
    usedWeight: !!s.weight,
    weight:     s.weight    ?? null,
  }
}

function normalizeSets(sets) {
  return (sets ?? []).map(normalizeSet)
}

function normalizeExercises(exercises) {
  return (exercises ?? []).map(ex => ({ ...ex, sets: normalizeSets(ex.sets) }))
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl animate-slide-up">
      <AlertCircle className="w-4 h-4 text-danger shrink-0" />
      <span className="text-text text-sm">{msg}</span>
      <button onClick={onClose} className="text-subtle hover:text-text ml-1 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 bg-surface border border-border rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

// ─── ExerciseEditor ────────────────────────────────────────────────────────────
// Set model: { reps: string|number, usedWeight: bool, weight: number|null }
// Backward compat: old { reps, weight } normalized via normalizeSet()

function ExerciseEditor({ exercises, onChange }) {
  const [newName, setNewName] = useState('')

  const addExercise = () => {
    const name = newName.trim()
    if (!name) return
    onChange([...exercises, { name, sets: [] }])
    setNewName('')
  }

  const removeExercise = (idx) =>
    onChange(exercises.filter((_, i) => i !== idx))

  const addSet = (idx) =>
    onChange(exercises.map((ex, i) =>
      i === idx
        ? { ...ex, sets: [...ex.sets, { reps: '', usedWeight: false, weight: null }] }
        : ex
    ))

  const removeSet = (ei, si) =>
    onChange(exercises.map((ex, i) =>
      i === ei ? { ...ex, sets: ex.sets.filter((_, j) => j !== si) } : ex
    ))

  const updateSet = (ei, si, field, val) =>
    onChange(exercises.map((ex, i) =>
      i === ei
        ? {
            ...ex,
            sets: ex.sets.map((s, j) => {
              if (j !== si) return s
              const next = { ...normalizeSet(s), [field]: val }
              // if unchecking usedWeight — clear weight
              if (field === 'usedWeight' && !val) next.weight = null
              return next
            }),
          }
        : ex
    ))

  return (
    <div className="flex flex-col gap-2">
      {exercises.map((ex, ei) => (
        <div key={ei} className="bg-muted/20 rounded-xl p-3 border border-border">
          {/* Exercise header */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-text text-sm">{ex.name}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => addSet(ei)}
                className="text-xs text-accent hover:text-accent-light transition-colors"
              >
                + подход
              </button>
              <button
                onClick={() => removeExercise(ei)}
                className="text-subtle hover:text-danger transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sets */}
          {ex.sets.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {ex.sets.map((rawSet, si) => {
                const s = normalizeSet(rawSet)
                return (
                  <div key={si} className="flex items-center gap-2">
                    {/* Set label */}
                    <span className="text-subtle text-xs w-16 shrink-0">Подход {si + 1}</span>

                    {/* Reps */}
                    <input
                      type="number"
                      value={s.reps}
                      onChange={e => updateSet(ei, si, 'reps', e.target.value)}
                      placeholder="повт"
                      className="w-14 bg-surface border border-border rounded-lg px-2 py-1 text-text text-xs outline-none focus:border-accent"
                    />

                    {/* usedWeight checkbox */}
                    <label className="flex items-center gap-1 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={!!s.usedWeight}
                        onChange={e => updateSet(ei, si, 'usedWeight', e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-[#6c63ff] cursor-pointer"
                      />
                      <span className="text-subtle text-xs select-none">кг</span>
                    </label>

                    {/* Weight — enabled only if usedWeight */}
                    <input
                      type="number"
                      value={s.weight ?? ''}
                      onChange={e => updateSet(ei, si, 'weight', e.target.value ? Number(e.target.value) : null)}
                      placeholder="—"
                      disabled={!s.usedWeight}
                      className={`w-14 bg-surface border border-border rounded-lg px-2 py-1 text-xs outline-none transition-opacity ${
                        s.usedWeight
                          ? 'text-text focus:border-accent'
                          : 'text-subtle opacity-30 cursor-not-allowed'
                      }`}
                    />

                    {/* Remove set */}
                    <button
                      onClick={() => removeSet(ei, si)}
                      className="text-subtle hover:text-danger transition-colors ml-auto shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <button
              onClick={() => addSet(ei)}
              className="text-subtle text-xs hover:text-accent transition-colors"
            >
              + добавить подход
            </button>
          )}
        </div>
      ))}

      {/* New exercise input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addExercise()}
          placeholder="Новое упражнение..."
          className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-accent placeholder:text-subtle"
        />
        <button
          onClick={addExercise}
          className="px-3 py-2 bg-accent/15 hover:bg-accent/25 text-accent rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── TypePicker ────────────────────────────────────────────────────────────────

function TypePicker({ types, selectedId, onSelect, userId, onTypesChange }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newType, setNewType]       = useState({ name: '', emoji: TYPE_EMOJIS[0], color: TYPE_COLORS[0] })
  const [creating, setCreating]     = useState(false)

  const createType = async () => {
    if (!newType.name.trim()) return
    setCreating(true)
    try {
      const saved = await workoutTypesRepo.create(userId, newType)
      onTypesChange(prev => [...prev, saved])
      onSelect(saved)
      setShowCreate(false)
      setNewType({ name: '', emoji: TYPE_EMOJIS[0], color: TYPE_COLORS[0] })
    } catch (err) {
      console.error('[TypePicker] create failed:', err?.message ?? err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {types.map(t => {
          const active = selectedId === t.id
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={active ? {
                backgroundColor: t.color + '25',
                color:           t.color,
                outline:         `1.5px solid ${t.color}50`,
              } : {
                backgroundColor: 'rgba(58,58,58,0.35)',
                color:           '#f0f0f0',
              }}
            >
              <span>{t.emoji}</span>
              <span>{t.name}</span>
            </button>
          )
        })}
        <button
          onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-subtle hover:text-text bg-muted/20 hover:bg-muted/40 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Новый
        </button>
      </div>

      {showCreate && (
        <div className="bg-muted/20 rounded-xl p-3 border border-border animate-slide-up">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={newType.name}
              onChange={e => setNewType(t => ({ ...t, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && createType()}
              placeholder="Название типа..."
              autoFocus
              className="bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-accent"
            />
            <div className="flex flex-wrap gap-1">
              {TYPE_EMOJIS.map(em => (
                <button
                  key={em}
                  onClick={() => setNewType(t => ({ ...t, emoji: em }))}
                  className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-colors ${
                    newType.emoji === em ? 'bg-accent/20 ring-1 ring-accent/60' : 'hover:bg-muted/50'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {TYPE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewType(t => ({ ...t, color: c }))}
                  className="w-6 h-6 rounded-full transition-all"
                  style={{
                    backgroundColor: c,
                    outline:         newType.color === c ? `2px solid ${c}` : 'none',
                    outlineOffset:   '2px',
                  }}
                />
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-1.5 text-xs rounded-lg border border-border text-subtle hover:text-text transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={createType}
                disabled={creating || !newType.name.trim()}
                className="flex-[2] py-1.5 text-xs rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors disabled:opacity-50"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── WorkoutPanel (add / edit) ─────────────────────────────────────────────────

function WorkoutPanel({ workout, initialDate, types, userId, onTypesChange, onSave, onDelete, onClose }) {
  const isEdit = !!workout
  const [form, setForm] = useState(() => {
    if (workout) {
      return {
        typeId:    workout.typeId,
        typeName:  workout.typeName  || '',
        typeEmoji: workout.typeEmoji || '⚡',
        typeColor: workout.typeColor || '#22c55e',
        duration:  workout.duration  || '',
        calories:  workout.calories  || '',
        notes:     workout.notes     || '',
        date:      workout.date      || getTodayStr(),
        // normalize sets for backward compat
        exercises: normalizeExercises(workout.exercises),
      }
    }
    return EMPTY_FORM(initialDate)
  })

  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleTypeSelect = (t) => setForm(f => ({
    ...f,
    typeId:    t.id,
    typeName:  t.name,
    typeEmoji: t.emoji,
    typeColor: t.color,
  }))

  const valid = form.date && (Number(form.duration) > 0 || form.notes.trim() || form.exercises.length > 0)

  return (
    <div className="bg-card border border-border-2 rounded-xl p-5 mb-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text text-base">
          {isEdit ? 'Редактировать тренировку' : 'Новая тренировка'}
        </h3>
        <button onClick={onClose} className="text-subtle hover:text-text transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* Type */}
        <div>
          <div className="text-xs text-subtle uppercase tracking-wider mb-2">Тип</div>
          <TypePicker
            types={types}
            selectedId={form.typeId}
            onSelect={handleTypeSelect}
            userId={userId}
            onTypesChange={onTypesChange}
          />
        </div>

        {/* Duration · Calories · Date */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <span className="text-subtle text-xs w-14">Минуты</span>
            <input
              type="number"
              value={form.duration}
              onChange={e => set('duration', e.target.value)}
              placeholder="45"
              className="w-20 bg-muted/30 border border-border rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-subtle text-xs w-14">Калории</span>
            <input
              type="number"
              value={form.calories}
              onChange={e => set('calories', e.target.value)}
              placeholder="—"
              className="w-20 bg-muted/30 border border-border rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-subtle text-xs w-14">Дата</span>
            <DatePicker
              value={form.date}
              onChange={v => set('date', v || getTodayStr())}
              noOverdue
            />
          </label>
        </div>

        {/* Notes */}
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Заметки к тренировке..."
          rows={2}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-accent resize-none placeholder:text-subtle"
        />

        {/* Exercises */}
        <div>
          <div className="text-xs text-subtle uppercase tracking-wider mb-2">Упражнения</div>
          <ExerciseEditor
            exercises={form.exercises}
            onChange={exs => set('exercises', exs)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-subtle text-sm hover:text-text transition-colors"
          >
            Отмена
          </button>

          {isEdit && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-2 rounded-lg border border-danger/25 text-danger/60 text-sm hover:text-danger hover:border-danger/50 hover:bg-danger/5 transition-colors"
            >
              Удалить
            </button>
          )}
          {isEdit && confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-subtle">Удалить?</span>
              <button
                onClick={onDelete}
                className="px-3 py-1.5 rounded-lg bg-danger/15 text-danger text-xs font-medium hover:bg-danger/25 transition-colors"
              >
                Да
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-subtle text-xs hover:text-text transition-colors"
              >
                Нет
              </button>
            </div>
          )}

          <button
            onClick={() => valid && onSave(form)}
            disabled={!valid}
            className="ml-auto px-6 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            {isEdit ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── WorkoutCard ───────────────────────────────────────────────────────────────

function WorkoutCard({ workout, isSelected, onClick }) {
  const exCount = workout.exercises?.length ?? 0
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-card-accent border-accent/40'
          : 'bg-card border-border-2 hover:bg-surface-2 hover:border-border-hover'
      }`}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ backgroundColor: (workout.typeColor ?? '#22c55e') + '22', color: workout.typeColor ?? '#22c55e' }}
      >
        {workout.typeEmoji || '⚡'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-text text-sm">{workout.typeName || 'Тренировка'}</span>
          {exCount > 0 && (
            <span className="text-xs text-subtle bg-muted/40 px-1.5 py-0.5 rounded-md">
              {exCount} упр.
            </span>
          )}
        </div>
        {workout.notes && (
          <p className="text-subtle text-xs mt-0.5 truncate">{workout.notes}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        {workout.duration > 0 && (
          <div className="text-text font-semibold text-sm">
            {workout.duration} <span className="text-subtle font-normal text-xs">мин</span>
          </div>
        )}
        {workout.calories > 0 && (
          <div className="text-subtle text-xs">{workout.calories} ккал</div>
        )}
      </div>
    </div>
  )
}

// ─── WeeklyGoalWidget ──────────────────────────────────────────────────────────

function WeeklyGoalWidget({ weeklyCount, weeklyGoal, onGoalChange }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(weeklyGoal))

  useEffect(() => { setDraft(String(weeklyGoal)) }, [weeklyGoal])

  const save = () => {
    onGoalChange(Math.max(0, parseInt(draft) || 0))
    setEditing(false)
  }

  const pct  = weeklyGoal > 0 ? Math.min(100, (weeklyCount / weeklyGoal) * 100) : 0
  const done = weeklyGoal > 0 && weeklyCount >= weeklyGoal

  return (
    <div className="bg-card border border-border-2 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-medium text-subtle uppercase tracking-wider">Цель недели</span>
        </div>
        <button
          onClick={() => { setDraft(String(weeklyGoal)); setEditing(e => !e) }}
          className="text-subtle hover:text-text transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            className="w-14 bg-surface border border-border rounded-lg px-2 py-1.5 text-text text-sm outline-none focus:border-accent"
            autoFocus
          />
          <span className="text-subtle text-xs">трен.</span>
          <button onClick={save} className="text-accent hover:text-accent-light transition-colors ml-auto">
            <Check className="w-4 h-4" />
          </button>
        </div>
      ) : weeklyGoal === 0 ? (
        <button
          onClick={() => setEditing(true)}
          className="text-subtle text-xs hover:text-accent transition-colors"
        >
          Установить цель...
        </button>
      ) : (
        <>
          <div className="flex items-end gap-1.5 mb-2">
            <span
              className="text-2xl font-bold leading-none"
              style={{ color: done ? '#22c55e' : undefined }}
            >
              {weeklyCount}
            </span>
            <span className="text-subtle text-sm mb-0.5">/ {weeklyGoal} за неделю</span>
            {done && <span className="text-success text-sm mb-0.5">✓</span>}
          </div>
          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: done ? '#22c55e' : '#6c63ff' }}
            />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Watch stub ───────────────────────────────────────────────────────────────
// Future: replace with BLE/WearOS/HealthKit integration; signature stays the same.
async function connectWatch() {
  return { status: 'in_development' }
}

function WatchWidget({ onToast }) {
  const [clicked, setClicked] = useState(false)
  const handle = async () => {
    const res = await connectWatch()
    if (res.status === 'in_development') onToast('⌚ Подключение к часам — функция в разработке')
    setClicked(true)
    setTimeout(() => setClicked(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={handle}
      className="flex items-center gap-2 w-full px-3 py-2.5 bg-card border border-border-2 hover:border-border-hover rounded-xl text-sm text-subtle hover:text-text transition-all"
    >
      <Watch className="w-4 h-4 shrink-0" />
      <span className="flex-1 text-left text-xs">Подключить к часам</span>
      <span className="text-[9px] px-1.5 py-0.5 bg-warning/10 text-warning rounded font-medium shrink-0">В разработке</span>
    </button>
  )
}

// ─── WorkoutCalendar (interactive diary) ──────────────────────────────────────
// Replaces the static heatmap. Click a day → see workouts + add for that date.

const DAYS_LABEL = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function isoWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  return dow === 0 ? 7 : dow
}

function WorkoutCalendar({ workouts, onAddForDate, openPanelDate }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const today = getTodayStr()

  // Build date → Workout[] map
  const dateMap = useMemo(() => {
    const m = new Map()
    for (const w of workouts) {
      if (!w.date) continue
      if (!m.has(w.date)) m.set(w.date, [])
      m.get(w.date).push(w)
    }
    return m
  }, [workouts])

  // Build 35-day cells aligned Mon–Sun (same pattern as HabitHeatmap)
  const { weeks, legendColor } = useMemo(() => {
    const todayD = new Date(today + 'T00:00:00')
    const cells = Array.from({ length: 35 }, (_, i) => {
      const d = new Date(todayD)
      d.setDate(todayD.getDate() - (34 - i))
      return localStr(d)
    })
    const firstIso = isoWeekday(cells[0])
    const padFront = firstIso - 1
    const padded = [...Array(padFront).fill(null), ...cells]
    const wks = []
    for (let i = 0; i < padded.length; i += 7) wks.push(padded.slice(i, i + 7))

    // pick dominant color for legend (most recent workout with a color)
    let lc = '#22c55e'
    for (let i = cells.length - 1; i >= 0; i--) {
      const ws = dateMap.get(cells[i])
      if (ws?.length && ws[0].typeColor) { lc = ws[0].typeColor; break }
    }
    return { weeks: wks, legendColor: lc }
  }, [today, dateMap])

  // Cell background: neutral if empty, typeColor of first workout if has workouts
  const getCellColor = (date) => {
    const ws = dateMap.get(date)
    if (!ws || ws.length === 0) return null
    const color = ws[0].typeColor ?? '#22c55e'
    return { bg: color, opacity: ws.length > 1 ? 0.85 : 0.6 }
  }

  const dayWorkouts = selectedDate ? (dateMap.get(selectedDate) ?? []) : []

  const handleCellClick = (date) => {
    setSelectedDate(d => (d === date ? null : date))
  }

  return (
    <div className="bg-card border border-border-2 rounded-xl p-4">
      <div className="text-xs font-medium text-subtle uppercase tracking-wider mb-3">
        35 дней
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_LABEL.map(d => (
          <div key={d} className="text-center text-[9px] text-subtle">{d}</div>
        ))}
      </div>

      {/* Grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
          {week.map((date, ci) => {
            if (!date) return <div key={ci} className="h-5 rounded-sm" />
            const isToday    = date === today
            const isSelected = date === selectedDate
            const isPanelDate = date === openPanelDate
            const colored = getCellColor(date)
            return (
              <button
                key={date}
                title={formatDate(date)}
                onClick={() => handleCellClick(date)}
                className={`h-5 rounded-sm transition-all hover:opacity-80 focus:outline-none ${!colored ? 'bg-muted/30' : ''} ${isToday ? 'ring-1 ring-white/30 ring-offset-1 ring-offset-[#1d1d1d]' : isSelected || isPanelDate ? 'ring-1 ring-accent/60 ring-offset-1 ring-offset-[#1d1d1d]' : ''}`}
                style={colored ? { backgroundColor: colored.bg, opacity: colored.opacity } : {}}
              />
            )
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 justify-end">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted/30" />
          <span className="text-[9px] text-subtle">Нет</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: legendColor, opacity: 0.6 }} />
          <span className="text-[9px] text-subtle">1 тренировка</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: legendColor, opacity: 0.85 }} />
          <span className="text-[9px] text-subtle">2+</span>
        </div>
      </div>

      {/* Day panel */}
      {selectedDate && (
        <div className="mt-3 pt-3 border-t border-border animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text">{formatDate(selectedDate)}</span>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-subtle hover:text-text transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {dayWorkouts.length > 0 ? (
            <div className="flex flex-col gap-1 mb-2">
              {dayWorkouts.map(w => (
                <div key={w.id} className="flex items-center gap-2 py-1">
                  <span className="text-base leading-none">{w.typeEmoji || '⚡'}</span>
                  <span className="text-xs text-text flex-1 truncate">{w.typeName || 'Тренировка'}</span>
                  {w.duration > 0 && (
                    <span className="text-xs text-subtle shrink-0">{w.duration} мин</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-subtle text-xs mb-2">Нет тренировок</p>
          )}

          <button
            onClick={() => {
              onAddForDate(selectedDate)
              setSelectedDate(null)
            }}
            className="w-full py-1.5 text-xs text-accent hover:text-accent-light border border-accent/20 hover:border-accent/40 rounded-lg transition-colors"
          >
            + Добавить тренировку
          </button>
        </div>
      )}
    </div>
  )
}

// ─── FitnessModule (main) ──────────────────────────────────────────────────────
//
// panel state:
//   null                          → nothing open
//   { mode: 'add', date: string } → add form (with preset date)
//   workout_object (has .id)      → edit form

export default function FitnessModule({ module: mod }) {
  const { userId } = useOS()

  const [workouts,   setWorkouts]   = useState([])
  const [types,      setTypes]      = useState([])
  const [weeklyGoal, setWeeklyGoal] = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [panel,      setPanel]      = useState(null)
  const [statPeriod, setStatPeriod] = useState('week')
  const [toast,      setToast]      = useState(null)

  const showToast = useCallback((msg) => setToast(msg), [])

  // ── Load ──

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [ts, ws, profile] = await Promise.all([
        workoutTypesRepo.ensureDefaults(userId),
        workoutsRepo.list(userId),
        profileRepo.get(userId),
      ])
      setTypes(ts)
      setWorkouts(ws)
      setWeeklyGoal(profile?.workout_weekly_goal ?? 0)
    } catch (err) {
      console.error('[FitnessModule] load:', err?.message ?? err)
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  // ── CRUD ──

  const handleAdd = async (form) => {
    const payload = formToPayload(form)
    const optimistic = {
      id:        `tmp-${Date.now()}`,
      typeId:    form.typeId,
      typeName:  form.typeName  || 'Тренировка',
      typeEmoji: form.typeEmoji || '⚡',
      typeColor: form.typeColor || '#22c55e',
      ...payload,
    }
    setWorkouts(prev =>
      [optimistic, ...prev].sort((a, b) => b.date.localeCompare(a.date))
    )
    setPanel(null)
    try {
      const saved = await workoutsRepo.create(userId, payload)
      setWorkouts(prev => prev.map(w => w.id === optimistic.id ? saved : w))
    } catch (err) {
      console.error(err)
      setWorkouts(prev => prev.filter(w => w.id !== optimistic.id))
      showToast('Не удалось сохранить тренировку')
    }
  }

  const handleEdit = async (form) => {
    if (!panel || panel.mode === 'add') return
    const original = { ...panel }
    const id       = original.id
    const updated  = {
      ...original,
      typeId:    form.typeId,
      typeName:  form.typeName  || 'Тренировка',
      typeEmoji: form.typeEmoji || '⚡',
      typeColor: form.typeColor || '#22c55e',
      ...formToPayload(form),
    }
    setWorkouts(prev => prev.map(w => w.id === id ? updated : w))
    setPanel(null)
    try {
      const saved = await workoutsRepo.update(id, formToPayload(form))
      setWorkouts(prev => prev.map(w => w.id === id ? saved : w))
    } catch (err) {
      console.error(err)
      setWorkouts(prev => prev.map(w => w.id === id ? original : w))
      showToast('Не удалось обновить тренировку')
    }
  }

  const handleDelete = async () => {
    if (!panel || panel.mode === 'add') return
    const id = panel.id
    setWorkouts(prev => prev.filter(w => w.id !== id))
    setPanel(null)
    try {
      await workoutsRepo.remove(id)
    } catch (err) {
      console.error(err)
      showToast('Не удалось удалить тренировку')
      load()
    }
  }

  const handleGoalChange = async (val) => {
    const prev = weeklyGoal
    setWeeklyGoal(val)
    try {
      await profileRepo.upsert(userId, { workout_weekly_goal: val })
    } catch (err) {
      console.error(err)
      setWeeklyGoal(prev)
      showToast('Не удалось сохранить цель')
    }
  }

  // Calendar: open add form for a specific date
  const handleAddForDate = (date) => {
    setPanel({ mode: 'add', date })
    // scroll panel into view (it renders at top of list column)
    setTimeout(() => {
      document.getElementById('workout-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }

  // ── Derived ──

  const stats       = getStatsForPeriod(workouts, statPeriod)
  const weeklyCount = getWeeklyCount(workouts)
  const grouped     = groupWorkoutsByDate(workouts)

  const isAddPanel  = panel?.mode === 'add'
  const isEditPanel = panel && !isAddPanel
  const selectedId  = isEditPanel ? panel.id : null
  // For calendar highlight: show which date is currently "open" in the panel
  const openPanelDate = isAddPanel ? panel.date : (isEditPanel ? panel.date : null)

  // ── Render ──

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: MODULE_ICONS.fitness.color + '20' }}>
            <MODULE_ICONS.fitness.Icon size={20} style={{ color: MODULE_ICONS.fitness.color }} />
          </div>
          <div>
          <h1 className="text-2xl font-bold text-text">Тренировки</h1>
          <p className="text-subtle text-sm mt-0.5">
            {stats.count} {statPeriod === 'week' ? 'за неделю' : 'за месяц'}
            {stats.duration > 0 && ` · ${stats.duration} мин`}
            {stats.calories > 0 && ` · ${stats.calories} ккал`}
          </p>
        </div></div>
        <button
          onClick={() => setPanel(p => (p?.mode === 'add' && !p.date) ? null : { mode: 'add', date: getTodayStr() })}
          className="flex items-center gap-2 bg-accent hover:bg-accent-light text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex bg-surface border border-border rounded-lg p-0.5">
          {['week', 'month'].map(p => (
            <button
              key={p}
              onClick={() => setStatPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statPeriod === p ? 'bg-accent/20 text-accent' : 'text-subtle hover:text-text'
              }`}
            >
              {p === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-xl font-bold text-text leading-tight">{stats.count}</div>
            <div className="text-xs text-subtle">тренировок</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-text leading-tight">{stats.duration}</div>
            <div className="text-xs text-subtle">минут</div>
          </div>
          {stats.calories > 0 && (
            <div className="text-center">
              <div className="text-xl font-bold text-text leading-tight">{stats.calories}</div>
              <div className="text-xs text-subtle">ккал</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit panel ── */}
      {panel && (
        <div id="workout-panel">
          <WorkoutPanel
            workout={isEditPanel ? panel : null}
            initialDate={isAddPanel ? panel.date : getTodayStr()}
            types={types}
            userId={userId}
            onTypesChange={setTypes}
            onSave={isAddPanel ? handleAdd : handleEdit}
            onDelete={handleDelete}
            onClose={() => setPanel(null)}
          />
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="flex gap-6 flex-col lg:flex-row">

        {/* Left: workout history */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <Skeleton />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="w-8 h-8 text-danger" />
              <p className="text-text">{error}</p>
              <button onClick={load} className="text-sm text-accent hover:text-accent-light transition-colors">
                Повторить
              </button>
            </div>
          ) : workouts.length === 0 ? (
            <EmptyState
              modId="fitness"
              title="Тренировок пока нет"
              description="Запишите первую — и начните отслеживать прогресс"
              actionLabel="Добавить тренировку"
              onAction={() => setPanel({ mode: 'add', date: getTodayStr() })}
            />
          ) : (
            <div className="flex flex-col gap-5">
              {grouped.map(({ date, workouts: ws }) => (
                <div key={date}>
                  <div className="text-xs text-subtle uppercase tracking-widest mb-2 px-1">
                    {formatDate(date)}
                  </div>
                  <div className="flex flex-col gap-2">
                    {ws.map(w => (
                      <WorkoutCard
                        key={w.id}
                        workout={w}
                        isSelected={selectedId === w.id}
                        onClick={() => setPanel(selectedId === w.id ? null : w)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: widgets */}
        {!loading && (
          <div className="w-full lg:w-56 flex flex-col gap-4 shrink-0">
            <WeeklyGoalWidget
              weeklyCount={weeklyCount}
              weeklyGoal={weeklyGoal}
              onGoalChange={handleGoalChange}
            />
            <WorkoutCalendar
              workouts={workouts}
              onAddForDate={handleAddForDate}
              openPanelDate={openPanelDate}
            />
            <WatchWidget onToast={showToast} />
          </div>
        )}
      </div>
    </div>
  )
}
