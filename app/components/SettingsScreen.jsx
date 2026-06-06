'use client'

import { useOS } from '../../lib/store'
import { useAuth } from '../../lib/auth'
import { useRouter } from 'next/navigation'
import ThemeSwitcher from './ThemeSwitcher'

export default function SettingsScreen() {
  const { resetOS } = useOS()
  const { signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    resetOS()
    await signOut()
    router.replace('/auth')
  }

  const handleReset = () => {
    if (confirm('Сбросить систему? Все данные будут удалены.')) {
      resetOS()
      router.push('/')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text">Настройки</h1>
        <p className="text-subtle mt-1">Управление системой</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs uppercase tracking-widest text-subtle">Система</p>
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium text-text">Версия</p>
              <p className="text-xs text-subtle mt-0.5">Personal OS MVP</p>
            </div>
            <span className="text-xs text-subtle bg-muted/30 px-2 py-1 rounded">v0.1.0</span>
          </div>

          <div className="px-5 py-4 border-t border-border">
            <p className="text-sm font-medium text-text mb-3">Тема</p>
            <ThemeSwitcher />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs uppercase tracking-widest text-subtle">Данные</p>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-between px-5 py-4 text-text hover:bg-surface/80 transition-colors text-left border-b border-border"
          >
            <div>
              <p className="text-sm font-medium">Выйти из аккаунта</p>
              <p className="text-xs text-subtle mt-0.5">Сессия завершится, данные останутся</p>
            </div>
            <span className="text-xs text-subtle">→</span>
          </button>

          <button
            onClick={handleReset}
            className="w-full flex items-center justify-between px-5 py-4 text-danger hover:bg-danger/5 transition-colors text-left"
          >
            <div>
              <p className="text-sm font-medium">Сбросить систему</p>
              <p className="text-xs text-subtle mt-0.5">Удалить все данные и начать заново</p>
            </div>
            <span className="text-xs">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}