'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import EmptyState from '../EmptyState'
import {
  Plus, X, AlertCircle, ChevronLeft, ChevronRight,
  Trash2, Edit2, Upload, Check,
} from 'lucide-react'
import { useOS }                from '../../../lib/store'
import { MODULE_ICONS }         from '../../../lib/moduleIcons'
import { transactionsRepo }     from '../../../lib/db/transactions'
import { financeCategoriesRepo } from '../../../lib/db/financeCategories'
import { financeBudgetsRepo }   from '../../../lib/db/financeBudgets'
import { getTodayStr }          from '../../../lib/tasks-selectors'
import DatePicker               from './DatePicker'
import {
  findCategory,
  getPeriodSummary,
  getExpenseByCategory,
  getBudgetUsage,
  sortTransactions,
  groupTransactionsByDate,
} from '../../../lib/finance-selectors'

// ─── constants ────────────────────────────────────────────────────────────────

const ACCENT       = '#f59e0b'
const INCOME_COLOR = '#22c55e'
const EXPENSE_COLOR= '#ef4444'

const MONTHS_RU   = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

const CAT_COLORS = ['#f59e0b','#ef4444','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#10b981','#6c63ff','#f97316']
const CAT_EMOJIS = ['🍕','🚗','🏠','🎉','💊','💰','📦','🛒','✈️','📚','👕','💡','🎵','🍺','💻','🐾']

// ─── import stub ──────────────────────────────────────────────────────────────
// Future: replace with real bank statement parser.
// Points of extension:
//   (a) Anti-duplicate: compute buildImportHash(date, amount, description) per row,
//       skip if transaction with that import_hash already exists.
//   (b) Auto-categorisation: match description keywords to category names/ids.
//   (c) Tag as 'essential'/'optional' for savings advice UI.
async function parseStatement(_file) {
  return { status: 'in_development' }
}

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const today     = getTodayStr()
  const yestDate  = new Date(today + 'T00:00:00'); yestDate.setDate(yestDate.getDate() - 1)
  const yesterday = localStr(yestDate)
  if (dateStr === today)     return 'Сегодня'
  if (dateStr === yesterday) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function fmtMoney(n) {
  return Math.round(n).toLocaleString('ru-RU')
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-card border border-border-2 rounded-xl px-4 py-3 shadow-lg animate-slide-up">
      <AlertCircle className="w-4 h-4 text-warning shrink-0" />
      <span className="text-sm text-text">{msg}</span>
      <button onClick={onClose} className="text-subtle hover:text-text ml-1 transition-colors"><X className="w-3 h-3" /></button>
    </div>
  )
}

// ─── Finance Calendar ─────────────────────────────────────────────────────────

