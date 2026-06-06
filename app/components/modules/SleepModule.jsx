'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import EmptyState from '../EmptyState'
import {
  Plus, X, AlertCircle, ChevronLeft, ChevronRight, Star, Watch, Trash2,
} from 'lucide-react'
import { useOS }       from '../../../lib/store'
import { MODULE_ICONS } from '../../../lib/moduleIcons'
import { sleepRepo }   from '../../../lib/db/sleep'
import { profileRepo } from '../../../lib/db/profile'
import { getTodayStr } from '../../../lib/tasks-selectors'
import DatePicker from './DatePicker'
import {
  calcDuration, fmtDuration, getAverages, SLEEP_COLOR,
} from '../../../lib/sleep-selectors'

// ─── constants ────────────────────────────────────────────────────────────────

const MONTHS_RU   = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtDate(s) {
  return new Date(s + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}
function round1(n) { return Math.round((n ?? 0) * 10) / 10 }

function sortSleep(arr) {
  return [...arr].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date)
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  })
}

// ─── watch stub ───────────────────────────────────────────────────────────────
async function connectWatch() { return { status: 'in_development' } }

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

// ─── Quality Stars ────────────────────────────────────────────────────────────
function QualityStars({ value, onChange, readonly = false }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange && onChange(value === n ? null : n)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <Star
            className="w-4 h-4"
            fill={n <= (value ?? 0) ? SLEEP_COLOR : 'transparent'}
            style={{ color: n <= (value ?? 0) ? SLEEP_COLOR : '#444' }}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Sleep Ring ───────────────────────────────────────────────────────────────
function SleepRing({ minutes, goalMinutes }) {
  const ratio = goalMinutes > 0 ? Math.min(minutes / goalMinutes, 1) : 0
  const r     = 36
  const circ  = 2 * Math.PI * r
  const dash  = circ * ratio
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#2a2a2a" strokeWidth="8" />
          <circle cx="48" cy="48" r={r} fill="none" stroke={SLEEP_COLOR} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }} />
        </svg>
        <div className="flex flex-col items-center z-10">
          <span className="text-base font-bold text-text leading-none">{fmtDuration(minutes)}</span>
          <span className="text-[9px] text-subtle mt-0.5">сна</span>
        </div>
      </div>
      {goalMinutes > 0 && (
        <span className="text-[10px] text-subtle">
          {fmtDuration(minutes)} / {fmtDuration(goalMinutes)}
        </span>
      )}
    </div>
  )
}

