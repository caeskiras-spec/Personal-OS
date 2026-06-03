'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

const DEV_BYPASS  = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID || 'dev-user-1'
const DEV_SESSION = DEV_BYPASS ? { user: { id: DEV_USER_ID } } : null

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (DEV_BYPASS) {
      setSession(DEV_SESSION)
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password })

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{
      session: session ?? null,
      user: session?.user ?? null,
      loading,
      signUp,
      signIn,
      signOut,
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
