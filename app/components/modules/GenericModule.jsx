'use client'

export default function GenericModule({ module: mod }) {
  return (
    <div className="p-8 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ backgroundColor: mod.color + '20', color: mod.color }}
        >
          {mod.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">{mod.name}</h1>
          <p className="text-subtle text-sm">{mod.description}</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <div
          className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4"
          style={{ backgroundColor: mod.color + '20', color: mod.color }}
        >
          {mod.icon}
        </div>
        <p className="text-text font-medium mb-2">Модуль в разработке</p>
        <p className="text-subtle text-sm">Этот модуль будет доступен в следующем обновлении</p>
      </div>
    </div>
  )
}