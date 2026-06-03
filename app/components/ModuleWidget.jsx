'use client'
import { useRouter } from 'next/navigation'
import { ArrowRight, MoreHorizontal } from 'lucide-react'
import ModuleIcon from './ModuleIcon'

const WIDGET_DATA = {
  fitness: { metric: '0 тренировок', sub: 'На этой неделе', progress: 0 },
  nutrition: { metric: '0 ккал', sub: 'Сегодня', progress: 0 },
  sleep: { metric: '— ч', sub: 'Прошлой ночью', progress: 0 },
  tasks: { metric: '0 задач', sub: 'Активных', progress: 0 },
  finance: { metric: '—', sub: 'Баланс', progress: 0 },
  habits: { metric: '0/0', sub: 'Привычек сегодня', progress: 0 },
  goals: { metric: '0', sub: 'Целей активно', progress: 0 },
  journal: { metric: '0 записей', sub: 'На этой неделе', progress: 0 },
  learning: { metric: '0%', sub: 'Прогресс обучения', progress: 0 },
  projects: { metric: '0', sub: 'Проектов активно', progress: 0 },
  calendar: { metric: '0', sub: 'Событий сегодня', progress: 0 },
  mindfulness: { metric: '0 мин', sub: 'Медитировал сегодня', progress: 0 },
}

export default function ModuleWidget({ module }) {
  const router = useRouter()
  const data = WIDGET_DATA[module.id] || { metric: '—', sub: 'Нет данных', progress: 0 }

  return (
    <div
      className="bg-os-surface border border-os-border rounded-xl p-5 cursor-pointer transition-all duration-200 hover:border-current group module-card"
      style={{ '--tw-border-opacity': 1 }}
      onClick={() => router.push(`/modules/${module.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${module.color}18` }}
        >
          <ModuleIcon iconName={module.icon} color={module.color} size={20} />
        </div>
        <button className="p-1 rounded-md text-os-muted hover:text-os-text opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal size={14} />
        </button>
      </div>

      <div className="mb-3">
        <div
          className="text-2xl font-bold font-mono stat-value mb-0.5"
          style={{ color: module.color }}
        >
          {data.metric}
        </div>
        <div className="text-xs text-os-subtext">{data.sub}</div>
      </div>

      <div className="mb-3">
        <div className="w-full h-1 bg-os-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${data.progress}%`, background: module.color }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs font-medium" style={{ color: module.color }}>
          {module.name}
        </div>
        <ArrowRight
          size={12}
          className="text-os-muted group-hover:translate-x-1 transition-transform"
          style={{ color: module.color }}
        />
      </div>
    </div>
  )
}