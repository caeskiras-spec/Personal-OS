'use client'

import { useOS } from '../../lib/store'
import { getModuleById } from '../../lib/modules'
import { MODULE_ICONS } from '../../lib/moduleIcons'

export default function AnalyticsScreen() {
  const { activeModules } = useOS()

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text">Аналитика</h1>
        <p className="text-subtle mt-1">Прогресс по вашим активностям</p>
      </div>

      {activeModules.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-subtle">Добавьте модули для отображения аналитики</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-xs uppercase tracking-widest text-subtle mb-2">Активных модулей</p>
              <p className="text-4xl font-bold text-accent">{activeModules.length}</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-xs uppercase tracking-widest text-subtle mb-2">Дней в системе</p>
              <p className="text-4xl font-bold text-text">1</p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <p className="text-xs uppercase tracking-widest text-subtle mb-4">Подключённые модули</p>
            <div className="flex flex-wrap gap-2">
              {activeModules.map(modId => {
                const mod = getModuleById(modId)
                if (!mod) return null
                return (
                  <div
                    key={modId}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-sm"
                  >
                    {(() => { const mi = MODULE_ICONS[modId]; return mi ? <mi.Icon className="w-3.5 h-3.5 shrink-0" style={{ color: mi.color }} /> : <span style={{ color: mod.color }}>{mod.icon}</span> })()}
                    <span className="text-text text-sm">{mod.name}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 text-center">
            <p className="text-subtle text-sm">Детальная аналитика появится после накопления данных</p>
            <p className="text-muted text-xs mt-1">Продолжайте использовать систему ежедневно</p>
          </div>
        </div>
      )}
    </div>
  )
}