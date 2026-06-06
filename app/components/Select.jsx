'use client'

import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Custom Select. Replaces all native <select> across the app.
 *
 * options:        [{value, label}] — or [{v, l}], normalized internally.
 * placeholder:    display text for the "empty/all" state (rendered as first item).
 * placeholderValue: value that triggers the placeholder display (default '').
 * compact:        smaller sizing for filter bars.
 */
export default function Select({
  value,
  onChange,
  options: rawOptions = [],
  placeholder,
  placeholderValue = '',
  compact = false,
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect]   = useState(null)
  const triggerRef = useRef(null)
  const dropRef    = useRef(null)
  const uid = useId()

  // Normalize {v, l} → {value, label}
  const options = rawOptions.map(o => ({
    value: o.value !== undefined ? o.value : o.v,
    label: o.label !== undefined ? o.label : o.l,
  }))

  const isPlaceholder = placeholder !== undefined && String(value) === String(placeholderValue)
  const selectedOpt   = isPlaceholder ? null : options.find(o => String(o.value) === String(value))
  const displayLabel  = selectedOpt?.label ?? placeholder ?? '—'

  const captureRect = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
  }, [])

  const openDrop = () => {
    if (disabled) return
    captureRect()
    setOpen(true)
  }

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const fn = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (dropRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  // Update position on scroll / resize while open
  useEffect(() => {
    if (!open) return
    const fn = () => captureRect()
    window.addEventListener('scroll', fn, true)
    window.addEventListener('resize', fn)
    return () => {
      window.removeEventListener('scroll', fn, true)
      window.removeEventListener('resize', fn)
    }
  }, [open, captureRect])

  const pick = (val) => { onChange(val); setOpen(false) }

  const handleKey = (e) => {
    if (disabled) return
    const allOpts = placeholder !== undefined
      ? [{ value: placeholderValue, label: placeholder }, ...options]
      : options
    const idx = allOpts.findIndex(o => String(o.value) === String(value))

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open ? setOpen(false) : openDrop()
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { openDrop(); return }
      const next = allOpts[Math.min(idx + 1, allOpts.length - 1)]
      if (next) onChange(next.value)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { openDrop(); return }
      const prev = allOpts[Math.max(idx - 1, 0)]
      if (prev) onChange(prev.value)
    }
  }

  // Dropdown positioning (portal, fixed) — clamped to viewport width
  let dropStyle = {}
  if (rect) {
    const goUp  = rect.bottom + 244 > window.innerHeight && rect.top > 244
    const dropW = Math.max(rect.width, compact ? 120 : 160)
    const left  = Math.max(8, Math.min(rect.left, window.innerWidth - dropW - 8))
    dropStyle = {
      position: 'fixed',
      zIndex: 9999,
      left,
      width: dropW,
      ...(goUp
        ? { bottom: window.innerHeight - rect.top + 4, maxHeight: Math.min(rect.top - 8, 240) }
        : { top: rect.bottom + 4, maxHeight: Math.min(window.innerHeight - rect.bottom - 8, 240) }),
    }
  }

  const sz       = compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
  const chevSz   = compact ? 'w-3 h-3' : 'w-3.5 h-3.5'
  const itemSz   = compact ? 'text-xs' : 'text-sm'

  const itemCls = (sel) =>
    `w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${itemSz} ` +
    (sel ? 'bg-[#6c63ff]/15 text-[#6c63ff]' : 'text-text-2 hover:bg-muted/40 hover:text-text')

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={uid}
        disabled={disabled}
        onClick={openDrop}
        onKeyDown={handleKey}
        className={`w-full flex items-center justify-between gap-2 bg-bg-2 border rounded-lg transition-colors outline-none
          ${open ? 'border-[#6c63ff]/40' : 'border-border hover:border-border-hover'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${sz}`}
      >
        <span className={`truncate flex-1 text-left ${isPlaceholder ? 'text-text-8' : 'text-text'}`}>
          {displayLabel}
        </span>
        <ChevronDown
          className={`shrink-0 transition-transform duration-200 text-text-6 ${open ? 'rotate-180' : ''} ${chevSz}`}
        />
      </button>

      {/* Portal dropdown */}
      {open && rect && createPortal(
        <div
          ref={dropRef}
          id={uid}
          role="listbox"
          style={{ ...dropStyle, overflowY: 'auto' }}
          className="bg-panel border border-border-1 rounded-xl shadow-2xl animate-fade-in"
        >
          {placeholder !== undefined && (
            <button
              type="button" role="option" aria-selected={isPlaceholder}
              onClick={() => pick(placeholderValue)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${itemSz} ${
                isPlaceholder ? 'bg-[#6c63ff]/15 text-[#6c63ff]' : 'text-text-6 hover:bg-muted/40 hover:text-text'
              }`}
            >
              <span>{placeholder}</span>
              {isPlaceholder && <Check className="w-3 h-3 shrink-0" />}
            </button>
          )}
          {options.map(opt => {
            const sel = !isPlaceholder && String(opt.value) === String(value)
            return (
              <button
                key={String(opt.value)}
                type="button" role="option" aria-selected={sel}
                onClick={() => pick(opt.value)}
                className={itemCls(sel)}
              >
                <span className="truncate">{opt.label}</span>
                {sel && <Check className="w-3 h-3 shrink-0" />}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
