'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import EmptyState from '../EmptyState'
import {
  Plus, X, AlertCircle, Star, ChevronLeft, ChevronRight,
  Camera, Trash2, Heart, Clock,
} from 'lucide-react'
import { useOS } from '../../../lib/store'
import { MODULE_ICONS } from '../../../lib/moduleIcons'
import { foodEntriesRepo }   from '../../../lib/db/foodEntries'
import { foodFavoritesRepo } from '../../../lib/db/foodFavorites'
import { profileRepo }       from '../../../lib/db/profile'
import { workoutsRepo }      from '../../../lib/db/workouts'
import { getTodayStr }       from '../../../lib/tasks-selectors'
import { getCaloriesBurnedByDate } from '../../../lib/fitness-selectors'
import {
  MEAL_TYPES, groupByMeal, sumMacros, getDatesWithEntries,
} from '../../../lib/nutrition-selectors'

// ─── constants ────────────────────────────────────────────────────────────────

const ACCENT = '#10b981'  // nutrition green

const MONTHS_RU   = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function round1(n) { return Math.round((n ?? 0) * 10) / 10 }
function roundInt(n) { return Math.round(n ?? 0) }

function currentTimeStr() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
}

/** Returns minutes since last meal (date+time) for today, or null if none */
function minutesSinceLastMeal(todayEntries) {
  const withTime = todayEntries.filter(e => e.time)
  if (withTime.length === 0) return null
  const latest = withTime.reduce((a, b) => (a.time > b.time ? a : b))
  const [h, m] = latest.time.split(':').map(Number)
  const now = new Date()
  const lastMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime()
  const diff = Math.floor((now.getTime() - lastMs) / 60000)
  return diff >= 0 ? diff : null
}

// ─── photo stub ───────────────────────────────────────────────────────────────
// Future: replace with real API call; signature stays the same.
async function analyzePhotoCalories(_file) {
  return { status: 'in_development' }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-card border border-border-2 rounded-xl px-4 py-3 shadow-lg animate-slide-up">
      <AlertCircle className="w-4 h-4 text-warning shrink-0" />
      <span className="text-sm text-text">{msg}</span>
      <button onClick={onClose} className="text-subtle hover:text-text ml-1"><X className="w-3 h-3" /></button>
    </div>
  )
}

// ─── Calorie Ring ─────────────────────────────────────────────────────────────

function CalorieRing({ eaten, goal, burned }) {
  const net    = eaten - burned
  const ratio  = goal > 0 ? Math.min(eaten / goal, 1) : 0
  const r      = 36
  const circ   = 2 * Math.PI * r
  const dash   = circ * ratio

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#2a2a2a" strokeWidth="8" />
          <circle
            cx="48" cy="48" r={r} fill="none"
            stroke={ACCENT} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div className="flex flex-col items-center z-10">
          <span className="text-lg font-bold text-text leading-none">{roundInt(eaten)}</span>
          <span className="text-[9px] text-subtle">ккал</span>
        </div>
      </div>
      {goal > 0 && (
        <span className="text-[10px] text-subtle">{roundInt(eaten)} / {goal} ккал</span>
      )}
      {burned > 0 && (
        <span className="text-[10px]" style={{ color: ACCENT }}>−{roundInt(burned)} сожжено</span>
      )}
    </div>
  )
}

// ─── Macro Bars ───────────────────────────────────────────────────────────────

