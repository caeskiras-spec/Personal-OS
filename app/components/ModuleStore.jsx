'use client'

import { useRef, useState } from 'react'
import { useOS } from '../../lib/store'
import { ALL_MODULES, MODULE_CATEGORIES, getModuleById } from '../../lib/modules'
import { MODULE_ICONS } from '../../lib/moduleIcons'
import { useRouter } from 'next/navigation'
import { GripVertical, Plus, ExternalLink, EyeOff, LayoutGrid } from 'lucide-react'

// ─── ModuleIcon ────────────────────────────────────────────────────────────────

function ModuleIcon({ modId, color, size = 'md' }) {
  const mi = MODULE_ICONS[modId]
  const mod = getModuleById(modId)
  const dim = size === 'lg' ? 'w-12 h-12' : 'w-10 h-10'
  const iconDim = size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
  return (
    <div
      className={`${dim} rounded-xl flex items-center justify-center shrink-0`}
      style={{ backgroundColor: (color || mod?.color || '#6c63ff') + '20' }}
    >
      {mi
        ? <mi.Icon className={iconDim} style={{ color: mi.color }} />
        : <span className="text-lg" style={{ color: color || mod?.color }}>{mod?.icon}</span>
      }
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-44 bg-card border border-border-2 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

// ─── ActiveModuleCard (draggable) ──────────────────────────────────────────────

function ActiveModuleCard({ modId, isDragging, isOver, dragHappened,
  onDragStart, onDragOver, onDrop, onDragEnd, onOpen, onRemove }) {
  const mod = getModuleById(modId)
  if (!mod) return null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`
        relative flex flex-col gap-3 p-4 rounded-xl border transition-all
        cursor-grab active:cursor-grabbing select-none h-full
        ${isDragging
          ? 'opacity-30 scale-[0.97] bg-card border-border'
          : isOver
            ? 'bg-card-accent border-[#6c63ff]/50 shadow-[0_0_0_1px_rgba(108,99,255,0.15)]'
            : 'bg-card border-border-2 hover:bg-surface-2 hover:border-border-hover'
        }
      `}
    >
      {/* Drag handle */}
      <div className="absolute top-3 right-3 text-text-8 hover:text-text-6 transition-colors">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Icon */}
      <ModuleIcon modId={modId} color={mod.color} size="lg" />

      {/* Text */}
      <div className="flex-1">
        <p className="text-sm font-semibold text-text leading-tight">{mod.name}</p>
        <p className="text-[11px] text-text-6 mt-1 leading-relaxed line-clamp-2">{mod.description}</p>
      </div>

      {/* Status + actions */}
      <div className="flex flex-col gap-2 mt-auto">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#22c55e] w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] inline-block" />
          Подключён
        </span>
        <div className="flex gap-1.5">
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); if (!dragHappened.current) onOpen() }}
            className="flex-1 flex items-center justify-center gap-1 text-[11px] text-[#6c63ff] hover:text-[#8b85ff] py-1.5 rounded-lg border border-[#6c63ff]/30 hover:border-[#6c63ff]/60 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Открыть
          </button>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); if (!dragHappened.current) onRemove() }}
            className="flex items-center justify-center gap-1 text-[11px] text-text-6 hover:text-[#ef4444] px-2.5 py-1.5 rounded-lg border border-border hover:border-[#ef4444]/30 transition-colors"
            title="Скрыть"
          >
            <EyeOff className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CatalogModuleCard ─────────────────────────────────────────────────────────

