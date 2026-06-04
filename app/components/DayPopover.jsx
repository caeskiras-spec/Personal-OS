'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTHS_G   = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
const WEEKDAYS_F = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']

function fmtDate(date) {
  const dow = (date.getDay() + 6) % 7
  return `${WEEKDAYS_F[dow]}, ${date.getDate()} ${MONTHS_G[date.getMonth()]} ${date.getFullYear()}`
}

function fmtMoney(n) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.abs(n))
}

function fmtDur(m) {
  if (!m) return ''
  const h = Math.floor(m / 60), mn = m % 60
  return h > 0 ? (mn > 0 ? `${h}ч ${mn}м` : `${h}ч`) : `${mn}м`
}

// ─── Smart desktop positioning ────────────────────────────────────────────────

function getBoxStyle(anchor) {
  if (!anchor) return {}
  const POP_W = 288, POP_H = 440, PAD = 8
  const vw = window.innerWidth, vh = window.innerHeight

  // x: prefer right of cell, fall back to left, clamp
  let x = anchor.right + PAD
  if (x + POP_W > vw - PAD) x = anchor.left - POP_W - PAD
  x = Math.max(PAD, Math.min(x, vw - POP_W - PAD))

  // y: align to top of cell, clamp so it doesn't overflow bottom
  let y = anchor.top
  if (y + POP_H > vh - PAD) y = Math.max(PAD, vh - POP_H - PAD)

  return { position: 'fixed', left: x, top: y, width: POP_W, maxHeight: Math.min(POP_H, vh - PAD * 2), zIndex: 9999 }
}

// ─── Section header ───────────────────────────────────────────────────────────

function Section({ color, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[9px] font-bold uppercase tracking-widest text-text-7">{label}</span>
      </div>
      <div className="flex flex-col gap-1 pl-3">{children}</div>
    </div>
  )
}

function Row({ children }) {
  return <div className="flex items-center gap-1.5 min-w-0 flex-wrap">{children}</div>
}

// ─── DayPopover ───────────────────────────────────────────────────────────────
//
// Props:
//   date        Date object for the clicked day
//   dateStr     'YYYY-MM-DD' string
//   today       'YYYY-MM-DD' string for "Сегодня" badge
//   anchor      DOMRect | null (cell bounding rect for desktop positioning)
//   dayData     { tasks, habits, workouts, food, sleep, transactions, goals }
//   onClose     () => void