// ─── Sleep Heatmap ────────────────────────────────────────────────────────────
// ─── Sleep Calendar (left panel) ──────────────────────────────────────────────
function SleepCalendar({ datesWithEntries, selectedDate, onSelectDate }) {
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
          const ds = localStr(date)
          const isToday    = ds === today
          const isSelected = ds === selectedDate
          const hasEntry   = datesWithEntries.has(ds)
          return (
            <button key={ds} type="button" onClick={() => onSelectDate(ds)}
              className={`h-8 w-full flex flex-col items-center justify-center rounded-lg transition-colors
                ${isToday ? 'bg-[#3b82f6]/10' : ''}
                ${isSelected ? 'ring-1 ring-[#3b82f6]/60' : ''}
                hover:bg-muted/30 cursor-pointer`}
            >
              <span className={`text-[10px] font-medium leading-none ${isToday ? 'text-[#3b82f6]' : 'text-subtle'}`}>
                {date.getDate()}
              </span>
              {hasEntry && <span className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: SLEEP_COLOR }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Sleep Goal Widget ────────────────────────────────────────────────────────
function SleepGoalWidget({ goalMinutes, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(String(Math.round((goalMinutes || 480) / 60)))
  useEffect(() => { setVal(String(Math.round((goalMinutes || 480) / 60))) }, [goalMinutes])
  const save = () => { onSave(Math.round((parseFloat(val) || 8) * 60)); setEditing(false) }
  if (editing) return (
    <div className="flex items-center gap-2">
      <input autoFocus type="number" min="1" max="24" step="0.5" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="w-16 bg-bg border border-[#3b82f6]/50 rounded-lg px-2 py-1 text-sm text-text outline-none"
      />
      <span className="text-xs text-subtle">ч</span>
      <button onClick={save} className="text-xs transition-colors" style={{ color: SLEEP_COLOR }}>Сохранить</button>
      <button onClick={() => setEditing(false)} className="text-xs text-subtle hover:text-text transition-colors">✕</button>
    </div>
  )
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-subtle">Цель:</span>
      <button onClick={() => setEditing(true)} className="font-medium text-text hover:opacity-80 transition-opacity" style={{ color: SLEEP_COLOR }}>
        {fmtDuration(goalMinutes || 480)}
      </button>
    </div>
  )
}

// ─── Sleep Entry Form ─────────────────────────────────────────────────────────
const EMPTY_FORM = { date: '', bedtime: '23:00', wakeTime: '07:00', quality: null, notes: '' }

function SleepForm({ selectedDate, onAdd, onClose }) {
  const [f, setF] = useState({ ...EMPTY_FORM, date: selectedDate })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const duration = calcDuration(f.bedtime, f.wakeTime)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!f.date) return
    onAdd({ date: f.date, bedtime: f.bedtime || null, wakeTime: f.wakeTime || null, durationMinutes: duration, quality: f.quality, notes: f.notes })
    onClose()
  }

  return (
    <div className="bg-card border border-border-2 rounded-xl p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text">Новая запись</span>
        <button onClick={onClose} className="text-subtle hover:text-text transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Date */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-subtle w-16 shrink-0">Дата подъёма</span>
          <DatePicker value={f.date} onChange={v => set('date', v || getTodayStr())} noOverdue />
        </div>

        {/* Bedtime / Wake */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-subtle w-16 shrink-0">Лёг</span>
          <input type="time" value={f.bedtime} onChange={e => set('bedtime', e.target.value)}
            className="bg-bg border border-border-2 rounded-lg px-2 py-1.5 text-xs text-text outline-none focus:border-[#3b82f6]/50 transition-colors"
          />
          <span className="text-xs text-subtle">→</span>
          <span className="text-xs text-subtle w-16 shrink-0">Встал</span>
          <input type="time" value={f.wakeTime} onChange={e => set('wakeTime', e.target.value)}
            className="bg-bg border border-border-2 rounded-lg px-2 py-1.5 text-xs text-text outline-none focus:border-[#3b82f6]/50 transition-colors"
          />
        </div>

        {/* Duration preview */}
        {duration > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#3b82f6]/10 rounded-lg">
            <span className="text-xs text-subtle">Длительность:</span>
            <span className="text-sm font-semibold" style={{ color: SLEEP_COLOR }}>{fmtDuration(duration)}</span>
          </div>
        )}

        {/* Quality */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-subtle w-16 shrink-0">Качество</span>
          <QualityStars value={f.quality} onChange={v => set('quality', v)} />
        </div>

        {/* Notes */}
        <textarea value={f.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Заметки (необязательно)" rows={2}
          className="w-full bg-bg border border-border-2 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-[#3b82f6]/50 transition-colors resize-none placeholder:text-subtle"
        />

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={!f.date}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
            style={{ backgroundColor: SLEEP_COLOR + '30', color: SLEEP_COLOR }}
          >
            Сохранить
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-subtle hover:text-text text-sm transition-colors">
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Sleep Entry Card ─────────────────────────────────────────────────────────
function SleepCard({ entry, onRemove, onUpdate }) {
  const [expanded,   setExpanded]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [ef, setEf] = useState(null)

  const startEdit = () => {
    setEf({ date: entry.date, bedtime: entry.bedtime || '', wakeTime: entry.wakeTime || '', quality: entry.quality, notes: entry.notes || '' })
    setEditing(true)
  }
  const saveEdit = (e) => {
    e.preventDefault()
    const dur = calcDuration(ef.bedtime, ef.wakeTime)
    onUpdate(entry.id, { date: ef.date, bedtime: ef.bedtime || null, wakeTime: ef.wakeTime || null, durationMinutes: dur, quality: ef.quality, notes: ef.notes })
    setEditing(false)
  }
  const setEfField = (k, v) => setEf(p => ({ ...p, [k]: v }))

  return (
    <div className="bg-card border border-border-2 rounded-xl overflow-hidden transition-all hover:border-border-hover">
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => { if (!editing) setExpanded(e => !e) }}
      >
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text">{fmtDate(entry.date)}</span>
            {entry.durationMinutes > 0 && (
              <span className="text-sm font-semibold" style={{ color: SLEEP_COLOR }}>{fmtDuration(entry.durationMinutes)}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {entry.bedtime && entry.wakeTime && (
              <span className="text-[10px] text-subtle">{entry.bedtime} → {entry.wakeTime}</span>
            )}
            {entry.quality && <QualityStars value={entry.quality} readonly />}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {confirmDel ? (
            <div className="flex items-center gap-1 text-xs">
              <button onClick={() => onRemove(entry.id)} className="text-danger font-medium px-1">Да</button>
              <button onClick={() => setConfirmDel(false)} className="text-subtle px-1">Нет</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="p-1 text-subtle hover:text-danger transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded: edit form or read-only detail */}
      {expanded && !editing && (
        <div className="px-4 pb-3 border-t border-border pt-3 animate-slide-up">
          {entry.notes && <p className="text-xs text-subtle mb-2">{entry.notes}</p>}
          <button onClick={startEdit} className="text-xs transition-colors hover:opacity-80" style={{ color: SLEEP_COLOR }}>
            Редактировать
          </button>
        </div>
      )}
      {expanded && editing && ef && (
        <form onSubmit={saveEdit} className="px-4 pb-3 border-t border-border pt-3 flex flex-col gap-2 animate-slide-up">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-subtle">Лёг</span>
            <input type="time" value={ef.bedtime} onChange={e => setEfField('bedtime', e.target.value)}
              className="bg-bg border border-border-2 rounded px-2 py-1 text-xs text-text outline-none focus:border-[#3b82f6]/50"
            />
            <span className="text-[10px] text-subtle">Встал</span>
            <input type="time" value={ef.wakeTime} onChange={e => setEfField('wakeTime', e.target.value)}
              className="bg-bg border border-border-2 rounded px-2 py-1 text-xs text-text outline-none focus:border-[#3b82f6]/50"
            />
            {calcDuration(ef.bedtime, ef.wakeTime) > 0 && (
              <span className="text-xs font-semibold" style={{ color: SLEEP_COLOR }}>{fmtDuration(calcDuration(ef.bedtime, ef.wakeTime))}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-subtle w-16">Качество</span>
            <QualityStars value={ef.quality} onChange={v => setEfField('quality', v)} />
          </div>
          <textarea value={ef.notes} onChange={e => setEfField('notes', e.target.value)} rows={2} placeholder="Заметки"
            className="w-full bg-bg border border-border-2 rounded-lg px-2 py-1.5 text-xs text-text outline-none resize-none placeholder:text-subtle focus:border-[#3b82f6]/50"
          />
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 text-xs rounded-lg transition-colors" style={{ backgroundColor: SLEEP_COLOR + '25', color: SLEEP_COLOR }}>Сохранить</button>
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-subtle hover:text-text transition-colors">Отмена</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-8">
      <div className="w-[220px] shrink-0 h-64 bg-card border border-border-2 rounded-xl animate-pulse" />
      <div className="flex-1 flex flex-col gap-4">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-card border border-border-2 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )
}

// ─── SleepModule (main) ───────────────────────────────────────────────────────
export default function SleepModule() {
  const { userId } = useOS()

  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [toast,       setToast]       = useState(null)
  const [entries,     setEntries]     = useState([])
  const [goalMinutes, setGoalMinutes] = useState(480)
  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [showForm,    setShowForm]    = useState(false)
  const [statPeriod,  setStatPeriod]  = useState('week')

  const showToast = (msg) => setToast(msg)

  useEffect(() => {
    if (!userId) return
    Promise.all([sleepRepo.list(userId), profileRepo.get(userId)])
      .then(([list, profile]) => {
        setEntries(list)
        setGoalMinutes(profile?.sleep_goal_minutes ?? 480)
      })
      .catch(e => { setError(e.message); console.error(e) })
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // ── derived ────────────────────────────────────────────────────────────────
  const dayEntries       = useMemo(() => entries.filter(e => e.date === selectedDate), [entries, selectedDate])
  const datesWithEntries = useMemo(() => new Set(entries.map(e => e.date)), [entries])
  const avgs             = useMemo(() => getAverages(entries, statPeriod), [entries, statPeriod])
  const todayEntry     = dayEntries[0] ?? null

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const addEntry = useCallback(async (fields) => {
    if (!userId) return
    const optimistic = { id: `tmp-${Date.now()}`, userId, ...fields, createdAt: new Date().toISOString() }
    setEntries(prev => sortSleep([optimistic, ...prev]))
    try {
      const saved = await sleepRepo.create(userId, fields)
      setEntries(prev => prev.map(e => e.id === optimistic.id ? saved : e))
    } catch(e) {
      setEntries(prev => prev.filter(e => e.id !== optimistic.id))
      showToast('Не удалось добавить запись'); console.error(e)
    }
  }, [userId])

  const removeEntry = useCallback(async (id) => {
    const prev = entries
    setEntries(p => p.filter(e => e.id !== id))
    try { await sleepRepo.remove(id) }
    catch(e) { setEntries(prev); showToast('Не удалось удалить') }
  }, [entries])

  const updateEntry = useCallback(async (id, fields) => {
    const original = entries.find(e => e.id === id)
    setEntries(prev => sortSleep(prev.map(e => e.id === id ? { ...e, ...fields } : e)))
    try { await sleepRepo.update(id, fields) }
    catch(e) { setEntries(prev => prev.map(e => e.id === id ? original : e)); showToast('Не удалось обновить') }
  }, [entries])

  const saveGoal = useCallback(async (val) => {
    const prev = goalMinutes; setGoalMinutes(val)
    try { await profileRepo.upsert(userId, { sleep_goal_minutes: val }) }
    catch(e) { setGoalMinutes(prev); showToast('Не удалось сохранить цель') }
  }, [userId, goalMinutes])

  const handleWatch = async () => {
    const res = await connectWatch()
    if (res.status === 'in_development') showToast('⌚ Подключение к часам — функция в разработке')
  }

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />
  if (error)   return (
    <div className="p-8 flex flex-col items-center gap-4 py-20 text-center">
      <AlertCircle className="w-8 h-8 text-danger" />
      <p className="text-subtle">{error}</p>
      <button onClick={() => window.location.reload()} className="text-accent hover:underline text-sm">Повторить</button>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: MODULE_ICONS.sleep.color + '20' }}>
            <MODULE_ICONS.sleep.Icon size={20} style={{ color: MODULE_ICONS.sleep.color }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-text">Сон</h1>
            <p className="text-subtle text-sm">
              {avgs.count > 0
                ? `${avgs.count} записей · ср. ${fmtDuration(avgs.avgMinutes)}`
                : 'Ведите дневник сна'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-light text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shrink-0 ml-3"
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
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statPeriod === v ? 'text-[#3b82f6]' : 'text-subtle hover:text-text'}`}
              style={statPeriod === v ? { backgroundColor: SLEEP_COLOR + '20' } : {}}
            >{l}</button>
          ))}
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-xl font-bold text-text leading-tight">
              {avgs.avgMinutes > 0 ? fmtDuration(avgs.avgMinutes) : '—'}
            </div>
            <div className="text-xs text-subtle">средняя длит.</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-text leading-tight">
              {avgs.avgQuality ? round1(avgs.avgQuality) + '/5' : '—'}
            </div>
            <div className="text-xs text-subtle">качество</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-text leading-tight">{avgs.count}</div>
            <div className="text-xs text-subtle">записей</div>
          </div>
          <SleepGoalWidget goalMinutes={goalMinutes} onSave={saveGoal} />
        </div>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="mb-4">
          <SleepForm
            selectedDate={getTodayStr()}
            onAdd={addEntry}
            onClose={() => setShowForm(false)}
          />
        </div>
      )}

      {/* ── Entries list ── */}
      {entries.length === 0 && !showForm ? (
        <EmptyState
          modId="sleep"
          title="Записей о сне пока нет"
          description="Ведите дневник сна, чтобы отслеживать режим и качество отдыха"
          actionLabel="Добавить запись"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {entries
            .filter(e => e.date >= avgs.from && e.date <= avgs.to)
            .slice(0, 30)
            .map(entry => (
              <SleepCard
                key={entry.id}
                entry={entry}
                onRemove={removeEntry}
                onUpdate={updateEntry}
              />
            ))}
        </div>
      )}
    </div>
  )
}
