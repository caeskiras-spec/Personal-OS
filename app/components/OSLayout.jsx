'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../../lib/auth'
import { useOS } from '../../lib/store'
import { getModuleById } from '../../lib/modules'
import { MODULE_ICONS } from '../../lib/moduleIcons'
import ProfilePanel from './ProfilePanel'

const NAV_ITEMS = [
  { path: '/home',      icon: '⌂', label: 'Главная'   },
  { path: '/modules',   icon: '⊞', label: 'Модули'    },
  { path: '/analytics', icon: '◈', label: 'Аналитика' },
  { path: '/settings',  icon: '⚙', label: 'Настройки' },
]

export default function OSLayout({ children, activeRoute }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, loading } = useAuth()
  const { activeModules, reorderModules, userName } = useOS()
  const [profileOpen, setProfileOpen] = useState(false)
  const currentPath = activeRoute || pathname

  // ── drag&drop state ──────────────────────────────────────────────
  const [dragId, setDragId]   = useState(null)
  const [overId,  setOverId]  = useState(null)
  const dragHappened = useRef(false)   // guard: skip navigation after real drag

  const handleDragStart = (e, id) => {
    dragHappened.current = false
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== overId) setOverId(id)
  }

  const handleDrop = (e, targetId) => {
    e.preventDefault()
    if (!dragId || dragId === targetId) { resetDrag(); return }
    const from = activeModules.indexOf(dragId)
    const to   = activeModules.indexOf(targetId)
    if (from === -1 || to === -1) { resetDrag(); return }
    dragHappened.current = true
    const next = [...activeModules]
    next.splice(from, 1)
    next.splice(to, 0, dragId)
    reorderModules(next)
    resetDrag()
  }

  const handleDragEnd = () => resetDrag()
  const resetDrag     = () => {
    setDragId(null)
    setOverId(null)
    setTimeout(() => { dragHappened.current = false }, 150)
  }
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!loading && !session) router.replace('/auth')
  }, [loading, session, router])

  if (loading || !session) {
    return (
      <div className="flex h-screen bg-bg items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-bg text-text overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-56 flex flex-col border-r border-border bg-surface/50 shrink-0">

        {/* Logo */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-sm font-bold text-white">
              P
            </div>
            <span className="font-semibold text-text text-sm tracking-wider">PERSONAL OS</span>
          </div>
        </div>

        {/* Fixed nav items */}
        <nav className="flex flex-col p-3 gap-0.5">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                currentPath === item.path
                  ? 'bg-accent/15 text-accent'
                  : 'text-subtle hover:text-text hover:bg-surface'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Draggable modules */}
        {activeModules.length > 0 && (
          <div className="px-3 mt-2">
            <div className="px-3 py-2 text-xs uppercase tracking-widest text-muted select-none">
              Модули
            </div>
            <div className="flex flex-col gap-0.5">
              {activeModules.map(modId => {
                const mod = getModuleById(modId)
                if (!mod) return null
                const path       = `/modules/${modId}`
                const isDragging = dragId === modId
                const isOver     = overId === modId && dragId !== modId
                const isActive   = currentPath === path

                return (
                  <div
                    key={modId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, modId)}
                    onDragOver={(e)  => handleDragOver(e, modId)}
                    onDrop={(e)      => handleDrop(e, modId)}
                    onDragEnd={handleDragEnd}
                    onClick={() => { if (!dragHappened.current) router.push(path) }}
                    className={`
                      group flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                      transition-all select-none cursor-grab active:cursor-grabbing
                      ${isDragging
                        ? 'opacity-25 bg-surface'
                        : isOver
                          ? 'bg-accent/10 text-accent-light outline outline-1 -outline-offset-1 outline-accent/40'
                          : isActive
                            ? 'bg-accent/15 text-accent'
                            : 'text-text/70 hover:text-text hover:bg-white/5'
                      }
                    `}
                  >
                    {(() => {
                      const mi = MODULE_ICONS[modId]
                      if (mi) {
                        const color = isActive ? undefined : (isDragging || isOver ? undefined : mi.color)
                        return <mi.Icon className="w-4 h-4 shrink-0" style={color ? { color } : {}} />
                      }
                      return <span className="text-sm w-5 text-center shrink-0">{mod.icon}</span>
                    })()}
                    <span className="flex-1 truncate">{mod.name}</span>
                    {/* subtle grip hint — visible only on hover */}
                    <span
                      className="opacity-0 group-hover:opacity-25 transition-opacity text-[10px] leading-none tracking-[2px] shrink-0"
                      aria-hidden
                    >
                      ⠿
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* User footer */}
        <div className="mt-auto p-3 border-t border-border">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
          >
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent shrink-0 group-hover:bg-accent/30 transition-colors">
              {(userName || session?.user?.email || 'У')[0].toUpperCase()}
            </div>
            <span className="text-subtle text-xs truncate flex-1">
              {userName || session?.user?.email || 'Пользователь'}
            </span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* ── Profile panel ── */}
      {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
