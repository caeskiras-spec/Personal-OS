'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, LogOut, Check, AlertCircle, Loader2 } from 'lucide-react'
import ThemeSwitcher from './ThemeSwitcher'
import Select from './Select'
import { useOS } from '../../lib/store'
import { useAuth } from '../../lib/auth'
import { profileRepo } from '../../lib/db/profile'
import DatePicker from './modules/DatePicker'

// ─── helpers ──────────────────────────────────────────────────────────────────

function calcAge(birthDate) {
  if (!birthDate) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  const today = new Date()
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--
  return age >= 0 ? age : null
}

function clamp(val, min, max) {
  const n = parseFloat(val)
  if (isNaN(n)) return val
  return String(Math.min(max, Math.max(min, n)))
}

// ─── Field components ──────────────────────────────────────────────────────────

function Label({ children }) {
  return <p className="text-[10px] text-text-7 mb-1.5">{children}</p>
}

function TextInput({ value, onChange, placeholder, maxLength }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-[#6c63ff]/40 placeholder:text-text-8 transition-colors"
    />
  )
}

function NumberInput({ value, onChange, placeholder, min, max, unit }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={e => { if (e.target.value !== '') onChange(clamp(e.target.value, min, max)) }}
        placeholder={placeholder}
        min={min}
        max={max}
        className="w-full bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-[#6c63ff]/40 placeholder:text-text-8 transition-colors pr-10"
      />
      {unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-7 pointer-events-none">
          {unit}
        </span>
      )}
    </div>
  )
}

function SelectInput({ value, onChange, options }) {
  // First option with value '' acts as placeholder
  const [emptyOpt, ...rest] = options
  const hasEmpty = emptyOpt?.value === ''
  return (
    <Select
      value={value}
      onChange={onChange}
      options={hasEmpty ? rest : options}
      placeholder={hasEmpty ? emptyOpt.label : undefined}
      placeholderValue=""
    />
  )
}

// ─── ProfilePanel ──────────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: '',       label: '— не указан —' },
  { value: 'male',   label: 'Мужской' },
  { value: 'female', label: 'Женский' },
  { value: 'other',  label: 'Другой' },
]

const ACTIVITY_OPTIONS = [
  { value: '',       label: '— не указан —' },
  { value: 'low',    label: 'Низкий — сидячий образ жизни' },
  { value: 'medium', label: 'Средний — умеренная активность' },
  { value: 'high',   label: 'Высокий — регулярные тренировки' },
]

