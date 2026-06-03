'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/auth'
import { profileRepo } from '../../lib/db/profile'

const ERROR_MAP = {
  'Invalid login credentials': 'Неверный email или пароль',
  'User already registered': 'Email уже зарегистрирован',
  'Email not confirmed': 'Подтвердите email (проверьте почту)',
  'Password should be at least 6 characters': 'Пароль — минимум 6 символов',
  'Unable to validate email address': 'Некорректный email',
}

function friendlyError(msg) {
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (msg?.includes(key)) return val
  }
  return msg || 'Что-то пошло не так'
}

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setError(password.length < 6 ? 'Пароль — минимум 6 символов' : 'Введите email')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const { data, error: authError } = mode === 'signup'
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password)

      if (authError) {
        setError(friendlyError(authError.message))
        return
      }

      const userId = data?.user?.id
      if (!userId) {
        // Email confirmation required
        setError('Проверьте почту для подтверждения аккаунта')
        return
      }

      // Route based on onboarding state
      const profile = await profileRepo.get(userId)
      router.replace(profile?.onboarding_completed ? '/home' : '/onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKey = (e) => e.key === 'Enter' && submit()

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-xl font-bold text-white">
            P
          </div>
          <span className="text-text font-semibold tracking-widest text-sm uppercase">Personal OS</span>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-surface border border-border rounded-xl p-1 mb-6">
          {[['signin', 'Вход'], ['signup', 'Регистрация']].map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m ? 'bg-accent text-white' : 'text-subtle hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3 mb-5">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Email"
            autoComplete="email"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-text text-sm outline-none focus:border-accent transition-colors placeholder:text-subtle"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Пароль"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-text text-sm outline-none focus:border-accent transition-colors placeholder:text-subtle"
          />
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || !email.trim() || !password}
          className="w-full bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
        >
          {submitting ? 'Подождите...' : mode === 'signup' ? 'Создать аккаунт' : 'Войти'}
        </button>
      </div>
    </div>
  )
}
