'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import EmptyState from '../EmptyState'
import SidePanel from '../SidePanel'
import {
  Play, Pause, RotateCcw, SkipForward,
  Settings, Bell, BellOff, Trash2, AlertCircle, Info, X,
} from 'lucide-react'
import { useOS }               from '../../../lib/store'
import { MODULE_ICONS }        from '../../../lib/moduleIcons'
import { focusSessionsRepo }   from '../../../lib/db/focusSessions'
import { profileRepo }         from '../../../lib/db/profile'
import { tasksRepo }           from '../../../lib/db/tasks'
import { projectsRepo }        from '../../../lib/db/projects'
import { getSessionsToday, getSessionsThisWeek, sumMinutes } from '../../../lib/focus-selectors'
import Select from '../Select'

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'focus_timer_v1'

const PHASE_META = {
  focus:      { label: 'ФОКУС',            color: '#6c63ff', settingKey: 'workMin' },
  break:      { label: 'ПЕРЕРЫВ',          color: '#22c55e', settingKey: 'breakMin' },
  long_break: { label: 'ДЛИННЫЙ ПЕРЕРЫВ',  color: '#3b82f6', settingKey: 'longBreakMin' },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function localStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtTime(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[880, 1100, 1320].forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      const t = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.start(t); osc.stop(t + 0.25)
    })
  } catch { /* no audio */ }
}

function sendBrowserNotif(title, body) {
  if (typeof window === 'undefined') return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try { new Notification(title, { body, silent: true }) } catch { /* noop */ }
}

// ─── PomodoroHint ──────────────────────────────────────────────────────────────

function PomodoroHint() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Что такое Помодоро?"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="flex items-center justify-center w-4 h-4 rounded-full text-text-7 hover:text-text-4 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-6 z-50 w-72 max-w-[calc(100vw-2rem)] bg-surface border border-border-2 rounded-xl p-3.5 shadow-xl text-xs text-text-3 leading-relaxed animate-fade-in"
        >
          <p className="font-semibold text-text mb-1.5">Техника Помодоро</p>
          Работа фокус-интервалами (по умолчанию 25&nbsp;мин), затем короткий перерыв (5&nbsp;мин).
          После 4&nbsp;интервалов — длинный перерыв (15–30&nbsp;мин).
          Помогает сохранять концентрацию и&nbsp;избегать выгорания.
        </div>
      )}
    </div>
  )
}

// ─── Ring ──────────────────────────────────────────────────────────────────────

function Ring({ progress, color, size = 240, strokeW = 10, children }) {
  const r    = (size - strokeW * 2) / 2
  const circ = 2 * Math.PI * r
  const off  = circ * (1 - Math.max(0, Math.min(1, progress)))
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" style={{ overflow: 'visible' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={strokeW} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.4s ease' }}
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center">{children}</div>
    </div>
  )
}

// ─── SessionRow ────────────────────────────────────────────────────────────────

