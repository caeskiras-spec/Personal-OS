'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { AUTH_ENABLED } from './config'
import { authWithRetry } from './net'

const AuthContext = createContext(null)

// DEV_BYPASS is only active when AUTH_ENABLED = false
const DEV_BYPASS  = !AUTH_ENABLED && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID || 'dev-user-1'
const DEV_SESSION = DEV_BYPASS ? { user: { id: DEV_USER_ID, email: 'dev@local' } } : null

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (DEV_BYPASS) {
      setSession(DEV_SESSION)
      setLoading(false)
      return
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => { setSession(session) })
      .catch(() => { setSession(null) })
      .finally(() => { setLoading(false) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email, password) =>
    authWithRetry(() => supabase.auth.signUp({ email, password }))

  const resendConfirmation = (email) =>
    authWithRetry(() => supabase.auth.resend({ type: 'signup', email }))

  const signIn = (email, password) =>
    authWithRetry(() => supabase.auth.signInWithPassword({ email, password }))

  const signOut = () => supabase.auth.signOut()

  /** Send password-reset email. redirectTo must be the full URL of /auth/reset. */
  const resetPasswordForEmail = (email, redirectTo) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo })

  /**
   * Set a new password for the currently authenticated user.
   * Called from /auth/reset after Supabase has restored the recovery session.
   */
  const updatePassword = (newPassword) =>
    supabase.auth.updateUser({ password: newPassword })

  // Future: Google OAuth — signInWithOAuth({ provider: 'google', options: { redirectTo } })

  return (
    <AuthContext.Provider value={{
      session: session ?? null,
      user:    session?.user ?? null,
      loading,
      signUp,
      signIn,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      resendConfirmation,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
