'use client'

import { ThemeContextProvider } from '../../lib/theme'
import { useOS } from '../../lib/store'
import { profileRepo } from '../../lib/db/profile'

export default function ThemeProvider({ children }) {
  const { userId } = useOS()
  return (
    <ThemeContextProvider userId={userId} profileRepo={profileRepo}>
      {children}
    </ThemeContextProvider>
  )
}
