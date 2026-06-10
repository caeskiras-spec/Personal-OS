'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, Loader2, Sun, Moon, Monitor } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { isNetworkError } from '../../lib/net'
import { useOS }   from '../../lib/store'
import { useTheme } from '../../lib/theme'
import { ALL_MODULES, MODULE_CATEGORIES } from '../../lib/modules'
import { MODULE_ICONS } from '../../lib/moduleIcons'
import { profileRepo }     from '../../lib/db/profile'
import { userModulesRepo } from '../../lib/db/userModules'
import Select     from './Select'
import DatePicker from './modules/DatePicker'

// ─── constants ────────────────────────────────────────────────────────────────

const DEFAULT_MODULES = ['tasks', 'habits', 'goals', 'calendar', 'focus']
const TOTAL_STEPS     = 5  // 0=welcome 1=modules 2=profile 3=theme 4=done

const GENDER_OPTIONS = [
  { value: 'male',   label: 'Мужской' },
  { value: 'female', label: 'Женский'  },
  { value: 'other',  label: 'Другой'   },
]

const ACTIVITY_OPTIONS = [
  { value: 'low',    label: 'Низкая — сидячая работа, мало движения'   },
  { value: 'medium', label: 'Средняя — прогулки, лёгкие нагрузки'      },
  { value: 'high',   label: 'Высокая — спорт 3–5 раз в неделю и чаще' },
]

const THEMES = [
  { value: 'dark',   label: 'Тёмная',    icon: Moon    },
  { value: 'light',  label: 'Светлая',   icon: Sun     },
  { value: 'system', label: 'Системная', icon: Monitor },
]

// ─── shared sub-components ────────────────────────────────────────────────────

function ProgressBar({ step }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className="h-1 rounded-full flex-1 transition-all duration-300"
          style={{ background: i <= step ? 'var(--color-accent)' : 'var(--color-border-1)' }}
        />
      ))}
    </div>
  )
}

function StepHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-text">{title}</h2>
      {subtitle && <p className="text-text-7 text-sm mt-1 leading-relaxed">{subtitle}</p>}
    </div>
  )
}

function NavButtons({ onBack, onNext, nextLabel = 'Далее', nextDisabled = false, onSkip, saving }) {
  return (
    <div className="flex gap-2 mt-8 items-center">
      {onBack && (
        <button onClick={onBack} disabled={saving}
          className="flex items-center gap-1 px-3.5 py-2.5 rounded-xl border border-border-2 text-text-7 text-sm font-medium hover:border-border-hover hover:text-text transition-all disabled:opacity-40 shrink-0">
          <ChevronLeft className="w-4 h-4" />Назад
        </button>
      )}
      {onSkip && (
        <button onClick={onSkip} disabled={saving}
          className="px-3 py-2.5 text-text-7 text-sm hover:text-text transition-colors disabled:opacity-40 shrink-0">
          Пропустить
        </button>
      )}
      <button onClick={onNext} disabled={nextDisabled || saving}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'var(--color-accent)' }}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {nextLabel}
      </button>
    </div>
  )
}

// ─── step 0: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ name, setName, onNext }) {
  return (
    <>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ background: 'var(--color-accent)' }}>P</div>
        <div>
          <p className="text-[10px] text-text-7 uppercase tracking-widest">Personal OS</p>
          <p className="text-sm font-semibold text-text">Персональная система</p>
        </div>
      </div>

      <StepHeader
        title="Добро пожаловать 👋"
        subtitle="Настроим вашу систему за пару минут. Все параметры можно изменить позже в Настройках."
      />

      <div className="flex flex-col gap-2">
        <label className="text-xs text-text-7 uppercase tracking-wider">Как вас зовут?</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onNext()}
          placeholder="Введите имя..."
          autoFocus
          className="bg-surface border border-border-2 rounded-xl px-4 py-3 text-text text-base outline-none focus:border-[var(--color-accent)] transition-colors w-full"
        />
      </div>

      <NavButtons onNext={onNext} nextLabel="Поехали →" nextDisabled={!name.trim()} />
    </>
  )
}