export default function ProfilePanel({ onClose }) {
  const { userId } = useOS()
  const { session, signOut } = useAuth()

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState(null)

  // form fields
  const [displayName,    setDisplayName]    = useState('')
  const [gender,         setGender]         = useState('')
  const [birthDate,      setBirthDate]      = useState('')
  const [heightCm,       setHeightCm]       = useState('')
  const [weightKg,       setWeightKg]       = useState('')
  const [activityLevel,  setActivityLevel]  = useState('')

  const age = calcAge(birthDate)

  // ── Load profile ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const p = await profileRepo.get(userId)
      if (p) {
        setDisplayName(p.display_name   || '')
        setGender(p.gender              || '')
        setBirthDate(p.birth_date       || '')
        setHeightCm(p.height_cm  != null ? String(p.height_cm)  : '')
        setWeightKg(p.weight_kg  != null ? String(p.weight_kg)  : '')
        setActivityLevel(p.activity_level || '')
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [userId])

  useEffect(() => { load() }, [load])

  // ── Save ────────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!userId) return
    // basic validation
    if (heightCm !== '' && (parseFloat(heightCm) < 50 || parseFloat(heightCm) > 300)) {
      setError('Рост должен быть от 50 до 300 см'); return
    }
    if (weightKg !== '' && (parseFloat(weightKg) < 10 || parseFloat(weightKg) > 500)) {
      setError('Вес должен быть от 10 до 500 кг'); return
    }
    setError(null); setSaving(true)
    try {
      await profileRepo.upsert(userId, {
        display_name:   displayName.trim() || null,
        gender:         gender         || null,
        birth_date:     birthDate      || null,
        height_cm:      heightCm !== '' ? parseFloat(heightCm) : null,
        weight_kg:      weightKg !== '' ? parseFloat(weightKg) : null,
        activity_level: activityLevel  || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const email = session?.user?.email || ''
  const initials = (displayName || email || 'U')[0].toUpperCase()

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed bottom-0 left-0 z-50 w-72 bg-panel border-r border-t border-border-1 rounded-tr-2xl flex flex-col max-h-[90vh] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-1 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-[#6c63ff]/20 flex items-center justify-center text-sm font-bold text-[#6c63ff] shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text truncate leading-tight">
                {displayName || 'Профиль'}
              </p>
              <p className="text-[10px] text-text-6 truncate">{email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-6 hover:text-text hover:bg-muted/10 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {loading ? (
            <div className="flex flex-col gap-3 pt-2">
              {[1,2,3,4].map(i => <div key={i} className="h-9 bg-card border border-border rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* ── Аккаунт ────────────────────────────────────────────── */}
              <section>
                <p className="text-[10px] uppercase tracking-widest text-text-8 mb-3">Аккаунт</p>
                <div className="bg-surface border border-surface-2 rounded-xl px-3 py-2.5 mb-2">
                  <p className="text-[10px] text-text-7 mb-0.5">Email</p>
                  <p className="text-sm text-text-4 truncate">{email}</p>
                </div>
                <button
                  onClick={signOut}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-danger/80 hover:text-danger border border-danger/15 hover:border-danger/35 hover:bg-danger/5 rounded-xl transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Выйти
                </button>
              </section>

              {/* ── Тема ─────────────────────────────────────────── */}
              <section>
                <p className="text-[10px] uppercase tracking-widest text-text-8 mb-3">Тема</p>
                <ThemeSwitcher compact />
              </section>

              {/* ── Профиль ─────────────────────────────────────────────── */}
              <section>
                <p className="text-[10px] uppercase tracking-widest text-text-8 mb-3">Профиль</p>
                <div className="flex flex-col gap-3.5">

                  {/* Display name */}
                  <div>
                    <Label>Имя</Label>
                    <TextInput value={displayName} onChange={setDisplayName} placeholder="Как вас называть" maxLength={60} />
                  </div>

                  {/* Gender */}
                  <div>
                    <Label>Пол</Label>
                    <SelectInput value={gender} onChange={setGender} options={GENDER_OPTIONS} />
                  </div>

                  {/* Birth date + age */}
                  <div>
                    <Label>
                      Дата рождения
                      {age !== null && (
                        <span className="ml-2 text-text-6">· {age} лет</span>
                      )}
                    </Label>
                    <DatePicker value={birthDate} onChange={setBirthDate} />
                  </div>

                  {/* Height + weight */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Рост</Label>
                      <NumberInput value={heightCm} onChange={setHeightCm} placeholder="175" min={50} max={300} unit="см" />
                    </div>
                    <div>
                      <Label>Вес</Label>
                      <NumberInput value={weightKg} onChange={setWeightKg} placeholder="70" min={10} max={500} unit="кг" />
                    </div>
                  </div>

                  {/* Activity */}
                  <div>
                    <Label>Уровень активности</Label>
                    <SelectInput value={activityLevel} onChange={setActivityLevel} options={ACTIVITY_OPTIONS} />
                  </div>

                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer: save */}
        {!loading && (
          <div className="px-5 py-4 border-t border-border-1 shrink-0">
            {error && (
              <div className="flex items-center gap-2 text-[11px] text-[#ef4444] mb-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="w-full py-2.5 text-sm font-medium rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: saved ? '#22c55e' : '#6c63ff',
              }}
            >
              {saving  ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохранение...</> :
               saved   ? <><Check className="w-4 h-4" /> Сохранено</> :
               'Сохранить профиль'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