function CatalogModuleCard({ mod, isActive, onAdd, onOpen, onRemove }) {
  return (
    <div className={`
      flex flex-col gap-3 p-4 rounded-xl border transition-all h-full
      ${isActive
        ? 'bg-card border-muted'
        : 'bg-surface-3 border-surface-3 hover:bg-surface hover:border-[#2e2e2e]'
      }
    `}>
      <ModuleIcon modId={mod.id} color={mod.color} />

      <div className="flex-1">
        <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-text' : 'text-text-4'}`}>
          {mod.name}
        </p>
        <p className="text-[11px] text-text-7 mt-1 leading-relaxed line-clamp-2">{mod.description}</p>
      </div>

      <div className="mt-auto">
        {isActive ? (
          <div className="flex gap-1.5">
            <button
              onClick={onOpen}
              className="flex-1 text-[11px] text-[#6c63ff] hover:text-[#8b85ff] py-1.5 rounded-lg border border-[#6c63ff]/20 hover:border-[#6c63ff]/50 transition-colors"
            >
              Открыть
            </button>
            <button
              onClick={onRemove}
              className="text-[11px] text-text-6 hover:text-[#ef4444] px-2.5 py-1.5 rounded-lg border border-border hover:border-[#ef4444]/30 transition-colors"
              title="Скрыть"
            >
              <EyeOff className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-white bg-[#6c63ff] hover:bg-[#8b85ff] py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" /> Подключить
          </button>
        )}
      </div>
    </div>
  )
}

// ─── ModuleStore ───────────────────────────────────────────────────────────────

export default function ModuleStore() {
  const { activeModules, addModule, removeModule, reorderModules, isLoading } = useOS()
  const router = useRouter()
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const dragHappened = useRef(false)

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const resetDrag = () => {
    setDragId(null)
    setOverId(null)
    // delay so click-after-drop doesn't fire navigation
    setTimeout(() => { dragHappened.current = false }, 200)
  }

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

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="h-8 w-40 bg-card rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-56 bg-surface rounded animate-pulse" />
        </div>
        <GridSkeleton count={8} />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Модули</h1>
        <p className="text-subtle text-sm mt-1">Подключите нужные области жизни</p>
      </div>

      <div className="flex flex-col gap-10">

        {/* ── Мои модули ─────────────────────────────────────────────────── */}
        {activeModules.length > 0 && (
          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-text-7 mb-3 flex items-center gap-2">
              <span>Мои модули</span>
              <span className="text-text-8">·</span>
              <span className="text-text-8 normal-case tracking-normal text-[10px]">
                перетащите, чтобы изменить порядок
              </span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {activeModules.map(modId => (
                <div key={modId} className="min-h-[176px]">
                  <ActiveModuleCard
                    modId={modId}
                    isDragging={dragId === modId}
                    isOver={overId === modId && dragId !== modId}
                    dragHappened={dragHappened}
                    onDragStart={e => handleDragStart(e, modId)}
                    onDragOver={e => handleDragOver(e, modId)}
                    onDrop={e => handleDrop(e, modId)}
                    onDragEnd={handleDragEnd}
                    onOpen={() => router.push(`/modules/${modId}`)}
                    onRemove={() => removeModule(modId)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Пустое состояние ───────────────────────────────────────────── */}
        {activeModules.length === 0 && (
          <div className="text-center py-16">
            <LayoutGrid className="w-10 h-10 text-text-9 mx-auto mb-4" />
            <p className="text-text font-medium mb-1">Нет подключённых модулей</p>
            <p className="text-text-6 text-sm">Подключите модули из списка ниже</p>
          </div>
        )}

        {/* ── Каталог по категориям ──────────────────────────────────────── */}
        {MODULE_CATEGORIES.map(cat => {
          const mods = ALL_MODULES.filter(m => m.category === cat.id && !activeModules.includes(m.id))
          if (mods.length === 0) return null
          return (
            <section key={cat.id}>
              <h2 className="text-[10px] uppercase tracking-widest mb-3"
                style={{ color: cat.color + 'aa' }}
              >
                {cat.label}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {mods.map(mod => {
                  const isActive = activeModules.includes(mod.id)
                  return (
                    <div key={mod.id} className="min-h-[160px]">
                      <CatalogModuleCard
                        mod={mod}
                        isActive={isActive}
                        onAdd={() => addModule(mod.id)}
                        onOpen={() => router.push(`/modules/${mod.id}`)}
                        onRemove={() => removeModule(mod.id)}
                      />
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