function FinanceCalendar({ transactions, selectedDate, onSelectDate }) {
  const today = getTodayStr()
  const [viewing, setViewing] = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }
  })

  const prevMonth = () => setViewing(v => ({ month: v.month === 0 ? 11 : v.month - 1, year: v.month === 0 ? v.year - 1 : v.year }))
  const nextMonth = () => setViewing(v => ({ month: v.month === 11 ? 0  : v.month + 1, year: v.month === 11 ? v.year + 1 : v.year }))

  const cells = useMemo(() => {
    const { year, month } = viewing
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
    const lastDay  = new Date(year, month + 1, 0).getDate()
    const out = []
    for (let i = 0; i < firstDow; i++) out.push(null)
    for (let d = 1; d <= lastDay; d++) out.push(new Date(year, month, d))
    return out
  }, [viewing])

  // Build per-date totals for dot colors
  const dateInfo = useMemo(() => {
    const map = {}
    for (const t of transactions) {
      if (!t.date) continue
      if (!map[t.date]) map[t.date] = { expense: 0, income: 0 }
      if (t.type === 'expense') map[t.date].expense += t.amount
      if (t.type === 'income')  map[t.date].income  += t.amount
    }
    return map
  }, [transactions])

  return (
    <div className="bg-card border border-border-2 rounded-xl p-4 select-none shrink-0" style={{ width: 220 }}>
      <p className="text-[10px] text-subtle uppercase tracking-wider mb-3">Календарь</p>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 text-subtle hover:text-text transition-colors rounded">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-text">{MONTHS_RU[viewing.month]} {viewing.year}</span>
        <button type="button" onClick={nextMonth} className="p-1 text-subtle hover:text-text transition-colors rounded">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-0.5">
        {WEEKDAYS_RU.map(d => <div key={d} className="text-center text-[9px] text-subtle py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="h-8" />
          const ds         = localStr(date)
          const isToday    = ds === today
          const isSelected = ds === selectedDate
          const info       = dateInfo[ds]
          return (
            <button key={ds} type="button" onClick={() => onSelectDate(ds)}
              className={`h-8 w-full flex flex-col items-center justify-center rounded-lg transition-colors
                ${isToday ? 'bg-[#f59e0b]/10' : ''}
                ${isSelected ? 'ring-1 ring-[#f59e0b]/60' : ''}
                hover:bg-muted/30 cursor-pointer`}
            >
              <span className={`text-[10px] font-medium leading-none ${isToday ? 'text-[#f59e0b]' : 'text-subtle'}`}>
                {date.getDate()}
              </span>
              {info && (
                <span
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: info.expense > 0 ? EXPENSE_COLOR : INCOME_COLOR }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Category Picker ──────────────────────────────────────────────────────────

function CategoryPicker({ categories, selectedId, txType, onSelect }) {
  const filtered = categories.filter(c => c.kind === txType || c.kind === 'both')
  return (
    <div className="flex flex-wrap gap-1.5">
      {filtered.map(c => {
        const active = selectedId === c.id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(active ? null : c.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={active ? {
              backgroundColor: c.color + '25',
              color:           c.color,
              outline:         `1.5px solid ${c.color}50`,
            } : {
              backgroundColor: 'rgba(58,58,58,0.35)',
              color:           '#ccc',
            }}
          >
            <span>{c.emoji}</span>
            <span>{c.name}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Transaction Form ─────────────────────────────────────────────────────────

const EMPTY_FORM = { type: 'expense', amount: '', categoryId: null, note: '', date: '' }

function TransactionForm({ categories, selectedDate, onAdd, onClose }) {
  const [f, setF] = useState({ ...EMPTY_FORM, date: selectedDate })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!f.amount || !f.date) return
    onAdd({ type: f.type, amount: parseFloat(f.amount), categoryId: f.categoryId, note: f.note, date: f.date })
    onClose()
  }

  return (
    <div className="bg-card border border-border-2 rounded-xl p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text">Новая транзакция</span>
        <button onClick={onClose} className="text-subtle hover:text-text transition-colors"><X className="w-4 h-4" /></button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Type toggle */}
        <div className="flex gap-2">
          {[{ v: 'expense', l: 'Расход' }, { v: 'income', l: 'Доход' }].map(({ v, l }) => (
            <button
              key={v} type="button"
              onClick={() => { set('type', v); set('categoryId', null) }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                f.type === v
                  ? v === 'expense' ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#22c55e]/20 text-[#22c55e]'
                  : 'bg-muted/30 text-subtle hover:text-text'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Amount + Date */}
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <input
              autoFocus
              type="number" min="0" step="0.01"
              value={f.amount}
              onChange={e => set('amount', e.target.value)}
              placeholder="0.00"
              className="w-full bg-bg border border-border-2 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-[#f59e0b]/50 transition-colors pr-8"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle text-sm">₽</span>
          </div>
          <DatePicker value={f.date} onChange={v => set('date', v || getTodayStr())} noOverdue />
        </div>

        {/* Category */}
        <div>
          <span className="text-[10px] text-subtle uppercase tracking-wider block mb-1.5">Категория</span>
          <CategoryPicker
            categories={categories}
            selectedId={f.categoryId}
            txType={f.type}
            onSelect={id => set('categoryId', id)}
          />
        </div>

        {/* Note */}
        <input
          type="text"
          value={f.note}
          onChange={e => set('note', e.target.value)}
          placeholder="Заметка (необязательно)"
          className="w-full bg-bg border border-border-2 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-[#f59e0b]/50 transition-colors placeholder:text-subtle"
        />

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!f.amount || !f.date}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
            style={{ backgroundColor: ACCENT + '30', color: ACCENT }}
          >
            Сохранить
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-subtle hover:text-text text-sm transition-colors">
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Transaction Card ─────────────────────────────────────────────────────────

function TransactionCard({ tx, categories, onRemove, onUpdate }) {
  const [expanded,   setExpanded]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [ef, setEf] = useState(null)

  const cat = findCategory(categories, tx.categoryId)
  const isIncome = tx.type === 'income'

  const startEdit = () => {
    setEf({ type: tx.type, amount: String(tx.amount), categoryId: tx.categoryId, note: tx.note ?? '', date: tx.date })
    setEditing(true)
  }

  const saveEdit = (e) => {
    e.preventDefault()
    onUpdate(tx.id, { type: ef.type, amount: parseFloat(ef.amount) || 0, categoryId: ef.categoryId, note: ef.note, date: ef.date })
    setEditing(false); setExpanded(false)
  }

  const setEfF = (k, v) => setEf(p => ({ ...p, [k]: v }))

  return (
    <div className="bg-card border border-border-2 rounded-xl overflow-hidden hover:border-border-hover transition-all">
      {/* Row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => { if (!editing) setExpanded(e => !e) }}>
        {/* Category emoji */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base"
          style={{ backgroundColor: (cat?.color ?? '#888') + '22' }}
        >
          {cat?.emoji ?? '📦'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text truncate">
              {tx.note || cat?.name || (isIncome ? 'Доход' : 'Расход')}
            </span>
            {cat && !tx.note && null}
            {tx.note && cat && (
              <span className="text-[10px] text-subtle shrink-0">{cat.name}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-subtle">{fmtDate(tx.date)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={`font-semibold text-sm ${isIncome ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {isIncome ? '+' : '−'}{fmtMoney(tx.amount)} ₽
          </span>
          <div onClick={e => e.stopPropagation()}>
            {confirmDel ? (
              <div className="flex items-center gap-1 text-xs">
                <button onClick={() => onRemove(tx.id)} className="text-danger font-medium px-1">Да</button>
                <button onClick={() => setConfirmDel(false)} className="text-subtle px-1">Нет</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="p-1 text-subtle hover:text-danger transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded: view or edit */}
      {expanded && !editing && (
        <div className="px-4 pb-3 border-t border-border pt-3 animate-slide-up">
          {tx.note && <p className="text-xs text-subtle mb-2">{tx.note}</p>}
          <button onClick={startEdit} className="text-xs hover:opacity-80 transition-opacity" style={{ color: ACCENT }}>
            Редактировать
          </button>
        </div>
      )}
      {expanded && editing && ef && (
        <form onSubmit={saveEdit} className="px-4 pb-3 border-t border-border pt-3 flex flex-col gap-2 animate-slide-up">
          <div className="flex gap-2">
            {[{ v: 'expense', l: 'Расход' }, { v: 'income', l: 'Доход' }].map(({ v, l }) => (
              <button key={v} type="button" onClick={() => { setEfF('type', v); setEfF('categoryId', null) }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  ef.type === v
                    ? v === 'expense' ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#22c55e]/20 text-[#22c55e]'
                    : 'bg-muted/30 text-subtle hover:text-text'
                }`}
              >{l}</button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <input type="number" min="0" step="0.01" value={ef.amount}
              onChange={e => setEfF('amount', e.target.value)}
              className="flex-1 bg-bg border border-border-2 rounded px-2 py-1.5 text-xs text-text outline-none focus:border-[#f59e0b]/50"
            />
            <DatePicker value={ef.date} onChange={v => setEfF('date', v || getTodayStr())} noOverdue />
          </div>
          <CategoryPicker
            categories={categories}
            selectedId={ef.categoryId}
            txType={ef.type}
            onSelect={id => setEfF('categoryId', id)}
          />
          <input type="text" value={ef.note} onChange={e => setEfF('note', e.target.value)}
            placeholder="Заметка"
            className="w-full bg-bg border border-border-2 rounded px-2 py-1.5 text-xs text-text outline-none placeholder:text-subtle focus:border-[#f59e0b]/50"
          />
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 text-xs rounded-lg transition-colors" style={{ backgroundColor: ACCENT + '25', color: ACCENT }}>Сохранить</button>
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-subtle hover:text-text transition-colors">Отмена</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Period Stats Card ────────────────────────────────────────────────────────

function PeriodStats({ transactions, period, onPeriodChange }) {
  const summary = useMemo(() => getPeriodSummary(transactions, period), [transactions, period])

  return (
    <div className="bg-card border border-border-2 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-subtle uppercase tracking-wider">Сводка</span>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-0.5">
          {[{ v: 'week', l: 'Неделя' }, { v: 'month', l: 'Месяц' }].map(({ v, l }) => (
            <button key={v} onClick={() => onPeriodChange(v)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${period === v ? 'text-[#f59e0b]' : 'text-subtle hover:text-text'}`}
              style={period === v ? { backgroundColor: ACCENT + '20' } : {}}
            >{l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-0.5 text-center">
          <span className="text-[10px] text-subtle uppercase tracking-wider">Доходы</span>
          <span className="text-lg font-bold text-[#22c55e]">+{fmtMoney(summary.income)}</span>
          <span className="text-[10px] text-subtle">₽</span>
        </div>
        <div className="flex flex-col gap-0.5 text-center">
          <span className="text-[10px] text-subtle uppercase tracking-wider">Расходы</span>
          <span className="text-lg font-bold text-[#ef4444]">−{fmtMoney(summary.expense)}</span>
          <span className="text-[10px] text-subtle">₽</span>
        </div>
        <div className="flex flex-col gap-0.5 text-center">
          <span className="text-[10px] text-subtle uppercase tracking-wider">Баланс</span>
          <span className={`text-lg font-bold ${summary.net >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {summary.net < 0 ? '−' : ''}{fmtMoney(Math.abs(summary.net))}
          </span>
          <span className="text-[10px] text-subtle">₽</span>
        </div>
      </div>
    </div>
  )
}

// ─── Expense Breakdown ────────────────────────────────────────────────────────

function ExpenseBreakdown({ transactions, categories, period }) {
  const summary = useMemo(() => getPeriodSummary(transactions, period), [transactions, period])
  const breakdown = useMemo(() => getExpenseByCategory(summary.transactions, summary.expense), [summary])

  if (breakdown.length === 0) return (
    <div className="bg-card border border-border-2 rounded-xl p-4">
      <p className="text-[10px] text-subtle uppercase tracking-wider mb-2">Расходы по категориям</p>
      <p className="text-xs text-subtle text-center py-4">Нет расходов</p>
    </div>
  )

  return (
    <div className="bg-card border border-border-2 rounded-xl p-4">
      <p className="text-[10px] text-subtle uppercase tracking-wider mb-3">Расходы по категориям</p>
      <div className="flex flex-col gap-2">
        {breakdown.map(({ categoryId, total, pct }) => {
          const cat = findCategory(categories, categoryId)
          return (
            <div key={categoryId} className="flex items-center gap-2">
              <span className="text-base leading-none shrink-0">{cat?.emoji ?? '📦'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-text truncate">{cat?.name ?? 'Прочее'}</span>
                  <span className="text-xs text-[#ef4444] font-medium shrink-0 ml-2">
                    −{fmtMoney(total)} ₽
                  </span>
                </div>
                <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(pct * 100, 100)}%`, backgroundColor: cat?.color ?? '#888' }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Budgets Panel ────────────────────────────────────────────────────────────

function BudgetsPanel({ transactions, categories, budgets, userId, onBudgetsChange, showToast }) {
  const [editId,    setEditId]    = useState(null)
  const [editVal,   setEditVal]   = useState('')

  const expenseCategories = categories.filter(c => c.kind === 'expense' || c.kind === 'both')

  const saveBudget = async (categoryId) => {
    const limit = parseFloat(editVal) || 0
    const prev  = [...budgets]
    // Optimistic update
    const existing = budgets.find(b => b.categoryId === categoryId)
    if (existing) {
      onBudgetsChange(budgets.map(b => b.categoryId === categoryId ? { ...b, monthlyLimit: limit } : b))
    } else {
      onBudgetsChange([...budgets, { id: `tmp-${Date.now()}`, userId, categoryId, monthlyLimit: limit }])
    }
    setEditId(null)
    try {
      const saved = await financeBudgetsRepo.upsert(userId, categoryId, limit)
      onBudgetsChange(prev.map(b => b.categoryId === categoryId ? saved : b).concat(
        prev.find(b => b.categoryId === categoryId) ? [] : [saved]
      ))
    } catch(e) {
      onBudgetsChange(prev); showToast('Не удалось сохранить бюджет')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {expenseCategories.map(cat => {
        const usage = getBudgetUsage(transactions, budgets, cat.id)
        const isEditing = editId === cat.id
        return (
          <div key={cat.id} className="bg-card border border-border-2 rounded-xl p-4 hover:border-border-hover transition-all">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-base leading-none">{cat.emoji}</span>
              <span className="flex-1 text-sm font-medium text-text">{cat.name}</span>

              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type="number" min="0" step="100"
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveBudget(cat.id); if (e.key === 'Escape') setEditId(null) }}
                    className="w-24 bg-bg border border-[#f59e0b]/50 rounded px-2 py-1 text-xs text-text outline-none"
                    placeholder="Лимит ₽"
                  />
                  <button onClick={() => saveBudget(cat.id)} className="text-[#f59e0b] hover:opacity-80 transition-opacity">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditId(null)} className="text-subtle hover:text-text transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditId(cat.id); setEditVal(usage.limit > 0 ? String(usage.limit) : '') }}
                  className="text-subtle hover:text-text transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {usage.limit > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className={usage.over ? 'text-[#ef4444] font-medium' : 'text-subtle'}>
                    {fmtMoney(usage.spent)} ₽
                    {usage.over && <span className="ml-1 text-[10px] bg-[#ef4444]/15 text-[#ef4444] px-1.5 py-0.5 rounded font-medium">Превышен</span>}
                  </span>
                  <span className="text-subtle">{fmtMoney(usage.limit)} ₽</span>
                </div>
                <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(usage.pct * 100, 100)}%`,
                      backgroundColor: usage.over ? '#ef4444' : (usage.pct > 0.8 ? '#f59e0b' : cat.color),
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-[10px] text-subtle">Лимит не задан · {fmtMoney(usage.spent)} ₽ потрачено</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Categories Panel ─────────────────────────────────────────────────────────

// Names of seeded defaults — used to mark them as read-only in UI
const SEEDED_NAMES = new Set(['Еда','Транспорт','Жильё','Развлечения','Здоровье','Зарплата','Прочее'])

function CategoriesPanel({ categories, userId, onCategoriesChange, showToast }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newCat,     setNewCat]     = useState({ name: '', emoji: CAT_EMOJIS[0], color: CAT_COLORS[0], kind: 'expense' })
  const [creating,   setCreating]   = useState(false)

  const seeded = categories.filter(c => SEEDED_NAMES.has(c.name))
  const custom = categories.filter(c => !SEEDED_NAMES.has(c.name))

  const createCategory = async () => {
    if (!newCat.name.trim()) return
    setCreating(true)
    try {
      const saved = await financeCategoriesRepo.create(userId, newCat)
      onCategoriesChange(prev => [...prev, saved])
      setShowCreate(false)
      setNewCat({ name: '', emoji: CAT_EMOJIS[0], color: CAT_COLORS[0], kind: 'expense' })
    } catch(e) {
      showToast('Не удалось создать категорию')
    } finally {
      setCreating(false)
    }
  }

  const removeCategory = async (id) => {
    const prev = categories
    onCategoriesChange(categories.filter(c => c.id !== id))
    try { await financeCategoriesRepo.remove(id) }
    catch(e) { onCategoriesChange(prev); showToast('Не удалось удалить') }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Seeded defaults (read-only) */}
      <p className="text-[10px] text-subtle uppercase tracking-wider">Встроенные</p>
      <div className="flex flex-wrap gap-2">
        {seeded.map(c => (
          <div key={c.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
            style={{ backgroundColor: c.color + '20', color: c.color }}
          >
            <span>{c.emoji}</span>
            <span>{c.name}</span>
          </div>
        ))}
      </div>

      {/* User-created categories */}
      {custom.length > 0 && (
        <>
          <p className="text-[10px] text-subtle uppercase tracking-wider mt-1">Мои</p>
          <div className="flex flex-wrap gap-2">
            {custom.map(c => (
              <div key={c.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs group relative"
                style={{ backgroundColor: c.color + '20', color: c.color }}
              >
                <span>{c.emoji}</span>
                <span>{c.name}</span>
                <button onClick={() => removeCategory(c.id)}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-current hover:text-[#ef4444]"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create */}
      {showCreate ? (
        <div className="bg-muted/20 rounded-xl p-3 border border-border animate-slide-up">
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              type="text"
              value={newCat.name}
              onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && createCategory()}
              placeholder="Название категории"
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-[#f59e0b]/50"
            />
            {/* Kind toggle */}
            <div className="flex gap-2">
              {[{ v: 'expense', l: 'Расход' }, { v: 'income', l: 'Доход' }, { v: 'both', l: 'Оба' }].map(({ v, l }) => (
                <button key={v} type="button" onClick={() => setNewCat(c => ({ ...c, kind: v }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    newCat.kind === v ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'bg-muted/30 text-subtle hover:text-text'
                  }`}
                >{l}</button>
              ))}
            </div>
            {/* Emoji */}
            <div className="flex flex-wrap gap-1">
              {CAT_EMOJIS.map(em => (
                <button key={em} type="button" onClick={() => setNewCat(c => ({ ...c, emoji: em }))}
                  className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-colors ${
                    newCat.emoji === em ? 'bg-accent/20 ring-1 ring-accent/60' : 'hover:bg-muted/50'
                  }`}
                >{em}</button>
              ))}
            </div>
            {/* Color */}
            <div className="flex gap-1.5 flex-wrap">
              {CAT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setNewCat(n => ({ ...n, color: c }))}
                  className="w-5 h-5 rounded-full transition-all"
                  style={{ backgroundColor: c, outline: newCat.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
                />
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-1.5 text-xs rounded-lg border border-border text-subtle hover:text-text transition-colors">Отмена</button>
              <button onClick={createCategory} disabled={creating || !newCat.name.trim()}
                className="flex-[2] py-1.5 text-xs rounded-lg bg-[#f59e0b] hover:bg-[#fbbf24] text-black font-medium transition-colors disabled:opacity-50"
              >{creating ? 'Создание...' : 'Создать'}</button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-2 text-xs text-subtle hover:text-text border border-dashed border-border-2 hover:border-[#f59e0b]/40 rounded-xl transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Новая категория
        </button>
      )}
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-8">
      <div className="w-[220px] shrink-0 h-64 bg-card border border-border-2 rounded-xl animate-pulse" />
      <div className="flex-1 flex flex-col gap-4">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-card border border-border-2 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )
}

// ─── FinanceModule (main) ─────────────────────────────────────────────────────

export default function FinanceModule() {
  const { userId } = useOS()

  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [toast,        setToast]        = useState(null)
  const [transactions, setTransactions] = useState([])
  const [categories,   setCategories]   = useState([])   // all from DB (seeded + user-created)
  const [budgets,      setBudgets]      = useState([])
  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [showForm,     setShowForm]     = useState(false)
  const [statPeriod,   setStatPeriod]   = useState('month')
  const [activeTab,    setActiveTab]    = useState('transactions')

  const showToast = useCallback((msg) => setToast(msg), [])

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return
    Promise.all([
      transactionsRepo.list(userId),
      financeCategoriesRepo.ensureDefaults(userId),   // seeds defaults, returns all
      financeBudgetsRepo.list(userId),
    ]).then(([txns, cats, bdgs]) => {
      setTransactions(sortTransactions(txns))
      setCategories(cats)
      setBudgets(bdgs)
    }).catch(e => { setError(e.message); console.error(e) })
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  const addTransaction = useCallback(async (fields) => {
    if (!userId) return
    const optimistic = {
      id: `tmp-${Date.now()}`,
      userId,
      ...fields,
      createdAt: new Date().toISOString(),
    }
    setTransactions(prev => sortTransactions([optimistic, ...prev]))
    try {
      const saved = await transactionsRepo.create(userId, fields)
      setTransactions(prev => sortTransactions(prev.map(t => t.id === optimistic.id ? saved : t)))
    } catch(e) {
      setTransactions(prev => prev.filter(t => t.id !== optimistic.id))
      showToast('Не удалось добавить транзакцию'); console.error(e)
    }
  }, [userId, showToast])

  const removeTransaction = useCallback(async (id) => {
    const prev = transactions
    setTransactions(p => p.filter(t => t.id !== id))
    try { await transactionsRepo.remove(id) }
    catch(e) { setTransactions(prev); showToast('Не удалось удалить') }
  }, [transactions, showToast])

  const updateTransaction = useCallback(async (id, fields) => {
    const original = transactions.find(t => t.id === id)
    setTransactions(prev => sortTransactions(prev.map(t => t.id === id ? { ...t, ...fields } : t)))
    try { await transactionsRepo.update(id, fields) }
    catch(e) {
      setTransactions(prev => sortTransactions(prev.map(t => t.id === id ? original : t)))
      showToast('Не удалось обновить')
    }
  }, [transactions, showToast])

  // ── Statement import stub ─────────────────────────────────────────────────────

  const handleImport = async () => {
    const result = await parseStatement(null)
    if (result.status === 'in_development') {
      showToast('📄 Импорт выписки — функция в разработке')
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const grouped = useMemo(() => groupTransactionsByDate(transactions), [transactions])

  // For the selected-date filter in transactions tab
  const filteredGroups = useMemo(() => {
    // Show all if no specific filter (we use the calendar just for visual selection, not strict filtering)
    return grouped
  }, [grouped])

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />
  if (error)   return (
    <div className="p-8 flex flex-col items-center gap-4 py-20 text-center">
      <AlertCircle className="w-8 h-8 text-danger" />
      <p className="text-subtle">{error}</p>
      <button onClick={() => window.location.reload()} className="text-[#f59e0b] hover:underline text-sm">Повторить</button>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: MODULE_ICONS.finance.color + '20' }}>
            <MODULE_ICONS.finance.Icon size={20} style={{ color: MODULE_ICONS.finance.color }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Финансы</h1>
            <p className="text-subtle text-sm">
              {transactions.length > 0
                ? `${transactions.length} транзакций`
                : 'Учёт доходов и расходов'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          style={{ backgroundColor: ACCENT + '20', color: ACCENT }}
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      {/* Stats */}
      <PeriodStats
        transactions={transactions}
        period={statPeriod}
        onPeriodChange={setStatPeriod}
      />

      {/* Expense breakdown */}
      <ExpenseBreakdown
        transactions={transactions}
        categories={categories}
        period={statPeriod}
      />

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-card border border-border-2 rounded-lg p-0.5 w-fit mt-2">
        {[
          { v: 'transactions', l: 'Транзакции' },
          { v: 'budgets',      l: 'Бюджеты' },
          { v: 'categories',   l: 'Категории' },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setActiveTab(v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === v ? 'text-[#f59e0b]' : 'text-subtle hover:text-text'}`}
            style={activeTab === v ? { backgroundColor: ACCENT + '20' } : {}}
          >{l}</button>
        ))}
      </div>

      {/* Add form */}
      {activeTab === 'transactions' && showForm && (
        <TransactionForm
          categories={categories}
          selectedDate={getTodayStr()}
          onAdd={addTransaction}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Tab content */}
      {activeTab === 'transactions' && (
        <>
          {transactions.length === 0 && !showForm ? (
            <EmptyState
              modId="finance"
              title="Транзакций пока нет"
              description="Добавьте первую операцию — доход или расход"
              actionLabel="Добавить операцию"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <div className="flex flex-col gap-5">
              {filteredGroups.map(({ date, transactions: txns }) => (
                <div key={date}>
                  <div className="text-xs text-subtle uppercase tracking-widest mb-2 px-1">
                    {fmtDate(date)}
                  </div>
                  <div className="flex flex-col gap-2">
                    {txns.map(tx => (
                      <TransactionCard
                        key={tx.id}
                        tx={tx}
                        categories={categories}
                        onRemove={removeTransaction}
                        onUpdate={updateTransaction}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'budgets' && (
        <BudgetsPanel
          transactions={transactions}
          categories={categories}
          budgets={budgets}
          userId={userId}
          onBudgetsChange={setBudgets}
          showToast={showToast}
        />
      )}

      {activeTab === 'categories' && (
        <CategoriesPanel
          categories={categories}
          userId={userId}
          onCategoriesChange={setCategories}
          showToast={showToast}
        />
      )}
    </div>
  )
}
