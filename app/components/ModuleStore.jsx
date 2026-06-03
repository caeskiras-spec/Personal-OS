'use client'

import { useState } from 'react'
import { useOS } from '../../lib/store'
import { ALL_MODULES, MODULE_CATEGORIES, getModuleById } from '../../lib/modules'
import { MODULE_ICONS } from '../../lib/moduleIcons'
import { useRouter } from 'next/navigation'
import { GripVertical } from 'lucide-react'

export default function ModuleStore() {
  const { activeModules, addModule, removeModule, reorderModules } = useOS()
  const router = useRouter()
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  const handleDragStart = (e, id) => {
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
    const to = activeModules.indexOf(targetId)
    if (from === -1 || to === -1) { resetDrag(); return }
    const next = [...activeModules]
    next.splice(from, 1)
    next.splice(to, 0, dragId)
    reorderModules(next)
    resetDrag()
  }

  const handleDragEnd = () => resetDrag()
  const resetDrag = () => { setDragId(null); setOverId(null) }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text">Модули</h1>
        <p className="text-subtle mt-1">Подключите нужные области жизни</p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Мои модули — draggable active list */}
        {activeModules.length > 0 && (
          <div>
            <h2 className="text-xs uppercase tracking-widest text-subtle mb-3">Мои модули</h2>
            <div className="flex flex-col gap-2">
              {activeModules.map(modId => {
                const mod = getModuleById(modId)
                if (!mod) return null
                const isDragging = dragId === modId
                const isOver = overId === modId && dragId !== modId
                return (
                  <div
                    key={modId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, modId)}
                    onDragOver={(e) => handleDragOver(e, modId)}
                    onDrop={(e) => handleDrop(e, modId)}
                    onDragEnd={handleDragEnd}
                    className={`
                      flex items-center gap-3 p-4 rounded-xl border transition-all
                      cursor-grab active:cursor-grabbing select-none
                      ${isDragging
                        ? 'opacity-30 bg-surface border-muted scale-[0.98]'
                        : isOver
                          ? 'bg-[#1a1a2e] border-accent/50 shadow-[0_0_0_1px_rgba(108,99,255,0.2)]'
                          : 'bg-[#1d1d1d] border-[#333] hover:bg-[#222] hover:border-[#3f3f3f]'
                      }
                    `}
                  >
                    <GripVertical size={16} className="text-subtle opacity-50 shrink-0" />
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: mod.color + '20' }}
                    >
                      {(() => { const mi = MODULE_ICONS[mod.id]; return mi ? <mi.Icon className="w-4 h-4" style={{ color: mi.color }} /> : <span style={{ color: mod.color }}>{mod.icon}</span> })()}
                    </div>
                    <span className="flex-1 font-medium text-text text-sm">{mod.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); router.push(`/modules/${modId}`) }}
                        className="text-xs text-accent hover:text-accent-light px-3 py-1.5 rounded-lg border border-accent/30 hover:border-accent/60 transition-colors"
                      >
                        Открыть
                      </button>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); removeModule(modId) }}
                        className="text-xs text-danger/70 hover:text-danger px-3 py-1.5 rounded-lg border border-danger/20 hover:border-danger/40 transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Все модули по категориям */}
        {MODULE_CATEGORIES.map(cat => {
          const mods = ALL_MODULES.filter(m => m.category === cat.id)
          return (
            <div key={cat.id}>
              <h2 className="text-xs uppercase tracking-widest text-subtle mb-3">{cat.label}</h2>
              <div className="flex flex-col gap-2">
                {mods.map(mod => {
                  const isActive = activeModules.includes(mod.id)
                  return (
                    <div
                      key={mod.id}
                      className="flex items-center gap-4 p-4 bg-[#1d1d1d] border border-[#333] rounded-xl hover:bg-[#222] hover:border-[#3f3f3f] transition-all"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: mod.color + '20' }}
                      >
                        {(() => { const mi = MODULE_ICONS[mod.id]; return mi ? <mi.Icon className="w-5 h-5" style={{ color: mi.color }} /> : <span style={{ color: mod.color }}>{mod.icon}</span> })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text text-sm">{mod.name}</div>
                        <div className="text-subtle text-xs mt-0.5">{mod.description}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isActive && (
                          <button
                            onClick={() => router.push(`/modules/${mod.id}`)}
                            className="text-xs text-accent hover:text-accent-light px-3 py-1.5 rounded-lg border border-accent/30 hover:border-accent/60 transition-colors"
                          >
                            Открыть
                          </button>
                        )}
                        <button
                          onClick={() => isActive ? removeModule(mod.id) : addModule(mod.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            isActive
                              ? 'text-danger/70 hover:text-danger border border-danger/20 hover:border-danger/40 hover:bg-danger/5'
                              : 'text-white bg-accent hover:bg-accent-light'
                          }`}
                        >
                          {isActive ? 'Удалить' : 'Добавить'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
