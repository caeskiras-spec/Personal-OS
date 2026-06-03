'use client'

import { Check } from 'lucide-react'

/**
 * Compact inline subtask checklist.
 * Used by TasksModule (cards) and TodayTasks (home).
 * disabled=true → show read-only (done tasks / completed view).
 */
export default function InlineSubtaskList({ subtasks, onToggle, disabled = false }) {
  if (!subtasks || subtasks.length === 0) return null
  return (
    <div
      className="px-4 pb-3 pt-1 border-t border-border/40"
      onClick={e => e.stopPropagation()}
    >
      {subtasks.map(s => (
        <div key={s.id} className="flex items-center gap-2.5 py-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={e => { e.stopPropagation(); if (!disabled) onToggle(s) }}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              disabled
                ? `opacity-40 cursor-not-allowed ${s.is_done ? 'bg-success/20 border-success' : 'border-muted'}`
                : s.is_done
                  ? 'bg-success/20 border-success cursor-pointer'
                  : 'border-muted hover:border-accent cursor-pointer'
            }`}
          >
            {s.is_done && <Check className="w-2.5 h-2.5 text-success" />}
          </button>
          <span
            className={`text-xs select-none ${
              s.is_done ? 'line-through text-subtle' : disabled ? 'text-subtle' : 'text-text'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {s.title}
          </span>
        </div>
      ))}
    </div>
  )
}
