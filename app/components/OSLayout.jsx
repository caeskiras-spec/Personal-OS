'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Home, LayoutGrid, BarChart3, Settings, Menu, X } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useOS } from '../../lib/store'
import { getModuleById } from '../../lib/modules'
import { MODULE_ICONS } from '../../lib/moduleIcons'
import ProfilePanel from './ProfilePanel'

// Nav items styled like module icons: each has its own accent color
const NAV_ITEMS = [
  { path: '/home',      Icon: Home,        color: '#6c63ff', label: 'Главная'   },
  { path: '/modules',   Icon: LayoutGrid,  color: '#0891b2', label: 'Модули'    },
  { path: '/analytics', Icon: BarChart3,   color: '#22c55e', label: 'Аналитика' },
  { path: '/settings',  Icon: Settings,    color: '#f59e0b', label: 'Настройки' },
]

export default function OSLayout({ children, activeRoute }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { session, loading } = useAuth()
  const { activeModules, reorderModules, userName } = useOS()
  const [profileOpen, setProfileOpen] = useState(false)
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const currentPath = activeRoute || pathname

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  // Close on Escape
  useEffect(() => {
    if (!drawerOpen) return
    const fn = (e) => { if (e.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [drawerOpen])

  // Lock body scroll on mobile when drawer open
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = 'hidden'
    else            document.body.style.overflow = ''
    return ()     => { document.body.style.overflow = '' }
  }, [drawerOpen])

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

  // navigate: close mobile drawer then route
  const navigate = (path) => {
    setDrawerOpen(false)
    if (!dragHappened.current) router.push(path)
  }

  // Sidebar inner — shared between desktop aside + mobile drawer
  const sidebarNav = (
    <>
      {/* Logo row */}
      <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-sm font-bold text-white shrink-0">P</div>
          <span className="font-semibold text-text text-sm tracking-wider truncate">PERSONAL OS</span>
        </div>
        {/* Close X — mobile drawer only */}
        <button
          className="md:hidden ml-2 p-1.5 rounded-lg text-text-7 hover:text-text hover:bg-surface-2 transition-colors shrink-0"
          onClick={() => setDrawerOpen(false)}
          aria-label="Закрыть меню"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fixed nav */}
      <nav className="flex flex-col p-3 gap-0.5 shrink-0">
        {NAV_ITEMS.map(item => {
          const isActive = currentPath === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                isActive ? '' : 'text-subtle hover:text-text hover:bg-muted/10'
              }`}
              style={isActive ? { color: item.color, backgroundColor: item.color + '18' } : {}}
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all"
                style={isActive
                  ? { background: item.color + '25', color: item.color }
                  : { color: 'var(--color-text-6)' }
                }
              >
                <item.Icon className="w-3.5 h-3.5" />
              </div>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Draggable modules */}
      {activeModules.length > 0 && (
        <div className="px-3 mt-2 flex-1 overflow-y-auto min-h-0">
          <div className="px-3 py-2 text-xs uppercase tracking-widest text-muted select-none">Модули</div>
          <div className="flex flex-col gap-0.5 pb-2">
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
                  onClick={() => { if (!dragHappened.current) navigate(path) }}
                  className={`
                    group flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                    transition-all select-none cursor-grab active:cursor-grabbing
                    ${isDragging
                      ? 'opacity-25 bg-surface'
                      : isOver
                        ? 'bg-accent/10 text-accent-light outline outline-1 -outline-offset-1 outline-accent/40'
                        : isActive
                          ? 'bg-accent/15 text-accent'
                          : 'text-text/70 hover:text-text hover:bg-muted/10'
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
                  <span className="opacity-0 group-hover:opacity-25 transition-opacity text-[10px] leading-none tracking-[2px] shrink-0" aria-hidden>⠿</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* User footer */}
      <div className="mt-auto p-3 border-t border-border shrink-0">
        <button
          onClick={() => { setDrawerOpen(false); setProfileOpen(true) }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/10 transition-colors text-left group"
        >
          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent shrink-0 group-hover:bg-accent/30 transition-colors">
            {(userName || session?.user?.email || 'У')[0].toUpperCase()}
          </div>
          <span className="text-subtle text-xs truncate flex-1">
            {userName || session?.user?.email || 'Пользователь'}
          </span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-[100dvh] bg-bg text-text overflow-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>

      {/* ── Desktop sidebar: always visible on md+ ─────────────── */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-surface/50 shrink-0">
        {sidebarNav}
      </aside>

      {/* ── Mobile: backdrop + slide-in drawer ──────────────────── */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]
          transition-opacity duration-300 md:hidden
          ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col
          bg-panel border-r border-border
          transition-transform duration-300 ease-in-out md:hidden
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Навигация"
      >
        {sidebarNav}
      </aside>

      {/* ── Content area: topbar (mobile) + page ─────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile topbar — hidden on md+ */}
        <header className="flex md:hidden items-center gap-3 px-4 h-14 border-b border-border bg-surface/80 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-1 rounded-xl text-text-6 hover:text-text hover:bg-surface-2 transition-colors"
            aria-label="Открыть меню"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center text-xs font-bold text-white shrink-0">P</div>
            <span className="font-semibold text-sm text-text">Personal OS</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {children}
        </main>
      </div>

      {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
