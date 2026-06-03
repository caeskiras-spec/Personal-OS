'use client'

import { useEffect, useState } from 'react'

export default function BootScreen() {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('init')

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          return 100
        }
        return p + 2
      })
    }, 30)

    const t1 = setTimeout(() => setPhase('loading'), 500)
    const t2 = setTimeout(() => setPhase('ready'), 1600)

    return () => {
      clearInterval(interval)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-2xl font-bold text-white">
            P
          </div>
          <span className="text-white font-semibold text-xl tracking-widest uppercase">
            Personal OS
          </span>
        </div>

        <div className="flex flex-col items-center gap-3 w-48">
          <div className="w-full h-0.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-subtle text-xs tracking-widest">
            {phase === 'init' && 'ИНИЦИАЛИЗАЦИЯ'}
            {phase === 'loading' && 'ЗАГРУЗКА СИСТЕМЫ'}
            {phase === 'ready' && 'ГОТОВО'}
          </span>
        </div>
      </div>
    </div>
  )
}