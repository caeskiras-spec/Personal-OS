'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '../../lib/theme'

const MODES = [
  { key: 'dark',   label: 'Тёмная',   Icon: Moon    },
  { key: 'light',  label: 'Светлая',  Icon: Sun     },
  { key: 'system', label: 'Системная',Icon: Monitor  },
]

export default function ThemeSwitcher({ compact = false }) {
  const { theme, setTheme } = useTheme()

  if (compact) {
    // 3-сегментный переключатель (для ProfilePanel)
    return (
      <div className="flex gap-1 bg-bg-2 rounded-xl p-0.5">
        {MODES.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTheme(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              theme === key
                ? 'bg-card text-text shadow-sm'
                : 'text-text-6 hover:text-text'
            }`}
          >
            <Icon className="w-3 h-3 shrink-0" />
            {label}
          </button>
        ))}
      </div>
    )
  }

  // Полный вид (для Настроек)
  return (
    <div className="flex flex-col gap-1.5">
      {MODES.map(({ key, label, Icon }) => {
        const active = theme === key
        return (
          <button key={key} onClick={() => setTheme(key)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
              active
                ? 'bg-card border-border-2 text-text'
                : 'border-transparent text-text-6 hover:bg-card hover:border-border'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              active ? 'bg-accent/10' : 'bg-surface-2'
            }`}>
              <Icon className="w-4 h-4" style={{ color: active ? '#6c63ff' : undefined }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-text-7 mt-0.5">
                {key === 'dark'   ? 'Всегда тёмный интерфейс'   :
                 key === 'light'  ? 'Всегда светлый интерфейс'  :
                 'Следовать настройке ОС'}
              </p>
            </div>
            {active && (
              <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
            )}
          </button>
        )
      })}
    </div>
  )
}