function MacroBars({ protein, carbs, fat, proteinGoal = 0, carbsGoal = 0, fatGoal = 0 }) {
  const macros = [
    { label: 'Белки',  value: protein, goal: proteinGoal, color: '#6c63ff' },
    { label: 'Углев.', value: carbs,   goal: carbsGoal,   color: '#f59e0b' },
    { label: 'Жиры',   value: fat,     goal: fatGoal,     color: '#ef4444' },
  ]
  // If no goals set, normalise by relative proportion
  const hasGoals = proteinGoal > 0 || carbsGoal > 0 || fatGoal > 0
  const total    = protein + carbs + fat || 1

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {macros.map(({ label, value, goal, color }) => {
        const pct = hasGoals
          ? (goal > 0 ? Math.min(value / goal * 100, 100) : 0)
          : Math.min(value / total * 100, 100)
        return (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[10px] text-subtle w-12 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-[10px] text-text shrink-0" style={{ minWidth: 64, textAlign: 'right' }}>
              {round1(value)}{goal > 0 ? ` / ${round1(goal)}` : ''} г
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Nutrition Calendar (month, left panel) ────────────────────────────────────

function NutritionCalendar({ datesWithEntries, selectedDate, onSelectDate }) {
  const today = getTodayStr()
  const [viewing, setViewing] = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }
  })

  const prevMonth = () => setViewing(v => ({ month: v.month === 0 ? 11 : v.month - 1, year: v.month === 0 ? v.year - 1 : v.year }))
  const nextMonth = () => setViewing(v => ({ month: v.month === 11 ? 0 : v.month + 1, year: v.month === 11 ? v.year + 1 : v.year }))

  const cells = useMemo(() => {
    const { year, month } = viewing
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
    const lastDay  = new Date(year, month + 1, 0).getDate()
    const out = []
    for (let i = 0; i < firstDow; i++) out.push(null)
    for (let d = 1; d <= lastDay; d++) out.push(new Date(year, month, d))
    return out
  }, [viewing])

  return (
    <div className="bg-card border border-border-2 rounded-xl p-4 select-none shrink-0" style={{ width: 220 }}>
      <p className="text-[10px] text-subtle uppercase tracking-wider mb-3">Календарь</p>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 text-subtle hover:text-text transition-colors rounded">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-text">{MONTHS_RU[viewing.month]} {viewing.year}</span>
        <button type="button" onClick={nextMonth} className="p-1 text-subtle hover:text-text transition-colors rounded">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-0.5">
        {WEEKDAYS_RU.map(d => <div key={d} className="text-center text-[9px] text-subtle py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="h-8" />
          const ds         = localStr(date)
          const isToday    = ds === today
          const isSelected = ds === selectedDate
          const hasEntry   = datesWithEntries.has(ds)
          return (
            <button
              key={ds}
              type="button"
              onClick={() => onSelectDate(ds)}
              className={`h-8 w-full flex flex-col items-center justify-center rounded-lg transition-colors
                ${isToday    ? 'bg-[#10b981]/10' : ''}
                ${isSelected ? 'ring-1 ring-[#10b981]/60' : ''}
                hover:bg-muted/30 cursor-pointer
              `}
            >
              <span className={`text-[10px] font-medium leading-none ${isToday ? 'text-[#10b981]' : 'text-subtle'}`}>
                {date.getDate()}
              </span>
              {hasEntry && (
                <span className="w-1 h-1 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: '#10b981' }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Entry Form ───────────────────────────────────────────────────────────────

// ─── Last Meal Timer ──────────────────────────────────────────────────────────

function LastMealTimer({ todayEntries }) {
  const [mins, setMins] = useState(() => minutesSinceLastMeal(todayEntries))

  useEffect(() => {
    setMins(minutesSinceLastMeal(todayEntries))
    const t = setInterval(() => setMins(minutesSinceLastMeal(todayEntries)), 60000)
    return () => clearInterval(t)
  }, [todayEntries])

  return (
    <div className="bg-card border border-border-2 rounded-xl p-4 select-none" style={{ width: 220 }}>
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: '#10b981' }} />
        <span className="text-[10px] text-subtle uppercase tracking-wider">С последнего приёма</span>
      </div>
      {mins === null ? (
        <p className="text-xs text-subtle">Нет записей сегодня</p>
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-text">{Math.floor(mins / 60)}</span>
          <span className="text-sm text-subtle">ч</span>
          <span className="text-2xl font-bold text-text ml-1">{String(mins % 60).padStart(2,'0')}</span>
          <span className="text-sm text-subtle">мин</span>
        </div>
      )}
    </div>
  )
}

// ─── Entry Form ───────────────────────────────────────────────────────────────

const EMPTY_ENTRY = { name: '', calories: '', protein: '', carbs: '', fat: '', mealType: 'breakfast', time: '' }

function EntryForm({ date, favorites, onAdd, onClose, presetFav }) {
  const [fields,     setFields]     = useState(() => {
    const base = { ...EMPTY_ENTRY, time: currentTimeStr() }
    return presetFav
      ? { ...base, name: presetFav.name, calories: String(presetFav.calories), protein: String(presetFav.protein), carbs: String(presetFav.carbs), fat: String(presetFav.fat) }
      : base
  })
  const [photoFile,  setPhotoFile]  = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [analyzing,  setAnalyzing]  = useState(false)
  const [showPhoto,  setShowPhoto]  = useState(false)
  const fileRef = useRef(null)

  const set = (k, v) => setFields(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!fields.name.trim()) return
    onAdd({
      name:     fields.name.trim(),
      calories: parseInt(fields.calories)  || 0,
      protein:  parseFloat(fields.protein) || 0,
      carbs:    parseFloat(fields.carbs)   || 0,
      fat:      parseFloat(fields.fat)     || 0,
      mealType: fields.mealType,
      time:     fields.time || null,
      date,
    })
    onClose()
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleAnalyze = async () => {
    if (!photoFile) return
    setAnalyzing(true)
    const result = await analyzePhotoCalories(photoFile)
    setAnalyzing(false)
    if (result.status === 'in_development') {
      // show inline notice — parent will receive this via toast if needed
      alert('Функция в разработке')
      return
    }
    // Future: set fields from result
    setFields(f => ({ ...f, name: result.name ?? f.name, calories: String(result.calories ?? f.calories), protein: String(result.protein ?? f.protein), carbs: String(result.carbs ?? f.carbs), fat: String(result.fat ?? f.fat) }))
  }

  return (
    <div className="bg-card border border-border-2 rounded-xl p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text">Новая запись · {fmtDate(date)}</span>
        <button onClick={onClose} className="text-subtle hover:text-text transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Meal type pills */}
      <div className="flex gap-1 flex-wrap mb-3">
        {MEAL_TYPES.map(mt => (
          <button
            key={mt.id}
            type="button"
            onClick={() => set('mealType', mt.id)}
            className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${fields.mealType === mt.id ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-subtle hover:text-text'}`}
          >
            {mt.emoji} {mt.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {/* Name */}
        <input
          autoFocus
          value={fields.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Название продукта / блюда"
          className="w-full bg-bg border border-border-2 rounded-lg px-3 py-2 text-sm text-text placeholder-subtle outline-none focus:border-[#10b981]/50 transition-colors"
        />

        {/* Time */}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-subtle shrink-0" />
          <input
            type="time"
            value={fields.time}
            onChange={e => set('time', e.target.value)}
            className="bg-bg border border-border-2 rounded-lg px-2 py-1.5 text-xs text-text outline-none focus:border-[#10b981]/50 transition-colors"
          />
          <span className="text-[10px] text-subtle">Время приёма</span>
        </div>

        {/* Macros row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: 'calories', label: 'Калории', placeholder: '0 ккал' },
            { key: 'protein',  label: 'Белки г', placeholder: '0' },
            { key: 'carbs',    label: 'Углев. г', placeholder: '0' },
            { key: 'fat',      label: 'Жиры г',  placeholder: '0' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="text-[9px] text-subtle uppercase tracking-wider">{label}</span>
              <input
                type="number" min="0" step={key === 'calories' ? '1' : '0.1'}
                value={fields[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full bg-bg border border-border-2 rounded-lg px-2 py-1.5 text-xs text-text outline-none focus:border-[#10b981]/50 transition-colors"
              />
            </div>
          ))}
        </div>

        {/* Photo feature */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPhoto(s => !s)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-subtle hover:text-text border border-border-2 rounded-lg transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            📷 Посчитать по фото
            <span className="ml-1 px-1.5 py-0.5 bg-warning/10 text-warning text-[9px] rounded font-medium">В разработке</span>
          </button>
        </div>

        {showPhoto && (
          <div className="border border-dashed border-border-2 rounded-lg p-3 flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            {photoPreview
              ? <img src={photoPreview} alt="preview" className="w-full max-h-32 object-contain rounded-lg opacity-70" />
              : <div className="h-20 flex items-center justify-center text-subtle text-xs cursor-pointer" onClick={() => fileRef.current?.click()}>
                  Нажмите, чтобы выбрать фото
                </div>
            }
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-subtle hover:text-text transition-colors">
                {photoPreview ? 'Изменить фото' : 'Выбрать'}
              </button>
              {photoFile && (
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="px-3 py-1 text-xs bg-warning/20 text-warning rounded-lg hover:bg-warning/30 disabled:opacity-50 transition-colors"
                >
                  {analyzing ? 'Анализ...' : 'Анализировать'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Favorites quick-add */}
        {favorites.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-subtle uppercase tracking-wider">Избранное</span>
            <div className="flex gap-1.5 flex-wrap">
              {favorites.slice(0, 6).map(fav => (
                <button
                  key={fav.id}
                  type="button"
                  onClick={() => setFields({ name: fav.name, calories: String(fav.calories), protein: String(fav.protein), carbs: String(fav.carbs), fat: String(fav.fat), mealType: fields.mealType })}
                  className="px-2 py-1 bg-surface border border-border-2 rounded-lg text-xs text-text hover:border-[#10b981]/40 hover:bg-[#10b981]/5 transition-colors flex items-center gap-1"
                >
                  <Star className="w-2.5 h-2.5 shrink-0" style={{ color: '#10b981' }} />
                  {fav.name}
                  <span className="text-subtle">{fav.calories} ккал</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!fields.name.trim()}
            className="flex-1 py-2 bg-[#10b981]/20 text-[#10b981] rounded-lg text-sm font-medium hover:bg-[#10b981]/30 disabled:opacity-40 transition-colors"
          >
            Добавить
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-subtle hover:text-text text-sm transition-colors">
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Entry Card ───────────────────────────────────────────────────────────────

function EntryCard({ entry, onRemove, onFavorite }) {
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <div className="flex items-center gap-3 px-3 py-2 group hover:bg-surface-2 transition-colors rounded-lg">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text truncate block">{entry.name}</span>
        <div className="flex gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] font-medium" style={{ color: '#10b981' }}>{roundInt(entry.calories)} ккал</span>
          {entry.protein > 0 && <span className="text-[10px] text-subtle">Б {round1(entry.protein)}г</span>}
          {entry.carbs   > 0 && <span className="text-[10px] text-subtle">У {round1(entry.carbs)}г</span>}
          {entry.fat     > 0 && <span className="text-[10px] text-subtle">Ж {round1(entry.fat)}г</span>}
          {entry.time    &&     <span className="text-[10px] text-subtle">{entry.time}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          title="В избранное"
          onClick={() => onFavorite(entry)}
          className="p-1 text-subtle hover:text-[#10b981] transition-colors"
        >
          <Heart className="w-3.5 h-3.5" />
        </button>
        {confirmDel ? (
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => onRemove(entry.id)} className="text-danger font-medium hover:text-danger/80 px-1">Да</button>
            <button onClick={() => setConfirmDel(false)} className="text-subtle hover:text-text px-1">Нет</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDel(true)} className="p-1 text-subtle hover:text-danger transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Favorites Panel ──────────────────────────────────────────────────────────

function FavoritesPanel({ favorites, onRemove }) {
  if (favorites.length === 0) return (
    <p className="text-subtle text-xs text-center py-4">Нет избранных продуктов.<br/>Нажмите ♥ на записи, чтобы добавить.</p>
  )
  return (
    <div className="flex flex-col gap-1">
      {favorites.map(fav => (
        <div key={fav.id} className="flex items-center gap-3 px-3 py-2 group hover:bg-surface-2 rounded-lg transition-colors">
          <Star className="w-3.5 h-3.5 shrink-0" style={{ color: '#10b981' }} />
          <div className="flex-1 min-w-0">
            <span className="text-sm text-text truncate block">{fav.name}</span>
            <span className="text-[10px] text-subtle">{fav.calories} ккал · Б{round1(fav.protein)} У{round1(fav.carbs)} Ж{round1(fav.fat)}</span>
          </div>
          <button
            onClick={() => onRemove(fav.id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-subtle hover:text-danger transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-8">
      <div className="w-[220px] shrink-0 h-64 bg-card border border-border-2 rounded-xl animate-pulse" />
      <div className="flex-1 flex flex-col gap-4">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-card border border-border-2 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )
}

// ─── Calorie Goal Widget ──────────────────────────────────────────────────────

function CalorieGoalWidget({ goal, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(String(goal || ''))

  useEffect(() => { setVal(String(goal || '')) }, [goal])

  const handleSave = () => {
    const v = parseInt(val) || 0
    onSave(v)
    setEditing(false)
  }

  if (editing) return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        type="number" min="0" step="50"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
        className="w-24 bg-bg border border-[#10b981]/50 rounded-lg px-2 py-1 text-sm text-text outline-none"
      />
      <button onClick={handleSave} className="text-xs text-[#10b981] hover:text-[#34d399] transition-colors">Сохранить</button>
      <button onClick={() => setEditing(false)} className="text-xs text-subtle hover:text-text transition-colors">Отмена</button>
    </div>
  )

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-subtle">Цель:</span>
      <button onClick={() => setEditing(true)} className="text-text hover:text-[#10b981] transition-colors font-medium">
        {goal > 0 ? `${goal} ккал` : 'Не задана'}
      </button>
    </div>
  )
}

// ─── MacroGoals Widget ────────────────────────────────────────────────────────

function InlineNumberEdit({ label, value, onSave, color }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(String(value || ''))
  useEffect(() => { setVal(String(value || '')) }, [value])
  const save = () => { onSave(parseFloat(val) || 0); setEditing(false) }
  if (editing) return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-subtle">{label}</span>
      <input
        autoFocus type="number" min="0" step="5"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="w-16 bg-bg border rounded px-1.5 py-0.5 text-xs text-text outline-none"
        style={{ borderColor: color + '80' }}
      />
      <button onClick={save} className="text-[10px] transition-colors" style={{ color }}>✓</button>
      <button onClick={() => setEditing(false)} className="text-[10px] text-subtle hover:text-text transition-colors">✕</button>
    </div>
  )
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-subtle">{label}</span>
      <button onClick={() => setEditing(true)} className="text-[10px] font-medium transition-colors hover:opacity-80" style={{ color: value > 0 ? color : '#666' }}>
        {value > 0 ? `${round1(value)} г` : '—'}
      </button>
    </div>
  )
}

function MacroGoalsRow({ proteinGoal, carbsGoal, fatGoal, onSaveProtein, onSaveCarbs, onSaveFat }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[10px] text-subtle uppercase tracking-wider shrink-0">Цели БЖУ:</span>
      <InlineNumberEdit label="Б" value={proteinGoal} onSave={onSaveProtein} color="#6c63ff" />
      <InlineNumberEdit label="У" value={carbsGoal}   onSave={onSaveCarbs}   color="#f59e0b" />
      <InlineNumberEdit label="Ж" value={fatGoal}     onSave={onSaveFat}     color="#ef4444" />
    </div>
  )
}

// ─── NutritionModule (main) ────────────────────────────────────────────────────

export default function NutritionModule() {
  const { userId } = useOS()

  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [toast,       setToast]       = useState(null)

  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [entries,      setEntries]      = useState([])   // all entries (all dates)
  const [dayEntries,   setDayEntries]   = useState([])   // entries for selectedDate
  const [favorites,    setFavorites]    = useState([])
  const [workouts,     setWorkouts]     = useState([])
  const [calorieGoal,  setCalorieGoal]  = useState(0)
  const [proteinGoal,  setProteinGoal]  = useState(0)
  const [carbsGoal,    setCarbsGoal]    = useState(0)
  const [fatGoal,      setFatGoal]      = useState(0)
  const [showForm,     setShowForm]     = useState(false)
  const [showFavTab,   setShowFavTab]   = useState(false)
  const [statPeriod,   setStatPeriod]   = useState('week')

  const showToast = (msg) => setToast(msg)

  // ── load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return
    Promise.all([
      foodEntriesRepo.listAll(userId),
      foodFavoritesRepo.list(userId),
      workoutsRepo.list(userId),
      profileRepo.get(userId),
    ]).then(([allE, favs, wkts, profile]) => {
      setEntries(allE)
      setFavorites(favs)
      setWorkouts(wkts)
      setCalorieGoal(profile?.calorie_goal ?? 0)
      setProteinGoal(Number(profile?.protein_goal ?? 0))
      setCarbsGoal(Number(profile?.carbs_goal     ?? 0))
      setFatGoal(Number(profile?.fat_goal         ?? 0))
    }).catch(e => { setError(e.message); console.error(e) })
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const t = setTimeout(() => { if (!toast) return; setToast(null) }, 3000)
    return () => clearTimeout(t)
  }, [toast])

  // ── day entries ───────────────────────────────────────────────────────────────

  useEffect(() => {
    setDayEntries(
      entries
        .filter(e => e.date === selectedDate)
        .sort((a, b) => {
          const ta = a.time ?? ''; const tb = b.time ?? ''
          if (tb !== ta) return tb.localeCompare(ta)
          return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
        })
    )
  }, [entries, selectedDate])

  // ── derived ───────────────────────────────────────────────────────────────────

  const dayMacros      = useMemo(() => sumMacros(dayEntries), [dayEntries])
  const burned         = useMemo(() => getCaloriesBurnedByDate(workouts, selectedDate), [workouts, selectedDate])
  const datesWithEntries = useMemo(() => getDatesWithEntries(entries), [entries])
  const grouped        = useMemo(() => groupByMeal(dayEntries), [dayEntries])
  const net            = dayMacros.calories - burned

  // Period stats for stats bar
  const periodFilter = useMemo(() => {
    const today = getTodayStr()
    const base  = new Date(today + 'T00:00:00')
    const from  = new Date(base.getTime() - (statPeriod === 'week' ? 6 : 29) * 86400000)
    const fromStr = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`
    return { from: fromStr, to: today }
  }, [statPeriod])

  const periodEntries   = useMemo(() => entries.filter(e => e.date >= periodFilter.from && e.date <= periodFilter.to), [entries, periodFilter])
  const periodMacros    = useMemo(() => sumMacros(periodEntries), [periodEntries])
  const uniqueDays      = useMemo(() => new Set(periodEntries.map(e => e.date)).size || 1, [periodEntries])
  const avgCalories     = Math.round(periodMacros.calories / uniqueDays)
  const avgProtein      = Math.round(periodMacros.protein  / uniqueDays)
  const avgCarbs        = Math.round(periodMacros.carbs    / uniqueDays)
  const avgFat          = Math.round(periodMacros.fat      / uniqueDays)

  // Group period entries by date (descending), within each date by meal
  const periodByDate    = useMemo(() => {
    const byDate = {}
    for (const e of periodEntries) {
      if (!byDate[e.date]) byDate[e.date] = []
      byDate[e.date].push(e)
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, es]) => ({ date, byMeal: groupByMeal(es) }))
  }, [periodEntries])

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  const addEntry = useCallback(async (fields) => {
    if (!userId) return
    const optimistic = { id: `tmp-${Date.now()}`, userId, ...fields, createdAt: new Date().toISOString() }
    setEntries(prev => [optimistic, ...prev])
    try {
      const saved = await foodEntriesRepo.create(userId, fields)
      setEntries(prev => prev.map(e => e.id === optimistic.id ? saved : e))
    } catch(e) {
      setEntries(prev => prev.filter(e => e.id !== optimistic.id))
      showToast('Не удалось добавить запись'); console.error(e)
    }
  }, [userId])

  const removeEntry = useCallback(async (id) => {
    const prev = entries
    setEntries(p => p.filter(e => e.id !== id))
    try { await foodEntriesRepo.remove(id) }
    catch(e) { setEntries(prev); showToast('Не удалось удалить запись') }
  }, [entries])

  const addFavorite = useCallback(async (entry) => {
    if (!userId) return
    const already = favorites.find(f => f.name === entry.name)
    if (already) { showToast('Уже в избранном'); return }
    const optimistic = { id: `tmp-${Date.now()}`, name: entry.name, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat }
    setFavorites(prev => [optimistic, ...prev])
    try {
      const saved = await foodFavoritesRepo.create(userId, { name: entry.name, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat })
      setFavorites(prev => prev.map(f => f.id === optimistic.id ? saved : f))
      showToast('Добавлено в избранное')
    } catch(e) {
      setFavorites(prev => prev.filter(f => f.id !== optimistic.id))
      showToast('Не удалось сохранить')
    }
  }, [userId, favorites])

  const removeFavorite = useCallback(async (id) => {
    const prev = favorites
    setFavorites(p => p.filter(f => f.id !== id))
    try { await foodFavoritesRepo.remove(id) }
    catch(e) { setFavorites(prev); showToast('Ошибка') }
  }, [favorites])

  const saveCalorieGoal = useCallback(async (val) => {
    const prev = calorieGoal; setCalorieGoal(val)
    try { await profileRepo.upsert(userId, { calorie_goal: val }) }
    catch(e) { setCalorieGoal(prev); showToast('Не удалось сохранить цель') }
  }, [userId, calorieGoal])

  const saveProteinGoal = useCallback(async (val) => {
    const prev = proteinGoal; setProteinGoal(val)
    try { await profileRepo.upsert(userId, { protein_goal: val }) }
    catch(e) { setProteinGoal(prev); showToast('Не удалось сохранить') }
  }, [userId, proteinGoal])

  const saveCarbsGoal = useCallback(async (val) => {
    const prev = carbsGoal; setCarbsGoal(val)
    try { await profileRepo.upsert(userId, { carbs_goal: val }) }
    catch(e) { setCarbsGoal(prev); showToast('Не удалось сохранить') }
  }, [userId, carbsGoal])

  const saveFatGoal = useCallback(async (val) => {
    const prev = fatGoal; setFatGoal(val)
    try { await profileRepo.upsert(userId, { fat_goal: val }) }
    catch(e) { setFatGoal(prev); showToast('Не удалось сохранить') }
  }, [userId, fatGoal])

  // ── render ────────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />

  if (error) return (
    <div className="p-8 flex flex-col items-center gap-4 py-20 text-center">
      <AlertCircle className="w-8 h-8 text-danger" />
      <p className="text-subtle">{error}</p>
      <button onClick={() => window.location.reload()} className="text-accent hover:underline text-sm">Повторить</button>
    </div>
  )

  const NUTR_COLOR = MODULE_ICONS.nutrition.color

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: NUTR_COLOR + '20' }}>
            <MODULE_ICONS.nutrition.Icon size={20} style={{ color: NUTR_COLOR }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-text">Питание</h1>
            <p className="text-subtle text-sm">
              {avgCalories > 0 ? `ср. ${avgCalories} ккал/день` : 'Ведите дневник питания'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowFavTab(false); setShowForm(v => !v) }}
          className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shrink-0 ml-3"
          style={{ backgroundColor: NUTR_COLOR }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Добавить</span>
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex bg-surface border border-border rounded-lg p-0.5">
          {[{v:'week',l:'Неделя'},{v:'month',l:'Месяц'}].map(({v,l}) => (
            <button key={v} onClick={() => setStatPeriod(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statPeriod === v ? '' : 'text-subtle hover:text-text'}`}
              style={statPeriod === v ? { backgroundColor: NUTR_COLOR + '20', color: NUTR_COLOR } : {}}
            >{l}</button>
          ))}
        </div>
        <div className="flex gap-6 flex-wrap">
          <div className="text-center">
            <div className="text-xl font-bold text-text leading-tight">{avgCalories > 0 ? avgCalories : '—'}</div>
            <div className="text-xs text-subtle">ккал/день</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-text leading-tight">{avgProtein > 0 ? avgProtein+'г' : '—'}</div>
            <div className="text-xs text-subtle">белки</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-text leading-tight">{avgCarbs > 0 ? avgCarbs+'г' : '—'}</div>
            <div className="text-xs text-subtle">углеводы</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-text leading-tight">{avgFat > 0 ? avgFat+'г' : '—'}</div>
            <div className="text-xs text-subtle">жиры</div>
          </div>
          <CalorieGoalWidget goal={calorieGoal} onSave={saveCalorieGoal} />
        </div>
      </div>

      {/* ── Today's stats card ── */}
      <div className="bg-card border border-border-2 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-subtle uppercase tracking-wider">Сегодня</span>
        </div>
        <div className="flex gap-6 items-center">
          <CalorieRing eaten={dayMacros.calories} goal={calorieGoal} burned={burned} />
          <div className="flex-1 flex flex-col gap-3">
            <MacroBars
              protein={dayMacros.protein} carbs={dayMacros.carbs} fat={dayMacros.fat}
              proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatGoal={fatGoal}
            />
            {burned > 0 && (
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <span className="text-subtle">Нетто-калории</span>
                <span className={`font-semibold ${net < 0 ? 'text-[#10b981]' : 'text-text'}`}>{roundInt(net)} ккал</span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <MacroGoalsRow
            proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatGoal={fatGoal}
            onSaveProtein={saveProteinGoal} onSaveCarbs={saveCarbsGoal} onSaveFat={saveFatGoal}
          />
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 bg-card border border-border-2 rounded-lg p-0.5 w-fit mb-4">
        <button
          onClick={() => setShowFavTab(false)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!showFavTab ? '' : 'text-subtle hover:text-text'}`}
          style={!showFavTab ? { backgroundColor: NUTR_COLOR + '20', color: NUTR_COLOR } : {}}
        >Дневник</button>
        <button
          onClick={() => setShowFavTab(true)}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showFavTab ? '' : 'text-subtle hover:text-text'}`}
          style={showFavTab ? { backgroundColor: NUTR_COLOR + '20', color: NUTR_COLOR } : {}}
        ><Star className="w-3 h-3" />Избранное</button>
      </div>

      {/* ── Content ── */}
      {showFavTab ? (
        <div className="bg-card border border-border-2 rounded-xl p-4">
          <FavoritesPanel favorites={favorites} onRemove={removeFavorite} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Add form */}
          {showForm && (
            <EntryForm
              date={selectedDate}
              favorites={favorites}
              onAdd={addEntry}
              onClose={() => setShowForm(false)}
            />
          )}

          {/* Period entries grouped by date */}
          {periodEntries.length === 0 && !showForm ? (
            <EmptyState
              modId="nutrition"
              title="Нет записей о питании"
              description="Добавьте приём пищи, чтобы следить за питанием"
              actionLabel="Добавить приём"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <div className="flex flex-col gap-5">
              {periodByDate.map(({ date, byMeal }) => (
                <div key={date}>
                  <div className="text-xs text-subtle uppercase tracking-widest mb-2 px-1">
                    {fmtDate(date)}
                  </div>
                  <div className="flex flex-col gap-3">
                    {MEAL_TYPES.map(mt => {
                      const list = byMeal[mt.id] ?? []
                      if (list.length === 0) return null
                      const mealCals = list.reduce((s, e) => s + (e.calories ?? 0), 0)
                      return (
                        <div key={mt.id} className="bg-card border border-border-2 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                            <span className="text-xs font-medium text-text flex items-center gap-1.5">
                              {mt.emoji} {mt.label}
                            </span>
                            <span className="text-[10px]" style={{ color: NUTR_COLOR }}>{roundInt(mealCals)} ккал</span>
                          </div>
                          <div className="py-1">
                            {list.map(entry => (
                              <EntryCard
                                key={entry.id}
                                entry={entry}
                                onRemove={removeEntry}
                                onFavorite={addFavorite}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
