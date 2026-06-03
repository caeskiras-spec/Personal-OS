'use client'

import { useOS } from '@/lib/store'
import { ALL_MODULES } from '@/lib/modules'

export default function TodaySection() {
  const { state } = useOS()
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const hasHabits = state.activeModules.includes('habits')
  const hasTasks = state.activeModules.includes('tasks')

  if (!hasHabits && !hasTasks) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-white/40 text-xs font-medium uppercase tracking-widest">{today}</p>
      <div className="flex flex-col gap-1.5">
        {hasTasks && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <span className="text-base">✅</span>
            <p className="text-sm text-white/60">No tasks for today yet</p>
          </div>
        )}
        {hasHabits && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <span className="text-base">🔁</span>
            <p className="text-sm text-white/60">No habits tracked yet</p>
          </div>
        )}
      </div>
    </div>
  )
}