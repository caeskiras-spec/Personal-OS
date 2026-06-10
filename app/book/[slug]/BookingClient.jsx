'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Check, Loader2, AlertCircle, Calendar, Clock, User } from 'lucide-react'

// ─── date helpers (no external lib) ──────────────────────────────────────────

// Human-readable labels — must stay in sync with TIMEZONE_OPTIONS in CalendarModule.jsx
const TIMEZONE_LABELS = {
  'Europe/Moscow':      'Москва (UTC+3)',
  'Europe/London':      'Лондон (UTC+0/+1)',
  'Europe/Berlin':      'Берлин (UTC+1/+2)',
  'America/New_York':   'Нью-Йорк (UTC-5/-4)',
  'America/Los_Angeles':'Лос-Анджелес (UTC-8/-7)',
  'Asia/Dubai':         'Дубай (UTC+4)',
  'Asia/Almaty':        'Алматы (UTC+5)',
  'Asia/Tashkent':      'Ташкент (UTC+5)',
  'UTC':                'UTC',
}

const MONTHS_RU   = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MONTHS_RU_G = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
const WEEKDAYS_S  = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function pad2(n) { return String(n).padStart(2, '0') }

function toDateStr(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`
}

function getMonthCells(year, month) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const lastDay  = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= lastDay; d++) cells.push(new Date(year, month, d))
  return cells
}

/** Format a UTC ISO string for display in a given IANA timezone */
function formatSlotTime(isoStr, tz) {
  try {
    return new Date(isoStr).toLocaleTimeString('ru-RU', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch {
    return new Date(isoStr).toLocaleTimeString('ru-RU', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  }
}

/** Get user's local IANA timezone safely */
function getLocalTZ() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone }
  catch { return 'UTC' }
}

// ─── Mini calendar for date picking ──────────────────────────────────────────

function BookingCalendar({ viewing, setViewing, selectedDate, onSelectDate, availableDates }) {
  const { year, month } = viewing
  const cells   = getMonthCells(year, month)
  const todayStr = toDateStr(new Date())

  const prev = () => setViewing(v => {
    const m = v.month === 0 ? 11 : v.month - 1
    const y = v.month === 0 ? v.year - 1 : v.year
    return { year: y, month: m }
  })
  const next = () => setViewing(v => {
    const m = v.month === 11 ? 0 : v.month + 1
    const y = v.month === 11 ? v.year + 1 : v.year
    return { year: y, month: m }
  })

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 w-full max-w-sm mx-auto">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-2 text-subtle hover:text-text transition-colors rounded-lg hover:bg-muted/20">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-text select-none">
          {MONTHS_RU[month]} {year}
        </span>
        <button onClick={next} className="p-2 text-subtle hover:text-text transition-colors rounded-lg hover:bg-muted/20">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS_S.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-subtle py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />
          const ds = toDateStr(date)
          const isPast    = ds < todayStr
          const isSelected = ds === selectedDate
          return (
            <button
              key={ds}
              disabled={isPast}
              onClick={() => !isPast && onSelectDate(ds)}
              className={`h-9 w-full rounded-lg text-xs font-medium transition-all select-none ${
                isSelected
                  ? 'bg-accent text-white'
                  : isPast
                  ? 'text-subtle/30 cursor-not-allowed'
                  : ds === todayStr
                  ? 'border border-accent/60 text-accent hover:bg-accent/15'
                  : 'text-text hover:bg-muted/30'
              }`}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── BookingClient ────────────────────────────────────────────────────────────

export default function BookingClient({ slug, initialMeta }) {
  const localTZ = getLocalTZ()

  // Link meta — starts from server-provided value (may be null if server failed)
  const [linkMeta,    setLinkMeta]    = useState(initialMeta)
  // null = probing, true = not found / inactive, false = found OK
  const [notFound,    setNotFound]    = useState(
    initialMeta?.is_active === false ? true : null
  )
  const [probeError,  setProbeError]  = useState(null)  // server-error message (5xx)

  // Calendar state
  const today    = new Date()
  const [viewing, setViewing]         = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [selectedDate, setSelectedDate] = useState(null)

  // Slots state
  const [slots,        setSlots]        = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError,   setSlotsError]   = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)

  // Form state
  const [showForm,   setShowForm]   = useState(false)
  const [guestName,  setGuestName]  = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestTG,    setGuestTG]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitErr,  setSubmitErr]  = useState(null)
  const [confirmed,  setConfirmed]  = useState(null)

  // Probe the API to verify the link exists.
  // Runs on mount AND can be re-triggered by the retry button on server errors.
  const probe = useCallback(() => {
    setProbeError(null)
    let cancelled = false
    fetch(`/api/book/${encodeURIComponent(slug)}`)
      .then(async res => {
        if (cancelled) return
        if (res.status === 404) { setNotFound(true); return }
        if (!res.ok) {
          // 5xx — server error, not "link not found"
          setProbeError('Ошибка сервера — попробуйте ещё раз')
          setNotFound(false)  // stay on probe=null screen with retry
          return
        }
        const json = await res.json()
        setLinkMeta(json.link ?? null)
        setNotFound(false)
      })
      .catch(() => {
        if (!cancelled) {
          setProbeError('Ошибка соединения — проверьте интернет и попробуйте снова')
          setNotFound(false)
        }
      })
    return () => { cancelled = true }
  }, [slug])

  // On mount: if server didn't provide metadata, probe the API
  useEffect(() => {
    // Server already told us it's inactive → already notFound
    if (notFound === true) return
    // Server provided valid metadata → mark as found
    if (initialMeta && initialMeta.is_active !== false) {
      setNotFound(false)
      return
    }
    // Server returned null (failed silently) → probe via API
    return probe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load slots when date selected
  const loadSlots = useCallback(async (dateStr) => {
    setSlotsLoading(true)
    setSlotsError(null)
    setSlots([])
    setSelectedSlot(null)
    setShowForm(false)
    try {
      const res  = await fetch(`/api/book/${encodeURIComponent(slug)}?date=${dateStr}`)
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 404) { setNotFound(true); return }
        setSlotsError(json.error ?? 'Ошибка загрузки')
        return
      }
      setSlots(json.slots ?? [])
      if (json.link) setLinkMeta(json.link)
    } catch {
      setSlotsError('Ошибка соединения — попробуйте снова')
    } finally {
      setSlotsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (selectedDate) loadSlots(selectedDate)
  }, [selectedDate, loadSlots])

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot)
    setShowForm(true)
    setSubmitErr(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!guestName.trim()) { setSubmitErr('Укажите ваше имя'); return }
    if (!selectedSlot)     { setSubmitErr('Выберите время');   return }
    setSubmitting(true)
    setSubmitErr(null)
    try {
      const res  = await fetch(`/api/book/${encodeURIComponent(slug)}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          date:          selectedDate,
          startISO:      selectedSlot.startISO,
          endISO:        selectedSlot.endISO,
          guestName:     guestName.trim(),
          guestPhone:    guestPhone.trim() || undefined,
          guestTelegram: guestTG.trim()    || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setSubmitErr(json.error ?? 'Слот уже занят')
          // Refresh slots for this date
          if (selectedDate) loadSlots(selectedDate)
          setSelectedSlot(null)
          setShowForm(false)
          return
        }
        setSubmitErr(json.error ?? 'Ошибка записи')
        return
      }
      setConfirmed(json.meeting)
    } catch {
      setSubmitErr('Ошибка соединения — попробуйте ещё раз')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Probing (initialMeta was null, waiting for API probe) ──
  if (notFound === null) {
    return (
      <BookingLayout>
        {probeError ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-warning" />
            </div>
            <p className="text-sm text-subtle max-w-xs">{probeError}</p>
            <button
              onClick={probe}
              className="px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-xl transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-20 text-subtle text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Загружаем страницу записи…
          </div>
        )}
      </BookingLayout>
    )
  }

  // ── Not found ──
  if (notFound === true) {
    return (
      <BookingLayout>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-danger" />
          </div>
          <h1 className="text-xl font-bold text-text">Ссылка не найдена</h1>
          <p className="text-subtle text-sm max-w-xs">
            Эта ссылка для записи недоступна или была деактивирована.
          </p>
        </div>
      </BookingLayout>
    )
  }

  // ── Confirmed ──
  if (confirmed) {
    const displayTZ = localTZ
    const startFmt  = new Date(confirmed.start_at).toLocaleString('ru-RU', {
      timeZone: displayTZ, weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const endTime = new Date(confirmed.end_at).toLocaleTimeString('ru-RU', {
      timeZone: displayTZ, hour: '2-digit', minute: '2-digit', hour12: false,
    })
    return (
      <BookingLayout title={linkMeta?.title}>
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center justify-center">
            <Check className="w-8 h-8 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text mb-1">Запись подтверждена!</h2>
            <p className="text-subtle text-sm">Ждём вас, {confirmed.guest_name}</p>
          </div>
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-4 text-left flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-text capitalize">{startFmt}</p>
                <p className="text-xs text-subtle">— {endTime} · {displayTZ}</p>
              </div>
            </div>
            {linkMeta?.title && (
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-accent shrink-0" />
                <p className="text-sm text-text">{linkMeta.title}</p>
              </div>
            )}
          </div>
          <p className="text-xs text-subtle max-w-xs leading-relaxed">
            Запись создана. Свяжитесь с организатором, если нужно изменить время.
          </p>
        </div>
      </BookingLayout>
    )
  }

  // ── Main booking UI ──
  const displayTZ    = linkMeta?.timezone ?? localTZ
  const durationMin  = linkMeta?.duration_minutes ?? 30

  return (
    <BookingLayout title={linkMeta?.title}>
      {/* Step 1: Pick a date */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text">Выберите дату</h2>
        </div>
        <BookingCalendar
          viewing={viewing}
          setViewing={setViewing}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </section>

      {/* Step 2: Pick a slot */}
      {selectedDate && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text">
              Доступное время
              <span className="ml-2 text-subtle font-normal text-xs">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </span>
            </h2>
          </div>

          {slotsLoading && (
            <div className="flex items-center gap-2 py-6 justify-center text-subtle text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загружаем расписание…
            </div>
          )}

          {slotsError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {slotsError}
            </div>
          )}

          {!slotsLoading && !slotsError && slots.length === 0 && (
            <div className="py-6 text-center text-subtle text-sm">
              В этот день нет свободного времени — выберите другую дату
            </div>
          )}

          {!slotsLoading && slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map(slot => {
                const startFmt = formatSlotTime(slot.startISO, displayTZ)
                const endFmt   = formatSlotTime(slot.endISO,   displayTZ)
                const isSelected = selectedSlot?.startISO === slot.startISO
                return (
                  <button
                    key={slot.startISO}
                    onClick={() => handleSlotClick(slot)}
                    className={`flex flex-col items-center py-2.5 px-2 rounded-xl border text-xs font-medium transition-all min-h-[52px] ${
                      isSelected
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border bg-surface hover:border-accent/50 hover:bg-accent/5 text-text'
                    }`}
                  >
                    <span className="font-semibold">{startFmt}</span>
                    <span className="text-[10px] opacity-60 mt-0.5">{durationMin} мин</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Timezone hint */}
          {slots.length > 0 && (
            <p className="text-[11px] text-subtle mt-2 text-center">
              Время указано по: {TIMEZONE_LABELS[displayTZ] ?? displayTZ}
            </p>
          )}
        </section>
      )}

      {/* Step 3: Form */}
      {showForm && selectedSlot && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text">Ваши контакты</h2>
          </div>

          {/* Selected slot summary */}
          <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/30 rounded-xl mb-4 text-sm">
            <Clock className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-accent font-medium">
              {formatSlotTime(selectedSlot.startISO, displayTZ)} – {formatSlotTime(selectedSlot.endISO, displayTZ)}
            </span>
            <button
              onClick={() => { setSelectedSlot(null); setShowForm(false) }}
              className="ml-auto text-xs text-subtle hover:text-text transition-colors"
            >
              Изменить
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Name */}
            <div>
              <label className="block text-xs text-subtle mb-1">
                Имя <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder="Ваше имя"
                required
                maxLength={80}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text outline-none focus:border-accent transition-colors placeholder:text-subtle"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs text-subtle mb-1">Телефон</label>
              <input
                type="tel"
                value={guestPhone}
                onChange={e => setGuestPhone(e.target.value)}
                placeholder="+7 900 000-00-00"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text outline-none focus:border-accent transition-colors placeholder:text-subtle"
              />
            </div>

            {/* Telegram */}
            <div>
              <label className="block text-xs text-subtle mb-1">Telegram</label>
              <input
                type="text"
                value={guestTG}
                onChange={e => setGuestTG(e.target.value)}
                placeholder="@username"
                maxLength={64}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text outline-none focus:border-accent transition-colors placeholder:text-subtle"
              />
            </div>

            {submitErr && (
              <div className="flex items-center gap-2 px-4 py-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {submitErr}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !guestName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-sm mt-1"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Подтверждаем…</>
                : 'Подтвердить запись'}
            </button>
          </form>
        </section>
      )}
    </BookingLayout>
  )
}

// ─── Minimal standalone layout for the public booking page ───────────────────

function BookingLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Simple header — no app nav */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
            P
          </div>
          <span className="text-sm font-semibold text-text truncate">
            {title ?? 'Запись на встречу'}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-safe">
        {children}
      </main>

      <footer className="text-center py-4 text-[11px] text-subtle border-t border-border">
        Powered by Personal OS
      </footer>
    </div>
  )
}
