'use client'

/**
 * SidePanel — адаптивная боковая панель для модулей.
 *
 * Мобила (< md): full-screen overlay поверх контента + backdrop для закрытия.
 * Десктоп (>= md): фиксированной ширины flex-sibling в потоке документа.
 *
 * panelClass — Tailwind-классы для ширины на десктопе (напр. "md:w-[420px]").
 * onClose    — вызывается при тапе по backdrop (мобила).
 */
export default function SidePanel({ children, panelClass = 'md:w-[420px]', onClose }) {
  return (
    <>
      {/* Мобильный backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden"
        onClick={onClose}
        aria-hidden
      />
      {/* Панель: full-screen на мобиле, fixed-width на десктопе */}
      <div className={`
        fixed inset-0 z-50 flex flex-col overflow-hidden bg-panel
        md:relative md:inset-auto md:z-auto
        md:shrink-0 md:border-l md:border-surface md:h-full
        ${panelClass}
      `}>
        {children}
      </div>
    </>
  )
}