export default function DayPopover({ date, dateStr, today, anchor, dayData, onClose }) {
  const router   = useRouter()
  const ref      = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  // Close on outside click
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onClose])

  // Close on Esc
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const isEmpty = !dayData.tasks.length && !dayData.habits.length && !dayData.workouts.length
    && !dayData.food && !dayData.sleep && !dayData.transactions.length && !dayData.goals.length

  const boxStyle = isMobile ? {} : getBoxStyle(anchor)

  const content = (
    <>
      {/* Mobile backdrop */}
      {isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      <div
        ref={ref}
        style={boxStyle}
        className={
          isMobile
            ? 'fixed bottom-0 left-0 right-0 z-50 bg-panel border-t border-border-1 rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh] animate-slide-up'
            : 'bg-panel border border-border-1 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in'
        }
      >
        {/* Handle bar — mobile only */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-8 h-1 rounded-full bg-border-2" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-border-1 shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text leading-tight">{fmtDate(date)}</p>
            {dateStr === today && (
              <span className="inline-block mt-1 text-[10px] bg-[#6c63ff]/20 text-[#6c63ff] px-2 py-0.5 rounded-full font-medium">
                Сегодня
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-7 hover:text-text hover:bg-muted/20 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3.5 min-h-0">
          {isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="text-2xl opacity-30">▦</span>
              <p className="text-xs text-text-7">Нет событий в этот день</p>
            </div>
          ) : (
            <>
              {/* Tasks */}
              {dayData.tasks.length > 0 && (
                <Section color="#6c63ff" label="Задачи">
                  {dayData.tasks.map(t => (
                    <Row key={t.id}>
                      <span className={`text-xs leading-snug flex-1 min-w-0 ${t.status === 'done' ? 'line-through text-text-7' : 'text-text-3'}`}>
                        {t.title}
                      </span>
                      {t.priority === 'high' && (
                        <span className="text-[10px] text-[#ef4444] shrink-0">↑</span>
                      )}
                    </Row>
                  ))}
                </Section>
              )}

              {/* Habits */}
              {dayData.habits.length > 0 && (
                <Section color="#8b85ff" label="Привычки">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {dayData.habits.map(h => (
                      <span key={h.id} className="text-xs text-text-3">
                        {h.emoji} {h.name}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Workouts */}
              {dayData.workouts.length > 0 && (
                <Section color="#22c55e" label="Тренировки">
                  {dayData.workouts.map(w => (
                    <Row key={w.id}>
                      <span className="text-xs text-text-3">{w.typeEmoji} {w.typeName}</span>
                      {w.duration > 0 && <span className="text-[10px] text-text-7 shrink-0">· {w.duration} мин</span>}
                      {w.calories  > 0 && <span className="text-[10px] text-text-7 shrink-0">· {w.calories} ккал</span>}
                    </Row>
                  ))}
                </Section>
              )}

              {/* Nutrition */}
              {dayData.food && (
                <Section color="#10b981" label="Питание">
                  <Row>
                    <span className="text-xs text-text-3">🍽️ {Math.round(dayData.food.calories)} ккал</span>
                    <span className="text-[10px] text-text-7 shrink-0">
                      Б {Math.round(dayData.food.protein)}г · Ж {Math.round(dayData.food.fat)}г · У {Math.round(dayData.food.carbs)}г
                    </span>
                  </Row>
                </Section>
              )}

              {/* Sleep */}
              {dayData.sleep && (
                <Section color="#3b82f6" label="Сон">
                  <Row>
                    <span className="text-xs text-text-3">🌙 {fmtDur(dayData.sleep.durationMinutes)}</span>
                    {dayData.sleep.bedtime && dayData.sleep.wakeTime && (
                      <span className="text-[10px] text-text-7 shrink-0">
                        {dayData.sleep.bedtime} → {dayData.sleep.wakeTime}
                      </span>
                    )}
                    {dayData.sleep.quality > 0 && (
                      <span className="text-[10px] text-[#f59e0b] shrink-0">
                        {'★'.repeat(dayData.sleep.quality)}{'☆'.repeat(5 - dayData.sleep.quality)}
                      </span>
                    )}
                  </Row>
                </Section>
              )}

              {/* Finance */}
              {dayData.transactions.length > 0 && (
                <Section color="#f59e0b" label="Финансы">
                  {dayData.transactions.map((t, i) => (
                    <Row key={i}>
                      <span className={`text-xs shrink-0 ${t.type === 'income' ? 'text-[#22c55e]' : 'text-text-3'}`}>
                        {t.type === 'income' ? '+' : '−'}{fmtMoney(t.amount)} ₽
                      </span>
                      {t.note && (
                        <span className="text-[10px] text-text-7 truncate min-w-0">{t.note}</span>
                      )}
                    </Row>
                  ))}
                </Section>
              )}

              {/* Goal deadlines */}
              {dayData.goals.length > 0 && (
                <Section color="#8b5cf6" label="Дедлайны целей">
                  {dayData.goals.map(g => (
                    <Row key={g.id}>
                      <span className="text-xs text-text-3 truncate">{g.icon} {g.title}</span>
                    </Row>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border-1 shrink-0">
          <button
            onClick={() => { router.push('/modules/calendar'); onClose() }}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-[#0891b2] hover:text-[#06b6d4] transition-colors font-medium py-1 rounded-lg hover:bg-[#0891b2]/5"
          >
            Открыть в Календаре
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  )

  return createPortal(content, document.body)
}
