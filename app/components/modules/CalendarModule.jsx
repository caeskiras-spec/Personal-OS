'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, X, Plus, Copy, Check, Loader2, Link2, Users, Calendar, Settings, Trash2 } from 'lucide-react'
import Select from '../Select'
import { useRouter } from 'next/navigation'
import { useOS }                from '../../../lib/store'
import { MODULE_ICONS }         from '../../../lib/moduleIcons'
import { tasksRepo }            from '../../../lib/db/tasks'
import { habitsRepo }           from '../../../lib/db/habits'
import { habitCompletionsRepo } from '../../../lib/db/habitCompletions'
import { workoutsRepo }         from '../../../lib/db/workouts'
import { foodEntriesRepo }      from '../../../lib/db/foodEntries'
import { sleepRepo }            from '../../../lib/db/sleep'
import { transactionsRepo }     from '../../../lib/db/transactions'
import { meetingsRepo }         from '../../../lib/db/meetings'
import { bookingLinksRepo }     from '../../../lib/db/bookingLinks'
import { availabilityRepo }     from '../../../lib/db/availability'
import { getTodayStr }          from '../../../lib/tasks-selectors'
import {
  normalizeTaskEvents,
  normalizeHabitEvents,
  normalizeWorkoutEvents,
  normalizeFoodEvents,
  normalizeSleepEvents,
  normalizeFinanceEvents,
  normalizeMeetingEvents,
  buildDayMap,
  MEETING_COLOR,
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
  { key: 'meetings',  label: 'Встречи',    color: MEETING_COLOR },
]

const TYPE_LABEL = { task: 'Задачи', habit: 'Привычки', workout: 'Тренировки', nutrition: 'Питание', sleep: 'Сон', finance: 'Финансы', meeting: 'Встречи' }
const TYPE_COLOR = { task: '#6c63ff', habit: '#8b85ff', workout: '#22c55e', nutrition: '#10b981', sleep: '#3b82f6', finance: '#f59e0b', meeting: MEETING_COLOR }
const TYPE_ORDER = ['task', 'habit', 'workout', 'nutrition', 'sleep', 'finance', 'meeting']

// ─── Weekday names for availability editor ────────────────────────────────────
const WEEKDAY_NAMES = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const WEEKDAY_FULL  = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']
const DURATION_OPTIONS = [15,30,45,60,90,120]
const BUFFER_OPTIONS   = [0,5,10,15,30]
// 30-minute steps for the whole day: 00:00 … 23:30
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return { value: `${h}:${m}`, label: `${h}:${m}` }
})
const TIMEZONE_OPTIONS = [
  { value: 'Europe/Moscow',     label: 'Москва (UTC+3)' },
  { value: 'Europe/London',     label: 'Лондон (UTC+0/+1)' },
  { value: 'Europe/Berlin',     label: 'Берлин (UTC+1/+2)' },
  { value: 'America/New_York',  label: 'Нью-Йорк (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8/-7)' },
  { value: 'Asia/Dubai',        label: 'Дубай (UTC+4)' },
  { value: 'Asia/Almaty',       label: 'Алматы (UTC+5)' },
  { value: 'Asia/Tashkent',     label: 'Ташкент (UTC+5)' },
  { value: 'UTC',               label: 'UTC' },
]

function generateSlug() {
  return Math.random().toString(36).substring(2, 10)
}

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

// ─── MeetingsTab ──────────────────────────────────────────────────────────────

