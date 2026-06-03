'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

// Handles OAuth / magic-link redirects.
// Supabase parses tokens from the URL hash automatically;
// once the session is ready, redirect into the app.
export default function AuthCallbackPage() {
  const router = useRouter()
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.replace('/')
    })
    // If session already exists (e.g. page refreshed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/')
    })
    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  )
}
