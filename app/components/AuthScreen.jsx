'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { profileRepo } from '../../lib/db/profile'

const ERROR_MAP = {
  'Invalid login credentials':              'Неверный email или пароль',
  'User already registered':                'Email уже зарегистрирован',
  'Email not confirmed':                    'Подтвердите email (проверьте почту)',
  'Password should be at least 6 characters': 'Пароль — минимум 6 символов',
  'Unable to validate email address':       'Некорректный email',
  'For security purposes':                  'Слишком много попыток — подождите немного',
  // Network / cold-start errors (WebKit "Load failed", Chrome "Failed to fetch", etc.)
  'Ошибка соединения':    'Ошибка соединения — проверьте интернет и попробуйте снова',
  'Load failed':          'Ошибка соединения — проверьте интернет и попробуйте снова',
  'Failed to fetch':      'Ошибка соединения — проверьте интернет и попробуйте снова',
  'NetworkError':         'Ошибка соединения — проверьте интернет и попробуйте снова',
  'network request':      'Ошибка соединения — проверьте интернет и попробуйте снова',
}

function friendlyError(msg) {
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (msg?.includes(key)) return val
  }
  return msg || 'Что-то пошло не так'
}

export default function AuthScreen() {
  const { signIn, signUp, resendConfirmation } = useAuth()
  const router = useRouter()
  const [mode,        setMode]        = useState('signin')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [error,       setError]       = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [connecting,  setConnecting]  = useState(false) // first-attempt "waking up" indicator
  // 'confirming' state: waiting for email verification after signup
  const [confirming,  setConfirming]  = useState(false)
  const [resending,   setResending]   = useState(false)
  const [resent,      setResent]      = useState(false)

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setError(password.length < 6 ? 'Пароль — минимум 6 символов' : 'Введите email')
      return
    }
    setError('')
    setSubmitting(true)
    // Show "Подключаемся..." hint after 1.5s (indicates cold-start / slow server wake-up)
    const connectingTimer = setTimeout(() => setConnecting(true), 1500)
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
        // Supabase requires email confirmation — show confirmation screen
        setConfirming(true)
        return
      }

      // Signed in or immediately confirmed — route based on onboarding
      const profile = await profileRepo.get(userId)
      router.replace(profile?.onboarding_completed ? '/home' : '/onboarding')
    } catch (err) {
      // Catch any thrown TypeErrors that slip through (rare WebKit edge case)
      setError(friendlyError(err?.message ?? ''))
    } finally {
      clearTimeout(connectingTimer)
      setConnecting(false)
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setResent(false)
    try {
      await resendConfirmation(email.trim())
      setResent(true)
    } catch { /* silent */ } finally {
      setResending(false)
    }
  }

  const handleKey = (e) => e.key === 'Enter' && submit()

  // ── Awaiting email confirmation ────────────────────────────────────────────────
  if (confirming) {
    return (
      <div className="fixed inset-0 bg-bg flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in flex flex-col items-center text-center gap-6">

          <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center">
            <Mail className="w-8 h-8 text-accent" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-text mb-2">Подтвердите email</h2>
            <p className="text-sm text-subtle leading-relaxed">
              Письмо для подтверждения отправлено на{' '}
              <span className="text-text font-medium break-all">{email}</span>.
              Проверьте почту, включая папку «Спам».
            </p>
          </div>

          {resent && (
            <div className="flex items-center gap-2 px-4 py-3 bg-success/10 border border-success/30 rounded-xl text-success text-sm w-full">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Письмо отправлено повторно
            </div>
          )}

          <button
            onClick={handleResend}
            disabled={resending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm text-subtle hover:text-text hover:border-border-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            {resending ? 'Отправка...' : 'Отправить письмо повторно'}
          </button>

          <button
            onClick={() => { setConfirming(false); setResent(false) }}
            className="text-xs text-subtle hover:text-text transition-colors"
          >
            ← Назад к форме входа
          </button>
        </div>
      </div>
    )
  }

  // ── Sign in / Sign up form ─────────────────────────────────────────────────────
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

        {connecting && !error && (
          <div className="mb-3 px-4 py-2.5 bg-surface border border-border rounded-xl text-subtle text-sm flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
            Подключаемся к серверу…
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">
            {error}
            {error.includes('соединения') && (
              <button
                onClick={submit}
                className="block mt-2 text-xs text-accent hover:underline"
              >
                Попробовать ещё раз
              </button>
            )}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || !email.trim() || !password}
          className="w-full bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
        >
          {submitting ? 'Подождите…' : mode === 'signup' ? 'Создать аккаунт' : 'Войти'}
        </button>

        {mode === 'signin' && (
          <div className="mt-4 text-center">
            <Link href="/auth/forgot" className="text-xs text-subtle hover:text-text transition-colors">
              Забыли пароль?
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