function MeetingsTab({ userId, meetings, setMeetings, showToast }) {
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [formErr,   setFormErr]   = useState(null)

  // Manual meeting form state
  const [mName,  setMName]  = useState('')
  const [mPhone, setMPhone] = useState('')
  const [mTG,    setMTG]    = useState('')
  const [mDate,  setMDate]  = useState(getTodayStr())
  const [mTime,  setMTime]  = useState('10:00')
  const [mDur,   setMDur]   = useState(30)

  const now = new Date()
  const upcoming = meetings.filter(m => m.status !== 'cancelled' && new Date(m.start_at) >= now)
    .sort((a,b) => new Date(a.start_at) - new Date(b.start_at))
  const past = meetings.filter(m => m.status !== 'cancelled' && new Date(m.start_at) < now)
    .sort((a,b) => new Date(b.start_at) - new Date(a.start_at))

  const cancelMeeting = async (id) => {
    const prev = meetings
    setMeetings(p => p.map(m => m.id === id ? { ...m, status: 'cancelled' } : m))
    try { await meetingsRepo.cancel(id) }
    catch { setMeetings(prev); showToast('Не удалось отменить встречу') }
  }

  const createMeeting = async (e) => {
    e.preventDefault()
    if (!mName.trim()) { setFormErr('Укажите имя'); return }
    setSaving(true); setFormErr(null)
    try {
      const [h, m] = mTime.split(':').map(Number)
      const startAt = new Date(`${mDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
      const endAt   = new Date(startAt.getTime() + mDur * 60000)
      const created = await meetingsRepo.create(userId, {
        guest_name:    mName.trim(),
        guest_phone:   mPhone.trim() || null,
        guest_telegram: mTG.trim()  || null,
        start_at:      startAt.toISOString(),
        end_at:        endAt.toISOString(),
        status:        'confirmed',
      })
      setMeetings(prev => [created, ...prev])
      setShowForm(false); setMName(''); setMPhone(''); setMTG('')
    } catch(err) {
      setFormErr(err?.message?.includes('overlap') ? 'На это время уже есть встреча' : (err?.message ?? 'Ошибка сохранения'))
    } finally { setSaving(false) }
  }

  const fmtMeeting = (m) => {
    const d = new Date(m.start_at)
    return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-text">Встречи</h2>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-light text-white rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Создать вручную
        </button>
      </div>

      {showForm && (
        <form onSubmit={createMeeting} className="bg-surface border border-border rounded-xl p-4 mb-5 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">Новая встреча</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-subtle mb-1">Имя гостя *</label>
              <input value={mName} onChange={e => setMName(e.target.value)} placeholder="Имя"
                className="w-full bg-bg border border-border-2 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-subtle mb-1">Телефон</label>
              <input value={mPhone} onChange={e => setMPhone(e.target.value)} placeholder="+7 …"
                className="w-full bg-bg border border-border-2 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-subtle mb-1">Telegram</label>
            <input value={mTG} onChange={e => setMTG(e.target.value)} placeholder="@username"
              className="w-full bg-bg border border-border-2 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-subtle mb-1">Дата</label>
              <input type="date" value={mDate} onChange={e => setMDate(e.target.value)}
                className="w-full bg-bg border border-border-2 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-subtle mb-1">Время</label>
              <Select
                value={mTime}
                onChange={v => setMTime(v)}
                options={TIME_OPTIONS}
                placeholder="Время"
                compact
              />
            </div>
            <div>
              <label className="block text-xs text-subtle mb-1">Длительность</label>
              <Select
                value={mDur}
                onChange={v => setMDur(Number(v))}
                options={[15,30,45,60,90,120].map(d => ({ value: d, label: `${d} мин` }))}
                compact
              />
            </div>
          </div>
          {formErr && <p className="text-xs text-danger">{formErr}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-light disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Создать
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-2 text-xs text-subtle hover:text-text transition-colors">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-5">
          <p className="text-xs uppercase tracking-wider text-subtle mb-2">Предстоящие</p>
          <div className="flex flex-col gap-2">
            {upcoming.map(m => <MeetingCard key={m.id} meeting={m} onCancel={cancelMeeting} fmtTime={fmtMeeting} />)}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-subtle mb-2">Прошедшие</p>
          <div className="flex flex-col gap-2 opacity-60">
            {past.slice(0, 10).map(m => <MeetingCard key={m.id} meeting={m} onCancel={cancelMeeting} fmtTime={fmtMeeting} past />)}
          </div>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && !showForm && (
        <div className="py-12 text-center">
          <p className="text-subtle text-sm">Встреч пока нет</p>
          <p className="text-subtle text-xs mt-1">Настройте ссылку записи, чтобы принимать заявки</p>
        </div>
      )}
    </div>
  )
}

function MeetingCard({ meeting: m, onCancel, fmtTime, past }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: MEETING_COLOR }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{m.guest_name}</p>
        <p className="text-xs text-subtle">{fmtTime(m)}</p>
        {m.guest_telegram && <p className="text-[10px] text-subtle">{m.guest_telegram}</p>}
      </div>
      {!past && (
        confirm ? (
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => onCancel(m.id)} className="text-danger font-medium px-1">Да</button>
            <button onClick={() => setConfirm(false)} className="text-subtle px-1">Нет</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="text-xs text-subtle hover:text-danger transition-colors">
            Отменить
          </button>
        )
      )}
    </div>
  )
}

// ─── BookingLinkTab ───────────────────────────────────────────────────────────

function BookingLinkTab({ userId, showToast }) {
  const [link,       setLink]       = useState(null)
  const [rules,      setRules]      = useState([])   // [{ weekday, start_time, end_time, enabled }]
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  // Form state
  const [title,    setTitle]    = useState('Запись на встречу')
  const [duration, setDuration] = useState(30)
  const [buffer,   setBuffer]   = useState(0)
  const [tz,       setTz]       = useState('Europe/Moscow')
  const [isActive, setIsActive] = useState(true)

  // Build the default 5-day work schedule
  function defaultRules() {
    return WEEKDAY_NAMES.map((_, i) => ({
      weekday:    i,
      enabled:    i < 5, // Mon-Fri
      start_time: '10:00',
      end_time:   '18:00',
    }))
  }

  useEffect(() => {
    if (!userId) return
    Promise.all([bookingLinksRepo.getFirst(userId)])
      .then(async ([bl]) => {
        if (bl) {
          setLink(bl)
          setTitle(bl.title)
          setDuration(bl.duration_minutes)
          setBuffer(bl.buffer_minutes ?? 0)
          setTz(bl.timezone)
          setIsActive(bl.is_active)
          const avail = await availabilityRepo.listByLink(userId, bl.id)
          if (avail.length > 0) {
            // Merge DB rules with defaults
            const merged = WEEKDAY_NAMES.map((_, i) => {
              const db = avail.find(r => r.weekday === i)
              return db
                ? { weekday: i, enabled: true, start_time: db.start_time.substring(0,5), end_time: db.end_time.substring(0,5) }
                : { weekday: i, enabled: false, start_time: '10:00', end_time: '18:00' }
            })
            setRules(merged)
          } else {
            setRules(defaultRules())
          }
        } else {
          setRules(defaultRules())
        }
      })
      .catch(() => showToast('Ошибка загрузки настроек'))
      .finally(() => setLoading(false))
  }, [userId])

  const updateRule = (i, field, value) => {
    setRules(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  const saveLink = async () => {
    setSaving(true); setSaved(false)
    try {
      const fields = { title, duration_minutes: duration, buffer_minutes: buffer, timezone: tz, is_active: isActive }

      let bl = link
      if (!bl) {
        bl = await bookingLinksRepo.create(userId, { ...fields, slug: generateSlug() })
        setLink(bl)
      } else {
        bl = await bookingLinksRepo.update(bl.id, fields)
        setLink(bl)
      }

      const enabledRules = rules.filter(r => r.enabled).map(r => ({
        weekday:    r.weekday,
        start_time: r.start_time + ':00',
        end_time:   r.end_time   + ':00',
      }))
      await availabilityRepo.replaceForLink(userId, bl.id, enabledRules)

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch(e) {
      showToast(e?.message ?? 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const publicURL = link ? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${link.slug}` : null

  const copyLink = async () => {
    if (!publicURL) return
    try { await navigator.clipboard.writeText(publicURL); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { showToast('Не удалось скопировать') }
  }

  const deleteLink = async () => {
    if (!link) return
    setDeleting(true)
    try {
      await bookingLinksRepo.remove(link.id)
      // Reset to "no link" state — meetings are preserved (link_id → null via ON DELETE SET NULL)
      setLink(null)
      setTitle('Запись на встречу')
      setDuration(30)
      setBuffer(0)
      setTz('Europe/Moscow')
      setIsActive(true)
      setRules(defaultRules())
      setConfirmDel(false)
    } catch(e) {
      showToast(e?.message ?? 'Не удалось удалить ссылку')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col gap-3 max-w-lg">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-surface border border-border rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <h2 className="text-base font-semibold text-text">Ссылка для записи</h2>

        {link && (
          <div className="flex items-center gap-2 ml-auto">
            {/* Active toggle */}
            {!confirmDel && (
              <button onClick={() => setIsActive(a => !a)}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                  isActive ? 'border-success/40 bg-success/10 text-success' : 'border-border text-subtle'
                }`}
              >
                {isActive ? 'Активна' : 'Отключена'}
              </button>
            )}

            {/* Delete confirmation inline */}
            {confirmDel ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-danger/8 border border-danger/30 rounded-lg">
                <span className="text-xs text-subtle whitespace-nowrap">Удалить ссылку?</span>
                <span className="text-xs text-subtle/40">·</span>
                <span className="text-[10px] text-subtle/60">Встречи сохранятся</span>
                <button
                  onClick={deleteLink}
                  disabled={deleting}
                  className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors disabled:opacity-40 ml-1"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Да'}
                </button>
                <button
                  onClick={() => setConfirmDel(false)}
                  disabled={deleting}
                  className="text-xs text-subtle hover:text-text transition-colors"
                >
                  Нет
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                className="flex items-center gap-1 text-xs text-subtle hover:text-danger transition-colors px-2 py-1 rounded-lg hover:bg-danger/8"
                title="Удалить ссылку"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Удалить</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Public link */}
      {publicURL && (
        <div className="flex items-center gap-2 mb-5 px-3 py-2.5 bg-surface border border-border rounded-xl">
          <Link2 className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="flex-1 text-xs text-text-6 truncate">{publicURL}</span>
          <button onClick={copyLink}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-light transition-colors shrink-0">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Title */}
        <div>
          <label className="block text-xs text-subtle mb-1.5">Название ссылки</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
            placeholder="Запись на встречу"
            className="w-full bg-surface border border-border-2 rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-accent transition-colors" />
        </div>

        {/* Duration + Buffer */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-subtle mb-1.5">Длительность слота</label>
            <Select
              value={duration}
              onChange={v => setDuration(Number(v))}
              options={DURATION_OPTIONS.map(d => ({ value: d, label: `${d} мин` }))}
            />
          </div>
          <div>
            <label className="block text-xs text-subtle mb-1.5">Буфер между слотами</label>
            <Select
              value={buffer}
              onChange={v => setBuffer(Number(v))}
              options={BUFFER_OPTIONS.map(b => ({ value: b, label: b === 0 ? 'Без буфера' : `${b} мин` }))}
            />
          </div>
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-xs text-subtle mb-1.5">Часовой пояс</label>
          <Select
            value={tz}
            onChange={setTz}
            options={TIMEZONE_OPTIONS}
          />
        </div>

        {/* Weekly availability */}
        <div>
          <label className="block text-xs text-subtle mb-2">Доступность по дням</label>
          <div className="flex flex-col gap-1.5">
            {rules.map((rule, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors ${
                rule.enabled ? 'bg-surface border-border' : 'bg-bg border-transparent opacity-50'
              }`}>
                {/* Day toggle */}
                <button
                  type="button"
                  onClick={() => updateRule(i, 'enabled', !rule.enabled)}
                  className={`w-8 h-5 rounded-full transition-colors shrink-0 relative ${rule.enabled ? 'bg-accent' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${rule.enabled ? 'left-3.5' : 'left-0.5'}`} />
                </button>
                <span className="text-xs font-medium text-text w-5 shrink-0">{WEEKDAY_NAMES[i]}</span>
                {rule.enabled && (
                  <>
                    <Select
                      value={rule.start_time}
                      onChange={v => updateRule(i, 'start_time', v)}
                      options={TIME_OPTIONS.filter(o => !rule.end_time || o.value < rule.end_time)}
                      placeholder="Начало"
                      compact
                    />
                    <span className="text-xs text-subtle">—</span>
                    <Select
                      value={rule.end_time}
                      onChange={v => updateRule(i, 'end_time', v)}
                      options={TIME_OPTIONS.filter(o => !rule.start_time || o.value > rule.start_time)}
                      placeholder="Конец"
                      compact
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <button onClick={saveLink} disabled={saving}
          className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40 ${
            saved ? 'bg-success hover:bg-success' : 'bg-accent hover:bg-accent-light'
          }`}>
          {saving  ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохраняем…</> :
           saved   ? <><Check className="w-4 h-4" /> Сохранено</> :
           link ? 'Сохранить изменения' : 'Создать ссылку'}
        </button>
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
  const [meetings,      setMeetings]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState(null)

  // ── ui state ──
  const [tab,     setTab]     = useState('calendar') // 'calendar' | 'meetings' | 'booking'
  const [view,    setView]    = useState('month')
  const [current, setCurrent] = useState(() => new Date())
  const [layers,  setLayers]  = useState({ tasks: true, habits: true, workouts: true, nutrition: true, sleep: true, finance: true, meetings: true })

  const today = getTodayStr()

  // ── load all sources in parallel ─────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return
    async function load() {
      try {
        const [taskList, habitList, workoutList, foodList, sleepList, txList, meetingList] = await Promise.all([
          tasksRepo.list(userId),
          habitsRepo.list(userId),
          workoutsRepo.list(userId),
          foodEntriesRepo.listAll(userId),
          sleepRepo.list(userId),
          transactionsRepo.list(userId),
          meetingsRepo.list(userId).catch(() => []),
        ])
        setTasks(taskList)
        setHabits(habitList)
        setWorkouts(workoutList)
        setFoodEntries(foodList)
        setSleepEntries(sleepList)
        setTransactions(txList)
        setMeetings(meetingList)

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
      ...(layers.meetings  ? normalizeMeetingEvents(meetings)           : []),
    ]
    return buildDayMap(events)
  }, [tasks, habits, completions, workouts, foodEntries, sleepEntries, transactions, meetings, layers])

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
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: MODULE_ICONS.calendar.color + '20' }}>
          <MODULE_ICONS.calendar.Icon size={20} style={{ color: MODULE_ICONS.calendar.color }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Календарь</h1>
          <p className="text-subtle text-sm">Задачи · Привычки · Встречи</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {[
          { key: 'calendar', label: 'Календарь' },
          { key: 'meetings', label: 'Встречи' },
          { key: 'booking',  label: 'Ссылка записи' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-accent text-accent'
                : 'border-transparent text-subtle hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Calendar */}
      {tab === 'calendar' && (
        <>
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
        </>
      )}

      {/* Tab: Meetings */}
      {tab === 'meetings' && (
        <MeetingsTab
          userId={userId}
          meetings={meetings}
          setMeetings={setMeetings}
          showToast={showToast}
        />
      )}

      {/* Tab: Booking link settings */}
      {tab === 'booking' && (
        <BookingLinkTab
          userId={userId}
          showToast={showToast}
        />
      )}
    </div>
  )
}
