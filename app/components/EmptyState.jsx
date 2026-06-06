'use client'

import { MODULE_ICONS } from '../../lib/moduleIcons'

/**
 * Unified empty-state block used across all modules.
 *
 * Props:
 *   modId        — module id: auto-resolves icon + color from MODULE_ICONS
 *   icon         — Lucide icon component (overrides modId icon)
 *   iconColor    — hex color string (overrides modId color)
 *   title        — main heading (required)
 *   description  — secondary help text (optional)
 *   actionLabel  — primary CTA button label (optional)
 *   onAction     — primary CTA handler (optional)
 *   compact      — reduced padding/size for tight spaces (default false)
 *
 * Three canonical uses:
 *   1. No data yet       → title + description + actionLabel/onAction
 *   2. No filter results → title="Ничего не найдено" + actionLabel="Сбросить фильтры"
 *   3. Compact (widget)  → compact=true, minimal padding
 */
export default function EmptyState({
  modId,
  icon: IconProp,
  iconColor,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}) {
  const mi    = modId ? MODULE_ICONS[modId] : null
  const Icon  = IconProp ?? mi?.Icon
  const color = iconColor ?? mi?.color ?? 'var(--color-text-7)'

  return (
    <div className={`flex flex-col items-center text-center w-full
      ${compact ? 'gap-2 py-6' : 'gap-4 py-16'}`}>

      {Icon && (
        <div
          className={`rounded-2xl flex items-center justify-center shrink-0
            ${compact ? 'w-10 h-10' : 'w-14 h-14'}`}
          style={{ background: color + '20' }}
        >
          <Icon
            className={compact ? 'w-4 h-4' : 'w-6 h-6'}
            style={{ color }}
          />
        </div>
      )}

      <div className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-1.5'}`}>
        <p className={`font-semibold text-text ${compact ? 'text-sm' : 'text-base'}`}>
          {title}
        </p>
        {description && (
          <p className={`text-text-7 ${compact ? 'text-xs' : 'text-sm'}`}>
            {description}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={`font-medium rounded-xl transition-opacity hover:opacity-75
            ${compact ? 'px-3 py-1.5 text-xs mt-0' : 'px-5 py-2.5 text-sm mt-1'}`}
          style={{ background: color + '20', color }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
