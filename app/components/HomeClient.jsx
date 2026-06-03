'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/auth'
import { useOS } from '../../lib/store'
import BootScreen from './BootScreen'

export default function HomeClient() {
  const router = useRouter()
  const { session, loading: authLoading } = useAuth()
  const { isOnboarded, isLoading: storeLoading } = useOS()
  const [booting, setBooting] = useState(true)

  // Boot animation runs in parallel with auth + store loading
  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 2200)
    return () => clearTimeout(timer)
  }, [])

  // Route when animation AND all data are ready
  useEffect(() => {
    if (booting || authLoading || storeLoading) return

    if (!session) {
      router.replace('/auth')
      return
    }

    if (isOnboarded) {
      router.replace('/home')
    } else {
      router.replace('/onboarding')
    }
  }, [booting, authLoading, storeLoading, session, isOnboarded, router])

  return <BootScreen />
}
