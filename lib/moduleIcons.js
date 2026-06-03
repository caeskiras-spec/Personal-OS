import {
  CheckSquare, RefreshCw, Zap, Utensils, Moon,
  Wallet, BookOpen, Target, Timer, FolderKanban, CalendarDays,
} from 'lucide-react'

/**
 * Map of moduleId → { Icon, color }
 * Color matches lib/modules.js — single source of truth.
 */
export const MODULE_ICONS = {
  tasks:     { Icon: CheckSquare,  color: '#6c63ff' },
  habits:    { Icon: RefreshCw,    color: '#8b85ff' },
  fitness:   { Icon: Zap,          color: '#22c55e' },
  nutrition: { Icon: Utensils,     color: '#10b981' },
  sleep:     { Icon: Moon,         color: '#3b82f6' },
  finance:   { Icon: Wallet,       color: '#f59e0b' },
  journal:   { Icon: BookOpen,     color: '#ec4899' },
  goals:     { Icon: Target,       color: '#8b5cf6' },
  focus:     { Icon: Timer,        color: '#f97316' },
  projects:  { Icon: FolderKanban, color: '#06b6d4' },
  calendar:  { Icon: CalendarDays, color: '#0891b2' },
}

/** Renders the module icon as a React element, or null if unknown */
export function ModuleIcon({ moduleId, size = 16, className = '', style = {} }) {
  const entry = MODULE_ICONS[moduleId]
  if (!entry) return null
  const { Icon, color } = entry
  return <Icon width={size} height={size} className={className} style={{ color, ...style }} />
}
