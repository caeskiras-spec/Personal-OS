'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/auth'
import { useOS } from '../../lib/store'
import { ALL_MODULES, MODULE_CATEGORIES } from '../../lib/modules'

export default function OnboardingClient() {
  const router = useRouter()
  const { session, loading } = useAuth()
  const { completeOnboarding } = useOS()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/auth')
    }
  }, [loading, session, router])
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState([])

  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const finish = () => {
    const modules = selected.length > 0 ? selected : ['tasks']
    completeOnboarding(modules)
    router.push('/home')
  }

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-lg animate-fade-in">

        {step === 0 && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-xl font-bold text-white mb-2">
                P
              </div>
              <h1 className="text-3xl font-bold text-text">Добро пожаловать</h1>
              <p className="text-subtle text-lg">Настроим вашу персональную систему</p>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm text-subtle uppercase tracking-wider">Как вас зовут?</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Введите имя..."
                className="bg-surface border border-border rounded-xl px-4 py-3 text-text text-lg outline-none focus:border-accent transition-colors"
                autoFocus
              />
            </div>

            <button
              onClick={() => name.trim() && setStep(1)}
              disabled={!name.trim()}
              className="bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors text-lg"
            >
              Продолжить →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-text">Выберите модули</h2>
              <p className="text-subtle">Выберите, чем вы хотите управлять. Можно добавить позже.</p>
            </div>

            <div className="flex flex-col gap-6 max-h-96 overflow-y-auto pr-1">
              {MODULE_CATEGORIES.map(cat => {
                const mods = ALL_MODULES.filter(m => m.category === cat.id)
                return (
                  <div key={cat.id} className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-widest text-subtle">{cat.label}</span>
                    <div className="grid grid-cols-2 gap-2">
                      {mods.map(mod => (
                        <button
                          key={mod.id}
                          onClick={() => toggle(mod.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            selected.includes(mod.id)
                              ? 'border-accent bg-accent/10 text-text'
                              : 'border-border bg-surface text-subtle hover:border-muted hover:text-text'
                          }`}
                        >
                          <span className="text-lg">{mod.icon}</span>
                          <span className="text-sm font-medium">{mod.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="flex-1 border border-border text-subtle py-3 rounded-xl hover:border-muted hover:text-text transition-colors"
              >
                Назад
              </button>
              <button
                onClick={finish}
                className="flex-[2] bg-accent hover:bg-accent-light text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {selected.length > 0 ? `Запустить (${selected.length})` : 'Пропустить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}