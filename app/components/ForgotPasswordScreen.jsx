'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../lib/auth'

export default function ForgotPasswordScreen() {
  const { resetPasswordForEmail } = useAuth()
  const [email,       setEmail]       = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [sent,        setSent]        = useState(false)
  const [error,       setError]       = useState('')

  const submit = async () => {
    if (!email.trim()) { setError('Введите email'); return }
    setError('')
    setSubmitting(true)
    try {
      const redirectTo = `${window.location.origin}/auth/reset`
      const { error: authError } = await resetPasswordForEmail(email.trim(), redirectTo)
      if (authError) { setError(authError.message); return }
      setSent(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-xl font-bold text-white">P</div>
          <span className="text-text font-semibold tracking-widest text-sm uppercase">Personal OS</span>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center text-2xl">✉️</div>
            <div>
              <p className="text-text font-semibold mb-1">Письмо отправлено</p>
              <p className="text-subtle text-sm">Проверьте почту {email} и перейдите по ссылке для сброса пароля.</p>
            </div>
            <Link href="/auth" className="text-sm text-accent hover:text-accent-light transition-colors">
              ← Вернуться ко входу
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-text font-semibold text-lg mb-1">Сброс пароля</h2>
            <p className="text-subtle text-sm mb-6">Введите email — пришлём ссылку для создания нового пароля.</p>

            <div className="flex flex-col gap-3 mb-4">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Email"
                autoComplete="email"
                autoFocus
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
              disabled={submitting || !email.trim()}
              className="w-full bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
            >
              {submitting ? 'Отправка...' : 'Отправить ссылку'}
            </button>

            <div className="mt-4 text-center">
              <Link href="/auth" className="text-xs text-subtle hover:text-text transition-colors">
                ← Вернуться ко входу
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
