'use client'

import { MODULE_ICONS } from '../../../lib/moduleIcons'

export default function GenericModule({ module: mod }) {
  const mi = MODULE_ICONS[mod.id]
  return (
    <div className="p-8 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: (mi?.color ?? mod.color) + '20' }}
        >
          {mi ? <mi.Icon size={20} style={{ color: mi.color }} /> : <span className="text-xl" style={{ color: mod.color }}>{mod.icon}</span>}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">{mod.name}</h1>
          <p className="text-subtle text-sm">{mod.description}</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <div
          className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
          style={{ background: (mi?.color ?? mod.color) + '20' }}
        >
          {mi ? <mi.Icon size={28} style={{ color: mi.color }} /> : <span className="text-3xl" style={{ color: mod.color }}>{mod.icon}</span>}
        </div>
        <p className="text-text font-medium mb-2">Модуль в разработке</p>
        <p className="text-subtle text-sm">Этот модуль будет доступен в следующем обновлении</p>
      </div>
    </div>
  )
}