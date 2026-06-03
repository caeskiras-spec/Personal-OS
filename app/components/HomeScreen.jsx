'use client'

import { useState, useRef } from 'react'
import { useOS } from '../../lib/store'
import { getModuleById } from '../../lib/modules'
import { MODULE_ICONS } from '../../lib/moduleIcons'
import { useRouter } from 'next/navigation'
import TodayTasks from './TodayTasks'
import TodayHabits from './TodayHabits'

export default function HomeScreen() {
  const { activeModules, reorderModules } = useOS()
  const router = useRouter()
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const dragHappened = useRef(false)

  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const hasModule = (id) => activeModules.includes(id)
  const otherIds = activeModules.filter(id => id !== 'tasks' && id !== 'habits')

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
    const from = otherIds.indexOf(dragId)
    const to = otherIds.indexOf(targetId)
    if (from === -1 || to === -1) { resetDrag(); return }
    dragHappened.current = true
    const next = [...otherIds]
    next.splice(from, 1)
    next.splice(to, 0, dragId)
    // preserve tasks/habits at their original positions
    const result = []
    let otherIdx = 0
    for (const id of activeModules) {
      if (id === 'tasks' || id === 'habits') {
        result.push(id)
      } else {
        result.push(next[otherIdx++])
      }
    }
    reorderModules(result)
    resetDrag()
  }

  const handleDragEnd = () => resetDrag()

  const resetDrag = () => {
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <p className="text-subtle text-sm capitalize">{today}</p>
        <h1 className="text-3xl font-bold text-text mt-1">Сегодня</h1>
      </div>

      {activeModules.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center text-3xl">⊞</div>
          <div>
            <p className="text-text font-semibold text-lg">Нет активных модулей</p>
            <p className="text-subtle mt-1">Добавьте модули чтобы начать</p>
          </div>
          <button
            onClick={() => router.push('/modules')}
            className="mt-2 bg-accent hover:bg-accent-light text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Открыть магазин модулей
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {hasModule('tasks') && <TodayTasks />}
          {hasModule('habits') && <TodayHabits />}

          {otherIds.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-widest text-subtle mb-3">Модули</h2>
              <div className="grid grid-cols-2 gap-3">
                {otherIds.map(modId => {
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
                      onClick={() => { if (!dragHappened.current) router.push(`/modules/${modId}`) }}
                      className={`
                        rounded-xl p-4 text-left transition-all select-none
                        cursor-grab active:cursor-grabbing
                        ${isDragging
                          ? 'opacity-30 bg-surface border border-muted scale-[0.97]'
                          : isOver
                            ? 'bg-[#1a1a2e] border border-accent/50 shadow-[0_0_0_1px_rgba(108,99,255,0.2)]'
                            : 'bg-[#1d1d1d] border border-[#333] hover:bg-[#222] hover:border-[#3f3f3f] hover:shadow-[0_2px_12px_rgba(0,0,0,0.4)]'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {(() => { const mi = MODULE_ICONS[modId]; return mi ? <mi.Icon className="w-5 h-5 shrink-0" style={{ color: mi.color }} /> : <span className="text-xl">{mod.icon}</span> })()}
                        <span className="font-medium text-text text-sm">{mod.name}</span>
                      </div>
                      <p className="text-subtle text-xs leading-relaxed">{mod.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