// ─── step 1: Modules ──────────────────────────────────────────────────────────

function StepModules({ selected, setSelected, onBack, onNext, saving }) {
  const toggle    = id => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleAll = ()  => setSelected(s => s.length === ALL_MODULES.length ? [] : ALL_MODULES.map(m => m.id))

  return (
    <>
      <StepHeader
        title="Выбери модули"
        subtitle="Активные модули появятся на Главной и в боковой панели. Можно изменить позже."
      />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-7">{selected.length} выбрано из {ALL_MODULES.length}</span>
        <button onClick={toggleAll}
          className="text-xs text-text-6 hover:text-text transition-colors underline underline-offset-2">
          {selected.length === ALL_MODULES.length ? 'Сбросить все' : 'Выбрать все'}
        </button>
      </div>

      <div className="flex flex-col gap-4 max-h-[320px] overflow-y-auto pr-0.5">
        {MODULE_CATEGORIES.map(cat => {
          const mods = ALL_MODULES.filter(m => m.category === cat.id)
          return (
            <div key={cat.id}>
              <p className="text-[10px] uppercase tracking-widest mb-2 font-semibold"
                style={{ color: cat.color }}>{cat.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {mods.map(mod => {
                  const mi   = MODULE_ICONS[mod.id]
                  const isOn = selected.includes(mod.id)
                  return (
                    <button key={mod.id} onClick={() => toggle(mod.id)}
                      className={`relative flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                        isOn ? '' : 'border-border-2 bg-card hover:border-border-hover'
                      }`}
                      style={isOn ? { background: mod.color + '18', borderColor: mod.color + '55' } : {}}>
                      {mi && (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: mod.color + '25' }}>
                          <mi.Icon className="w-3.5 h-3.5" style={{ color: mod.color }} />
                        </div>
                      )}
                      <span className={`text-xs font-semibold flex-1 min-w-0 leading-tight ${isOn ? 'text-text' : 'text-text-5'}`}>
                        {mod.name}
                      </span>
                      {isOn && (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: mod.color }}>
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextLabel={selected.length > 0 ? `Далее (${selected.length})` : 'Пропустить'}
        saving={saving}
      />
    </>
  )
}

// ─── step 2: Profile (optional) ───────────────────────────────────────────────

function StepProfile({ profile, setProfile, onBack, onNext, onSkip, saving }) {
  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }))
  return (
    <>
      <StepHeader
        title="Расскажи о себе"
        subtitle="Нужно для расчёта нормы калорий и рекомендаций по нагрузкам. Можно заполнить позже в Профиле."
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-7 uppercase tracking-wider">Пол</label>
          <Select value={profile.gender || ''} onChange={v => set('gender', v)}
            options={GENDER_OPTIONS} placeholder="Выберите пол" placeholderValue="" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-7 uppercase tracking-wider">Дата рождения</label>
          <DatePicker value={profile.birth_date || ''} onChange={v => set('birth_date', v)}
            placeholder="Выберите дату" noOverdue />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-7 uppercase tracking-wider">Рост, см</label>
            <input type="number" value={profile.height_cm || ''}
              onChange={e => set('height_cm', e.target.value ? Number(e.target.value) : '')}
              placeholder="175"
              className="bg-surface border border-border-2 rounded-xl px-3 py-2.5 text-text text-sm outline-none focus:border-[var(--color-accent)] transition-colors w-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-7 uppercase tracking-wider">Вес, кг</label>
            <input type="number" value={profile.weight_kg || ''}
              onChange={e => set('weight_kg', e.target.value ? Number(e.target.value) : '')}
              placeholder="70"
              className="bg-surface border border-border-2 rounded-xl px-3 py-2.5 text-text text-sm outline-none focus:border-[var(--color-accent)] transition-colors w-full" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-7 uppercase tracking-wider">Уровень активности</label>
          <Select value={profile.activity_level || ''} onChange={v => set('activity_level', v)}
            options={ACTIVITY_OPTIONS} placeholder="Выберите уровень" placeholderValue="" />
        </div>
      </div>

      <NavButtons onBack={onBack} onNext={onNext} onSkip={onSkip} nextLabel="Далее" saving={saving} />
    </>
  )
}

// ─── step 3: Theme ────────────────────────────────────────────────────────────

function StepTheme({ themeVal, onSelect, onBack, onNext, saving }) {
  return (
    <>
      <StepHeader
        title="Выбери тему"
        subtitle="Можно изменить в любой момент в Настройках."
      />

      <div className="grid grid-cols-3 gap-3">
        {THEMES.map(t => {
          const Icon = t.icon
          const isOn = themeVal === t.value
          return (
            <button key={t.value} onClick={() => onSelect(t.value)}
              className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all ${
                isOn ? '' : 'border-border-2 bg-card hover:border-border-hover'
              }`}
              style={isOn ? { borderColor: 'var(--color-accent)', background: 'var(--color-accent)18' } : {}}>
              <Icon className={`w-5 h-5 ${isOn ? '' : 'text-text-6'}`}
                style={isOn ? { color: 'var(--color-accent)' } : {}} />
              <span className={`text-xs font-medium ${isOn ? 'text-text' : 'text-text-6'}`}>{t.label}</span>
            </button>
          )
        })}
      </div>

      <NavButtons onBack={onBack} onNext={onNext} nextLabel="Далее" saving={saving} />
    </>
  )
}

// ─── step 4: Done ─────────────────────────────────────────────────────────────

function StepDone({ name, selectedModules, onFinish, saving }) {
  return (
    <>
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-3xl"
          style={{ background: 'var(--color-accent)20' }}>🎉</div>
        <h2 className="text-2xl font-bold text-text mb-2">
          Всё готово{name ? `, ${name}` : ''}!
        </h2>
        <p className="text-text-7 text-sm">
          Ваша персональная система настроена и готова к работе.
        </p>
      </div>

      <div className="bg-surface border border-border-2 rounded-xl p-4 flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-7">Активных модулей</span>
          <span className="text-sm font-semibold text-text">{selectedModules.length}</span>
        </div>
        {selectedModules.length > 0 && (
          <>
            <div className="h-px bg-border-2" />
            <div className="flex flex-wrap gap-1.5">
              {selectedModules.slice(0, 7).map(id => {
                const mi  = MODULE_ICONS[id]
                const mod = ALL_MODULES.find(m => m.id === id)
                return mi ? (
                  <span key={id}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium"
                    style={{ background: mi.color + '20', color: mi.color }}>
                    <mi.Icon className="w-3 h-3" />{mod?.name}
                  </span>
                ) : null
              })}
              {selectedModules.length > 7 && (
                <span className="px-2 py-1 rounded-lg text-[11px] text-text-7 bg-surface-2">
                  +{selectedModules.length - 7}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <button onClick={onFinish} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
        style={{ background: 'var(--color-accent)' }}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Войти в приложение →
      </button>
    </>
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function OnboardingClient() {
  const router                            = useRouter()
  const { session, loading: authLoading } = useAuth()
  const { completeOnboarding }            = useOS()
  const { theme, setTheme }               = useTheme()

  const [step,    setStep]    = useState(0)
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [checked, setChecked] = useState(false) // true once gate check done

  // form state
  const [name,     setName]     = useState('')
  const [selected, setSelected] = useState(DEFAULT_MODULES)
  const [profile,  setProfile]  = useState({ gender: '', birth_date: '', height_cm: '', weight_kg: '', activity_level: '' })
  const [themeVal, setThemeVal] = useState('system')

  // sync theme picker with current live theme
  useEffect(() => { setThemeVal(theme || 'system') }, [theme])

  // redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !session) router.replace('/auth')
  }, [authLoading, session, router])

  // gate: already onboarded → go to app; not → show wizard
  // Fallback: if profileRepo.get takes too long (cold start), unblock after 2s anyway
  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    // Fallback timeout — never block the wizard more than 2s
    const fallback = setTimeout(() => {
      if (!cancelled) setChecked(true)
    }, 2000)
    profileRepo.get(session.user.id)
      .then(p => {
        if (cancelled) return
        clearTimeout(fallback)
        if (p?.onboarding_completed) {
          router.replace('/home')
        } else {
          if (p?.display_name || p?.username) setName(p.display_name || p.username || '')
          setChecked(true)
        }
      })
      .catch(() => {
        if (!cancelled) { clearTimeout(fallback); setChecked(true) }
      })
    return () => { cancelled = true; clearTimeout(fallback) }
  }, [session, router])

  const uid = session?.user?.id

  const withSave = useCallback(async (fn) => {
    setSaveErr('')
    setSaving(true)
    try { await fn(); return true }
    catch (err) {
      const msg = err?.message ?? ''
      setSaveErr(
        isNetworkError(msg)
          ? 'Ошибка соединения — проверьте интернет и попробуйте снова'
          : msg || 'Ошибка сохранения. Попробуйте ещё раз.'
      )
      return false
    }
    finally { setSaving(false) }
  }, [])

  // ── step transitions ──────────────────────────────────────────────────────

  const go0to1 = () => withSave(async () => {
    await profileRepo.upsert(uid, { display_name: name.trim(), username: name.trim() })
  }).then(ok => ok && setStep(1))

  const go1to2 = () => {
    const mods = selected.length > 0 ? selected : DEFAULT_MODULES
    withSave(async () => {
      await Promise.all(mods.map((id, i) => userModulesRepo.upsert(uid, id, i)))
    }).then(ok => ok && setStep(2))
  }

  const go2to3 = () => {
    const fields = {}
    if (profile.gender)         fields.gender         = profile.gender
    if (profile.birth_date)     fields.birth_date     = profile.birth_date
    if (profile.height_cm)      fields.height_cm      = Number(profile.height_cm)
    if (profile.weight_kg)      fields.weight_kg      = Number(profile.weight_kg)
    if (profile.activity_level) fields.activity_level = profile.activity_level
    const save = Object.keys(fields).length > 0
      ? withSave(() => profileRepo.upsert(uid, fields))
      : Promise.resolve(true)
    save.then(ok => ok && setStep(3))
  }

  const go3to4 = () =>
    withSave(() => profileRepo.upsert(uid, { theme: themeVal }))
      .then(ok => { if (ok) { setTheme(themeVal); setStep(4) } })

  const finish = () => {
    const mods = selected.length > 0 ? selected : DEFAULT_MODULES
    withSave(() => completeOnboarding(mods, name.trim()))
      .then(ok => ok && router.replace('/home'))
  }

  // ── loading / gate ────────────────────────────────────────────────────────

  if (authLoading || !checked) {
    return (
      <div className="fixed inset-0 bg-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-text-7 animate-spin" />
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-bg overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md animate-fade-in py-6">

          <ProgressBar step={step} />

          {saveErr && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs">
              {saveErr}
            </div>
          )}

          {step === 0 && <StepWelcome name={name} setName={setName} onNext={go0to1} />}

          {step === 1 && (
            <StepModules selected={selected} setSelected={setSelected}
              onBack={() => setStep(0)} onNext={go1to2} saving={saving} />
          )}

          {step === 2 && (
            <StepProfile profile={profile} setProfile={setProfile}
              onBack={() => setStep(1)} onNext={go2to3}
              onSkip={() => setStep(3)} saving={saving} />
          )}

          {step === 3 && (
            <StepTheme themeVal={themeVal}
              onSelect={v => { setThemeVal(v); setTheme(v) }}
              onBack={() => setStep(2)} onNext={go3to4} saving={saving} />
          )}

          {step === 4 && (
            <StepDone
              name={name}
              selectedModules={selected.length > 0 ? selected : DEFAULT_MODULES}
              onFinish={finish}
              saving={saving}
            />
          )}

        </div>
      </div>
    </div>
  )
}