function SessionRow({ session, tasks, projects, onDelete }) {
  const [confirm, setConfirm] = useState(false)
  const meta    = PHASE_META[session.type] ?? PHASE_META.focus
  const task    = tasks.find(t => t.id === session.task_id)
  const project = projects.find(p => p.id === session.project_id)
  const time    = new Date(session.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border-2 group hover:border-border-hover transition-all">
      <div className="w-1 h-8 rounded-full shrink-0" style={{ background: meta.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-[11px] text-text-7">{session.duration_minutes} мин</span>
        </div>
        {(task || project) && (
          <p className="text-[11px] text-text-6 mt-0.5 truncate">
            {project && <span style={{ color: project.color ?? '#666' }}>{project.name}</span>}
            {project && task && ' / '}
            {task && task.title}
          </p>
        )}
      </div>
      <span className="text-[11px] text-text-7 shrink-0">{time}</span>
      <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
        {confirm ? (
          <>
            <button onClick={() => setConfirm(false)} className="text-xs text-subtle px-2 py-1 rounded hover:bg-muted/10 transition-colors">Нет</button>
            <button onClick={() => onDelete(session.id)} className="text-xs text-[#ef4444] px-2 py-1 rounded hover:bg-red-500/10 transition-colors">Удалить</button>
          </>
        ) : (
          <button onClick={() => setConfirm(true)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 text-subtle hover:text-[#ef4444] transition-all"
          ><Trash2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
    </div>
  )
}

// ─── NumInput ──────────────────────────────────────────────────────────────────

function NumInput({ label, value, min, max, onChange }) {
  return (
    <div>
      <label className="text-xs text-subtle block mb-1">{label}</label>
      <input
        type="number" min={min} max={max} value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
        className="w-full bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-[#6c63ff]/40 transition-colors"
      />
    </div>
  )
}

// ─── SettingsContent ───────────────────────────────────────────────────────────

function SettingsContent({ settings, saveSettings, savingConf }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Фокус (мин)"         value={settings.workMin}          min={1}  max={120} onChange={v => saveSettings({ ...settings, workMin: v })} />
        <NumInput label="Перерыв (мин)"        value={settings.breakMin}         min={1}  max={60}  onChange={v => saveSettings({ ...settings, breakMin: v })} />
        <NumInput label="Длинный пер. (мин)"   value={settings.longBreakMin}     min={1}  max={90}  onChange={v => saveSettings({ ...settings, longBreakMin: v })} />
        <NumInput label="Циклов до длинного"   value={settings.cyclesBeforeLong} min={1}  max={10}  onChange={v => saveSettings({ ...settings, cyclesBeforeLong: v })} />
        <NumInput label="Цель дня (мин)"       value={settings.goalMin}          min={0}  max={480} onChange={v => saveSettings({ ...settings, goalMin: v })} />
      </div>
      <p className="text-xs text-text-7 leading-relaxed">
        Настройки сохраняются автоматически. Текущий запущенный таймер не прерывается.
      </p>
      {savingConf && <p className="text-xs text-text-7 animate-pulse">Сохраняется...</p>}
    </div>
  )
}

// ─── FocusModule ───────────────────────────────────────────────────────────────

export default function FocusModule() {
  const { userId } = useOS()

  // ── Remote data ──────────────────────────────────────────────────────────────
  const [sessions,     setSessions]     = useState([])
  const [tasks,        setTasks]        = useState([])
  const [projects,     setProjects]     = useState([])
  const [loadingData,  setLoadingData]  = useState(true)
  const [errorData,    setErrorData]    = useState(null)
  const [settings, setSettings] = useState({
    workMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4, goalMin: 0,
  })

  // ── Timer state (persisted to localStorage) ──────────────────────────────────
  const [phase,        setPhase]        = useState('focus')
  const [cycleCount,   setCycleCount]   = useState(0)
  const [timerStatus,  setTimerStatus]  = useState('idle') // idle | running | paused
  const [elapsed,      setElapsed]      = useState(0)      // seconds elapsed before startedAt
  const [startedAt,    setStartedAt]    = useState(null)   // Date.now() when last started
  const [taskId,       setTaskId]       = useState(null)
  const [projectId,    setProjectId]    = useState(null)
  const [tick,         setTick]         = useState(0)      // forces remaining recompute

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [soundOn,      setSoundOn]      = useState(() => {
    try { return localStorage.getItem('focus_sound') !== 'off' } catch { return true }
  })
  const [notifOn,      setNotifOn]      = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [statsView,    setStatsView]    = useState('day')
  const [savingConf,   setSavingConf]   = useState(false)

  const intervalRef    = useRef(null)
  const completingRef  = useRef(false) // guard against double-complete

  // Always-fresh ref for completion handler to read latest state without stale closure
  const stateRef = useRef({})
  stateRef.current = { phase, settings, soundOn, notifOn, userId, taskId, projectId, cycleCount }

  // ── Duration for current phase ───────────────────────────────────────────────
  const duration = useMemo(() => {
    const min = settings[PHASE_META[phase].settingKey] ?? 25
    return min * 60
  }, [phase, settings])

  // ── Remaining ────────────────────────────────────────────────────────────────
  const remaining = useMemo(() => {
    if (timerStatus === 'running' && startedAt) {
      return Math.max(0, duration - elapsed - Math.floor((Date.now() - startedAt) / 1000))
    }
    return Math.max(0, duration - elapsed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStatus, startedAt, elapsed, duration, tick])

  // ── Load data + restore timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    ;(async () => {
      setLoadingData(true); setErrorData(null)
      try {
        const [s, t, p, prof] = await Promise.all([
          focusSessionsRepo.list(userId),
          tasksRepo.list(userId),
          projectsRepo.list(userId),
          profileRepo.get(userId),
        ])
        setSessions(s); setTasks(t); setProjects(p)
        if (prof) {
          setSettings({
            workMin:          prof.focus_work_minutes       ?? 25,
            breakMin:         prof.focus_break_minutes      ?? 5,
            longBreakMin:     prof.focus_long_break_minutes ?? 15,
            cyclesBeforeLong: prof.focus_cycles_before_long ?? 4,
            goalMin:          prof.focus_goal_minutes       ?? 0,
          })
        }
      } catch (err) {
        setErrorData(err.message || 'Ошибка загрузки')
      } finally {
        setLoadingData(false)
      }
    })()

    // Restore timer from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved) {
        setPhase(saved.phase || 'focus')
        setCycleCount(saved.cycleCount || 0)
        setTimerStatus(saved.timerStatus || 'idle')
        setElapsed(saved.elapsed || 0)
        setStartedAt(saved.startedAt || null)
        setTaskId(saved.taskId || null)
        setProjectId(saved.projectId || null)
      }
    } catch { /* corrupt storage */ }
  }, [userId])

  // ── Persist timer to localStorage ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      phase, cycleCount, timerStatus, elapsed, startedAt, taskId, projectId,
    }))
  }, [userId, phase, cycleCount, timerStatus, elapsed, startedAt, taskId, projectId])

  // ── Interval ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(intervalRef.current)
    if (timerStatus !== 'running') return
    intervalRef.current = setInterval(() => setTick(n => n + 1), 500)
    return () => clearInterval(intervalRef.current)
  }, [timerStatus, startedAt])

  // ── Complete handler (reads stateRef to avoid stale closures) ─────────────────
  const handleComplete = useCallback(() => {
    clearInterval(intervalRef.current)
    const { phase: p, settings: cfg, soundOn: snd, notifOn: ntf, userId: uid, taskId: tid, projectId: pid, cycleCount: cc } = stateRef.current

    if (snd) playBeep()
    const meta = PHASE_META[p]
    if (ntf) sendBrowserNotif(
      p === 'focus' ? '✅ Фокус завершён!' : '☕ Перерыв завершён!',
      p === 'focus' ? `${cfg[meta.settingKey]} мин сконцентрированной работы` : 'Пора возвращаться к работе'
    )

    if (p === 'focus' && uid) {
      const dur = cfg[meta.settingKey]
      const row = { date: localStr(), type: 'focus', duration_minutes: dur, task_id: tid, project_id: pid, completed: true }
      const opt = { id: `tmp-${Date.now()}`, ...row, created_at: new Date().toISOString(), user_id: uid }
      setSessions(prev => [opt, ...prev])
      focusSessionsRepo.create(uid, row)
        .then(saved => setSessions(prev => prev.map(s => s.id === opt.id ? saved : s)))
        .catch(()   => setSessions(prev => prev.filter(s => s.id !== opt.id)))
    }

    const newCC = p === 'focus' ? cc + 1 : cc
    const nextPhase = p === 'focus'
      ? (newCC % cfg.cyclesBeforeLong === 0 ? 'long_break' : 'break')
      : 'focus'

    setCycleCount(newCC)
    setPhase(nextPhase)
    setTimerStatus('idle')
    setElapsed(0)
    setStartedAt(null)
    completingRef.current = false
  }, []) // intentionally empty — reads stateRef

  // ── Watch remaining → auto-complete ──────────────────────────────────────────
  const handleCompleteRef = useRef(handleComplete)
  handleCompleteRef.current = handleComplete

  useEffect(() => {
    if (timerStatus !== 'running' || remaining > 0 || completingRef.current) return
    completingRef.current = true
    handleCompleteRef.current()
  }, [remaining, timerStatus])

  // ── Controls ──────────────────────────────────────────────────────────────────
  const handleStart = () => {
    if (notifOn && typeof window !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then(p => p !== 'granted' && setNotifOn(false))
    }
    setStartedAt(Date.now())
    setTimerStatus('running')
    completingRef.current = false
  }

  const handlePause = () => {
    clearInterval(intervalRef.current)
    const add = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0
    setElapsed(e => e + add)
    setStartedAt(null)
    setTimerStatus('paused')
  }

  const handleReset = () => {
    clearInterval(intervalRef.current)
    completingRef.current = false
    setTimerStatus('idle')
    setElapsed(0)
    setStartedAt(null)
  }

  const handleSkip = () => {
    clearInterval(intervalRef.current)
    completingRef.current = false
    const newCC = phase === 'focus' ? cycleCount + 1 : cycleCount
    const nextPhase = phase === 'focus'
      ? (newCC % settings.cyclesBeforeLong === 0 ? 'long_break' : 'break')
      : 'focus'
    setCycleCount(newCC)
    setPhase(nextPhase)
    setTimerStatus('idle')
    setElapsed(0)
    setStartedAt(null)
  }

  // ── Save settings to profile ──────────────────────────────────────────────────
  const saveSettings = useCallback(async (next) => {
    setSettings(next)
    if (timerStatus === 'idle') setElapsed(0)
    setSavingConf(true)
    try {
      await profileRepo.upsert(userId, {
        focus_work_minutes:       next.workMin,
        focus_break_minutes:      next.breakMin,
        focus_long_break_minutes: next.longBreakMin,
        focus_cycles_before_long: next.cyclesBeforeLong,
        focus_goal_minutes:       next.goalMin,
      })
    } catch { /* silent */ } finally {
      setSavingConf(false)
    }
  }, [userId, timerStatus])

  // ── Delete session ────────────────────────────────────────────────────────────
  const deleteSession = useCallback(async id => {
    const snap = sessions
    setSessions(p => p.filter(s => s.id !== id))
    try { await focusSessionsRepo.remove(id) }
    catch { setSessions(snap) }
  }, [sessions])

  // ── Sound toggle (persisted to localStorage) ──────────────────────────────────
  const handleSoundToggle = () => {
    const next = !soundOn
    setSoundOn(next)
    try { localStorage.setItem('focus_sound', next ? 'on' : 'off') } catch { /* noop */ }
  }

  // ── Notification toggle ───────────────────────────────────────────────────────
  const handleNotifToggle = async () => {
    if (notifOn) { setNotifOn(false); return }
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifOn(perm === 'granted')
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const todaySessions = useMemo(() => getSessionsToday(sessions),    [sessions])
  const weekSessions  = useMemo(() => getSessionsThisWeek(sessions), [sessions])
  const todayMin      = sumMinutes(todaySessions)
  const weekMin       = sumMinutes(weekSessions)
  const goalProgress  = settings.goalMin > 0 ? Math.min(1, todayMin / settings.goalMin) : 0

  const meta           = PHASE_META[phase]
  const ringProgress   = remaining / duration
  const activeTasks    = tasks.filter(t => !t.done)

  // ── Loading / Error ───────────────────────────────────────────────────────────
  if (loadingData) return (
    <div className="p-4 sm:p-8 flex flex-col gap-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-card border border-border-2 rounded-xl animate-pulse" />)}
    </div>
  )

  if (errorData) return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-8 h-8 text-[#ef4444] mx-auto mb-3" />
        <p className="text-subtle text-sm mb-3">{errorData}</p>
      </div>
    </div>
  )

  return (
    <div className="md:flex md:h-full md:overflow-hidden">

      {/* ── Left: Timer ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-1 md:overflow-y-auto px-4 sm:px-8 py-6 sm:py-8 gap-6 min-w-0">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: MODULE_ICONS.focus.color + '20' }}>
            <MODULE_ICONS.focus.Icon size={20} style={{ color: MODULE_ICONS.focus.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-text leading-tight">Фокус</h1>
            <div className="flex items-center gap-1.5">
              <p className="text-subtle text-sm">Техника Помодоро</p>
              <PomodoroHint />
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleSoundToggle}
              title={soundOn ? 'Звук вкл — нажмите чтобы выкл' : 'Звук выкл — нажмите чтобы вкл'}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${
                soundOn
                  ? 'border-[#6c63ff]/40 text-[#6c63ff] bg-[#6c63ff]/5'
                  : 'border-border text-text-7 hover:border-border-2 hover:text-subtle'
              }`}
            >
              {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            <button
              onClick={handleNotifToggle}
              title="Браузерные уведомления по окончании интервала"
              className={`h-9 px-2.5 flex items-center rounded-xl border text-xs font-medium transition-colors ${
                notifOn
                  ? 'border-[#f59e0b]/40 text-[#f59e0b] bg-[#f59e0b]/5'
                  : 'border-border text-text-7 hover:border-border-2 hover:text-subtle'
              }`}
            >
              {notifOn ? 'Увед. ✓' : 'Увед.'}
            </button>
            <button
              onClick={() => setShowSettings(v => !v)}
              title="Настройки таймера"
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${
                showSettings
                  ? 'border-muted text-text bg-muted/10'
                  : 'border-border text-subtle hover:border-border-2 hover:text-text'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cycle dots + callout */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-7">Цикл {Math.floor(cycleCount / settings.cyclesBeforeLong) + 1}</span>
            <div className="flex gap-1.5">
              {Array.from({ length: settings.cyclesBeforeLong }).map((_, i) => (
                <div key={i}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{ background: i < (cycleCount % settings.cyclesBeforeLong) ? meta.color : '#2a2a2a' }}
                />
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted leading-relaxed max-w-sm">
            Один цикл: Работа&nbsp;{settings.workMin}&nbsp;мин → Отдых&nbsp;{settings.breakMin}&nbsp;мин, повторить&nbsp;{settings.cyclesBeforeLong}&nbsp;раза → большой отдых&nbsp;{settings.longBreakMin}&nbsp;мин. Затем цикл начинается заново.
          </p>
        </div>

        {/* Ring timer */}
        <div className="flex justify-center">
          <Ring progress={ringProgress} color={meta.color} size={240} strokeW={10}>
            <span
              className="text-5xl font-mono font-bold tracking-tight tabular-nums"
              style={{ color: meta.color }}
            >
              {fmtTime(remaining)}
            </span>
            <span className="text-[11px] font-semibold tracking-widest mt-1.5"
              style={{ color: meta.color + 'aa' }}
            >
              {phase === 'focus'
                ? `РАБОТА ${(cycleCount % settings.cyclesBeforeLong) + 1}/${settings.cyclesBeforeLong}`
                : phase === 'break'
                  ? `ОТДЫХ ${cycleCount % settings.cyclesBeforeLong}/${settings.cyclesBeforeLong}`
                  : 'БОЛЬШОЙ ОТДЫХ'
              }
            </span>
          </Ring>
        </div>

        {/* Phase badges */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { key: 'focus',      label: 'Работа',       min: settings.workMin },
            { key: 'break',      label: 'Отдых',        min: settings.breakMin },
            { key: 'long_break', label: 'Большой отдых', min: settings.longBreakMin },
          ].map(({ key, label, min }) => {
            const active = phase === key
            const c = PHASE_META[key].color
            return (
              <span
                key={key}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={active
                  ? { background: c + '22', color: c, border: `1px solid ${c}55` }
                  : { background: 'transparent', color: '#444', border: '1px solid #222' }
                }
              >
                {label}
                <span className="font-semibold" style={active ? { color: c } : { color: '#555' }}>
                  {min}&nbsp;мин
                </span>
              </span>
            )
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={handleReset} title="Сброс"
            className="p-3 rounded-xl border border-border text-subtle hover:text-text hover:border-border-2 transition-colors"
          ><RotateCcw className="w-5 h-5" /></button>

          {timerStatus === 'running' ? (
            <button onClick={handlePause}
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-semibold transition-all active:scale-95 hover:opacity-90"
              style={{ background: meta.color }}
            ><Pause className="w-6 h-6" /></button>
          ) : (
            <button onClick={handleStart}
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-semibold transition-all active:scale-95 hover:opacity-90"
              style={{ background: meta.color }}
            ><Play className="w-6 h-6 ml-0.5" /></button>
          )}

          <button onClick={handleSkip} title="Пропустить"
            className="p-3 rounded-xl border border-border text-subtle hover:text-text hover:border-border-2 transition-colors"
          ><SkipForward className="w-5 h-5" /></button>
        </div>

        {/* Task / Project pickers */}
        <div className="flex flex-col gap-2.5 max-w-sm">
          {projects.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-7 w-16 shrink-0">Проект</span>
              <Select
                value={projectId || ''}
                onChange={v => setProjectId(v || null)}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder="— не выбрано —"
                placeholderValue=""
                className="flex-1"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-7 w-16 shrink-0">Задача</span>
            <Select
              value={taskId || ''}
              onChange={v => setTaskId(v || null)}
              options={activeTasks.map(t => ({ value: t.id, label: t.title }))}
              placeholder="— не выбрано —"
              placeholderValue=""
              className="flex-1"
            />
          </div>
        </div>

      </div>

      {/* ── Mobile: settings full-screen overlay ─────────────────────────────── */}
      {showSettings && (
        <SidePanel panelClass="md:hidden" onClose={() => setShowSettings(false)}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <span className="text-sm font-semibold text-text">Настройки таймера</span>
            <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg text-text-6 hover:text-text hover:bg-muted/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <SettingsContent settings={settings} saveSettings={saveSettings} savingConf={savingConf} />
        </SidePanel>
      )}

      {/* ── Right: Settings (desktop) OR Stats + History ─────────────────────── */}
      <div className="flex flex-col md:w-72 md:shrink-0 border-t md:border-t-0 md:border-l border-surface md:overflow-hidden">
        {showSettings ? (
          /* Desktop: settings panel replaces stats */
          <>
            <div className="hidden md:flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <span className="text-sm font-semibold text-text">Настройки таймера</span>
            </div>
            <div className="hidden md:block">
              <SettingsContent settings={settings} saveSettings={saveSettings} savingConf={savingConf} />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-5">

            {settings.goalMin > 0 && (
              <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
                <Ring progress={goalProgress} color="#22c55e" size={70} strokeW={7}>
                  <span className="text-xs font-bold text-[#22c55e]">{Math.round(goalProgress * 100)}%</span>
                </Ring>
                <div>
                  <p className="text-xs text-subtle mb-0.5">Цель дня</p>
                  <p className="text-sm font-semibold text-text">{todayMin} / {settings.goalMin} мин</p>
                  <p className="text-xs text-text-7">{todaySessions.length} сессий</p>
                </div>
              </div>
            )}

            <div className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-text">Статистика</span>
                <div className="flex bg-bg-2 rounded-lg overflow-hidden border border-surface-2">
                  {(['day','week']).map(v => (
                    <button key={v} onClick={() => setStatsView(v)}
                      className={`px-3 py-1 text-xs transition-all ${statsView === v ? 'bg-muted text-text' : 'text-text-6 hover:text-text'}`}
                    >{v === 'day' ? 'День' : 'Неделя'}</button>
                  ))}
                </div>
              </div>
              {(() => {
                const list = statsView === 'day' ? todaySessions : weekSessions
                const min  = statsView === 'day' ? todayMin       : weekMin
                return (
                  <div className="flex gap-6">
                    <div>
                      <p className="text-2xl font-bold" style={{ color: meta.color }}>{list.length}</p>
                      <p className="text-xs text-text-6">сессий</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold" style={{ color: meta.color }}>{min}</p>
                      <p className="text-xs text-text-6">минут</p>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div>
              <p className="text-[10px] text-muted uppercase tracking-widest mb-2 px-1">История сессий</p>
              {sessions.length === 0 ? (
                <EmptyState
                  modId="focus"
                  title="Сессий пока нет"
                  description="Запустите таймер выше, чтобы начать первую сессию фокуса"
                  compact
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {sessions.map(s => (
                    <SessionRow key={s.id} session={s} tasks={tasks} projects={projects} onDelete={deleteSession} />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
