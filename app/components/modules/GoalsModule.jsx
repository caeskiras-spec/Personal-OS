'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import EmptyState from '../EmptyState'
import { useRouter } from 'next/navigation'
import {
  Target, Plus, X, Trash2, Edit2, Check, Archive, RotateCcw,
  AlertCircle, GripVertical, Tag,
} from 'lucide-react'
import { useOS }                from '../../../lib/store'
import { MODULE_ICONS }         from '../../../lib/moduleIcons'
import SidePanel                from '../SidePanel'
import { goalsRepo }            from '../../../lib/db/goals'
import { goalMilestonesRepo }   from '../../../lib/db/goalMilestones'
import { goalCategoriesRepo }   from '../../../lib/db/goalCategories'
import { tasksRepo }            from '../../../lib/db/tasks'
import { projectsRepo }         from '../../../lib/db/projects'
import { habitsRepo }           from '../../../lib/db/habits'
import { computeProgress, deadlineStatus, sortGoals } from '../../../lib/goals-selectors'
import DatePicker from './DatePicker'

// ─── Constants ─────────────────────────────────────────────────────────────────

const GOAL_COLORS  = ['#6c63ff','#22c55e','#f59e0b','#ef4444','#3b82f6','#ec4899','#8b5cf6','#06b6d4','#10b981','#f97316']
const GOAL_ICONS   = ['🎯','⭐','🚀','💡','🔥','💪','📚','💼','💰','❤️','🌿','🎨','🏆','🌟','⚡','🎵']
const CAT_COLORS   = ['#22c55e','#6c63ff','#f59e0b','#ec4899','#3b82f6','#8b5cf6','#666666']

const STATUS_TABS  = [
  { key: 'active',    label: 'Активные' },
  { key: 'completed', label: 'Завершённые' },
  { key: 'archived',  label: 'Архив' },
]
const PTYPES = [
  { key: 'milestones', label: 'По вехам',              desc: 'Прогресс = выполненные вехи ÷ всего вех. Добавьте чеклист шагов.' },
  { key: 'numeric',    label: 'Число (текущее / цель)', desc: 'Прогресс = текущее значение ÷ цель. Например, 12 из 50 книг.' },
  { key: 'percent',    label: 'Вручную (%)',            desc: 'Ползунок 0–100 — вы сами двигаете прогресс.' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function localStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Ring({ pct, color, size = 72, sw = 6, children }) {
  const r    = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const off  = circ * (1 - Math.max(0, Math.min(1, pct / 100)))
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {GOAL_COLORS.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full transition-transform ${value === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`}
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

function IconPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {GOAL_ICONS.map(em => (
        <button key={em} type="button" onClick={() => onChange(em)}
          className={`text-base px-1.5 py-1 rounded-lg transition-all ${value === em ? 'bg-muted scale-110' : 'hover:bg-surface'}`}
        >{em}</button>
      ))}
    </div>
  )
}

// ─── MilestoneList (drag-sort) ─────────────────────────────────────────────────

function MilestoneList({ milestones, goalId, userId, onMilestonesChange }) {
  const [dragId,  setDragId]  = useState(null)
  const [overId,  setOverId]  = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [adding,   setAdding]  = useState(false)
  const dragHappened = useRef(false)

  const list = milestones.filter(m => m.goal_id === goalId)

  const resetDrag = () => { setDragId(null); setOverId(null); setTimeout(() => { dragHappened.current = false }, 150) }

  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) { resetDrag(); return }
    const from = list.findIndex(m => m.id === dragId)
    const to   = list.findIndex(m => m.id === targetId)
    if (from === -1 || to === -1) { resetDrag(); return }
    dragHappened.current = true
    const next = [...list]
    next.splice(from, 1)
    next.splice(to, 0, list[from])
    const reordered = next.map((m, i) => ({ ...m, position: i }))
    onMilestonesChange(prev => [...prev.filter(m => m.goal_id !== goalId), ...reordered])
    goalMilestonesRepo.reorder(userId, reordered.map(m => m.id)).catch(() => {})
    resetDrag()
  }

  const toggle = async (m) => {
    if (dragHappened.current) return
    onMilestonesChange(prev => prev.map(x => x.id === m.id ? { ...x, done: !m.done } : x))
    try { await goalMilestonesRepo.toggle(m.id, !m.done) }
    catch { onMilestonesChange(prev => prev.map(x => x.id === m.id ? { ...x, done: m.done } : x)) }
  }

  const remove = async (id) => {
    onMilestonesChange(prev => prev.filter(m => m.id !== id))
    try { await goalMilestonesRepo.remove(id) } catch { /* silent */ }
  }

  const addMilestone = async () => {
    if (!newTitle.trim()) return
    const title = newTitle.trim()
    setNewTitle(''); setAdding(false)
    const pos = list.length
    const opt = { id: `tmp-${Date.now()}`, goal_id: goalId, user_id: userId, title, done: false, position: pos, created_at: new Date().toISOString() }
    onMilestonesChange(prev => [...prev, opt])
    try {
      const saved = await goalMilestonesRepo.create(userId, goalId, title, pos)
      onMilestonesChange(prev => prev.map(m => m.id === opt.id ? saved : m))
    } catch {
      onMilestonesChange(prev => prev.filter(m => m.id !== opt.id))
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {list.map(m => (
        <div
          key={m.id}
          draggable
          onDragStart={() => { dragHappened.current = false; setDragId(m.id) }}
          onDragOver={e  => { e.preventDefault(); if (m.id !== overId) setOverId(m.id) }}
          onDrop={() => onDrop(m.id)}
          onDragEnd={resetDrag}
          onClick={() => toggle(m)}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all group ${
            overId === m.id && dragId !== m.id ? 'bg-[#6c63ff]/10 outline outline-1 -outline-offset-1 outline-[#6c63ff]/30' : 'hover:bg-surface'
          } ${dragId === m.id ? 'opacity-30' : ''}`}
        >
          <GripVertical className="w-3 h-3 text-text-8 shrink-0 cursor-grab" />
          <div className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-all ${
            m.done ? 'bg-[#22c55e] border-[#22c55e]' : 'border-border-2 group-hover:border-[#555]'
          }`}>
            {m.done && <Check className="w-2.5 h-2.5 text-white" />}
          </div>
          <span className={`flex-1 text-xs ${m.done ? 'line-through text-text-7' : 'text-text-2'}`}>{m.title}</span>
          <button
            onClick={e => { e.stopPropagation(); remove(m.id) }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/10 text-text-6 hover:text-[#ef4444] transition-all"
          ><X className="w-3 h-3" /></button>
        </div>
      ))}
      {adding ? (
        <div className="flex gap-1.5 mt-1">
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addMilestone(); if (e.key === 'Escape') { setAdding(false); setNewTitle('') } }}
            placeholder="Название вехи..."
            className="flex-1 bg-bg-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-[#6c63ff]/40 placeholder:text-text-8 transition-colors"
          />
          <button onClick={addMilestone} disabled={!newTitle.trim()}
            className="px-2.5 py-1.5 bg-[#6c63ff] text-white rounded-lg text-xs disabled:opacity-40 hover:bg-[#8b85ff] transition-colors"
          >ОК</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-[10px] text-text-7 hover:text-[#6c63ff] transition-colors mt-0.5 px-2"
        ><Plus className="w-3 h-3" /> Добавить веху</button>
      )}
    </div>
  )
}

// ─── GoalCard ──────────────────────────────────────────────────────────────────

function GoalCard({ goal, milestones, categories, isSelected, onSelect, onStatusChange, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const pct  = computeProgress(goal, milestones)
  const dl   = deadlineStatus(goal.deadline)
  const cat  = categories.find(c => c.id === goal.category_id)
  const ms   = milestones.filter(m => m.goal_id === goal.id)
  const msD  = ms.filter(m => m.done).length

  return (
    <div
      onClick={() => !confirmDel && onSelect(goal)}
      className={`bg-card border rounded-xl p-4 cursor-pointer transition-all group ${
        isSelected ? 'border-[#6c63ff]/60 bg-card-selected' : 'border-border-2 hover:bg-surface-2 hover:border-border-hover'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Ring */}
        <Ring pct={pct} color={goal.color} size={52} sw={5}>
          <span className="text-base leading-none">{goal.icon}</span>
        </Ring>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text truncate">{goal.title}</h3>
              {cat && (
                <span className="text-[10px] font-medium mt-0.5 inline-flex items-center gap-1"
                  style={{ color: cat.color }}>
                  {cat.emoji} {cat.name}
                </span>
              )}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => e.stopPropagation()}
            >
              {confirmDel ? (
                <>
                  <button onClick={() => setConfirmDel(false)} className="text-[10px] text-subtle px-1.5 py-1 rounded hover:bg-muted/10">Нет</button>
                  <button onClick={() => onDelete(goal.id)} className="text-[10px] text-[#ef4444] px-1.5 py-1 rounded hover:bg-red-500/10">Удалить</button>
                </>
              ) : (
                <>
                  {goal.status === 'active' && <>
                    <button onClick={() => onStatusChange(goal.id, 'completed')} title="Завершить"
                      className="p-1 rounded text-text-6 hover:text-[#22c55e] hover:bg-muted/10 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onStatusChange(goal.id, 'archived')} title="Архивировать"
                      className="p-1 rounded text-text-6 hover:text-subtle hover:bg-muted/10 transition-colors"><Archive className="w-3.5 h-3.5" /></button>
                  </>}
                  {goal.status !== 'active' && (
                    <button onClick={() => onStatusChange(goal.id, 'active')} title="Вернуть"
                      className="p-1 rounded text-text-6 hover:text-[#6c63ff] hover:bg-muted/10 transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
                  )}
                  <button onClick={() => setConfirmDel(true)}
                    className="p-1 rounded text-text-6 hover:text-[#ef4444] hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: goal.color }} />
            </div>
            <span className="text-[10px] text-text-6 tabular-nums shrink-0">{pct}%</span>
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-text-7">
              {goal.progress_type === 'milestones' && ms.length > 0 ? `${msD}/${ms.length} вех` :
               goal.progress_type === 'numeric' && goal.target_value ? `${goal.current_value}/${goal.target_value}${goal.unit ? ' '+goal.unit : ''}` :
               null}
            </span>
            {dl && <span className="text-[10px] font-medium" style={{ color: dl.color }}>{dl.label}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── LinkedChips ───────────────────────────────────────────────────────────────

function LinkedChips({ ids, items, getLabel, getColor, baseRoute }) {
  const router = useRouter()
  const linked = items.filter(x => ids.includes(x.id))
  if (!linked.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {linked.map(x => (
        <button key={x.id}
          onClick={() => router.push(baseRoute)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all hover:opacity-80"
          style={{ background: (getColor(x) || '#666') + '20', color: getColor(x) || '#666', border: `1px solid ${getColor(x) || '#666'}40` }}
        >
          {getLabel(x)}
        </button>
      ))}
    </div>
  )
}

// ─── GoalForm (shared by Create and Edit) ─────────────────────────────────────

function GoalForm({ initial, categories, tasks, projects, habits, onSave, onCancel, saving }) {
  const [title,      setTitle]      = useState(initial?.title       || '')
  const [desc,       setDesc]       = useState(initial?.description || '')
  const [catId,      setCatId]      = useState(initial?.category_id || null)
  const [ptype,      setPtype]      = useState(initial?.progress_type || 'milestones')
  const [progress,   setProgress]   = useState(initial?.progress    ?? 0)
  const [currVal,    setCurrVal]    = useState(initial?.current_value ?? 0)
  const [targVal,    setTargVal]    = useState(initial?.target_value  ?? '')
  const [unit,       setUnit]       = useState(initial?.unit          || '')
  const [deadline,   setDeadline]   = useState(initial?.deadline      || '')
  const [color,      setColor]      = useState(initial?.color         || '#6c63ff')
  const [icon,       setIcon]       = useState(initial?.icon          || '🎯')
  const [linkedProj, setLinkedProj] = useState(initial?.linked_project_ids || [])
  const [linkedTask, setLinkedTask] = useState(initial?.linked_task_ids    || [])
  const [linkedHab,  setLinkedHab]  = useState(initial?.linked_habit_ids   || [])

  const toggleId = (set, id) => set(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const save = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(), description: desc, category_id: catId,
      progress_type: ptype, progress, current_value: Number(currVal),
      target_value: targVal !== '' ? Number(targVal) : null,
      unit, deadline: deadline || null, color, icon,
      linked_project_ids: linkedProj, linked_task_ids: linkedTask, linked_habit_ids: linkedHab,
    })
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Title */}
      <input value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
        placeholder="Название цели"
        className="bg-transparent border-b border-border focus:border-[#6c63ff]/40 pb-2 text-base font-medium text-text outline-none placeholder:text-muted transition-colors"
      />
      {/* Desc */}
      <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Описание (необязательно)"
        className="bg-bg-2 border border-border rounded-lg px-3 py-2 text-xs text-text outline-none resize-none focus:border-[#6c63ff]/40 placeholder:text-text-8 transition-colors"
      />
      {/* Category */}
      {categories.length > 0 && (
        <div>
          <p className="text-[10px] text-text-7 mb-1.5">Категория</p>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCatId(null)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-all ${!catId ? 'bg-muted border-muted text-text' : 'border-surface-2 text-text-6 hover:border-border-2'}`}
            >Все</button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setCatId(c.id)}
                className="px-2.5 py-1 rounded-full text-xs border transition-all"
                style={catId === c.id
                  ? { background: c.color+'30', color: c.color, border: `1px solid ${c.color}50` }
                  : { background: 'transparent', color: '#555', border: '1px solid #222' }}
              >{c.emoji} {c.name}</button>
            ))}
          </div>
        </div>
      )}
      {/* Progress type */}
      <div>
        <p className="text-[10px] text-text-7 mb-1.5">Тип прогресса</p>
        <div className="flex flex-col gap-1.5">
          {PTYPES.map(pt => {
            const active = ptype === pt.key
            return (
              <button key={pt.key} type="button" onClick={() => setPtype(pt.key)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                  active ? 'bg-[#6c63ff]/10 border-[#6c63ff]/40 text-text' : 'bg-bg-2 border-surface-2 text-subtle hover:border-border-2 hover:text-text-3'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full border-2 shrink-0 transition-all ${active ? 'border-[#6c63ff] bg-[#6c63ff]' : 'border-border-2'}`} />
                  <span className="text-xs font-medium">{pt.label}</span>
                </div>
                {active && <p className="text-[10px] text-text-4 mt-1 ml-5">{pt.desc}</p>}
              </button>
            )
          })}
        </div>
      </div>
      {/* Progress controls */}
      {ptype === 'percent' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-text-7">Начальное значение</p>
            <span className="text-xs font-bold text-[#6c63ff]">{progress}%</span>
          </div>
          <input type="range" min={0} max={100} value={progress} onChange={e => setProgress(+e.target.value)}
            className="w-full accent-[#6c63ff]" />
        </div>
      )}
      {ptype === 'numeric' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="text-[10px] text-text-7 mb-1">Цель <span className="text-[#ef4444]">*</span></p>
            <input type="number" value={targVal} onChange={e => setTargVal(e.target.value)} placeholder="50"
              className="w-full bg-bg-2 border border-border rounded-lg px-2.5 py-1.5 text-sm text-text outline-none focus:border-[#6c63ff]/40 placeholder:text-text-8" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-text-7 mb-1">Текущее</p>
            <input type="number" value={currVal} onChange={e => setCurrVal(e.target.value)}
              className="w-full bg-bg-2 border border-border rounded-lg px-2.5 py-1.5 text-sm text-text outline-none focus:border-[#6c63ff]/40" />
          </div>
          <div className="w-20">
            <p className="text-[10px] text-text-7 mb-1">Ед.</p>
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="книг"
              className="w-full bg-bg-2 border border-border rounded-lg px-2.5 py-1.5 text-sm text-text outline-none focus:border-[#6c63ff]/40 placeholder:text-text-8" />
          </div>
        </div>
      )}
      {ptype === 'milestones' && (
        <div className="bg-[#6c63ff]/8 border border-[#6c63ff]/20 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#8b85ff] font-medium mb-0.5">После создания цели</p>
          <p className="text-[10px] text-subtle">Откройте карточку цели и добавьте первую веху. Прогресс пойдёт автоматически.</p>
        </div>
      )}
      {/* Icon + color */}
      <div>
        <p className="text-[10px] text-text-7 mb-1.5">Иконка</p>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      <div>
        <p className="text-[10px] text-text-7 mb-1.5">Цвет</p>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {/* Deadline */}
      <div>
        <p className="text-[10px] text-text-7 mb-1.5">Дедлайн</p>
        <DatePicker value={deadline} onChange={setDeadline} noOverdue />
      </div>
      {/* Linked: Projects */}
      {projects.length > 0 && (
        <div>
          <p className="text-[10px] text-text-7 mb-1.5">Связанные проекты</p>
          <div className="flex flex-wrap gap-1.5">
            {projects.map(p => {
              const on = linkedProj.includes(p.id)
              return (
                <button key={p.id} onClick={() => toggleId(setLinkedProj, p.id)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-all"
                  style={on ? { background: p.color+'25', color: p.color, border: `1px solid ${p.color}50` } : { background: '#1d1d1d', color: '#555', border: '1px solid #222' }}
                >{p.icon} {p.name}</button>
              )
            })}
          </div>
        </div>
      )}
      {/* Linked: Tasks */}
      {tasks.filter(t => !t.done).length > 0 && (
        <div>
          <p className="text-[10px] text-text-7 mb-1.5">Связанные задачи</p>
          <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
            {tasks.filter(t => !t.done).map(t => {
              const on = linkedTask.includes(t.id)
              return (
                <button key={t.id} onClick={() => toggleId(setLinkedTask, t.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-all ${on ? 'bg-[#6c63ff]/15 text-[#8b85ff]' : 'text-text-6 hover:bg-surface hover:text-text'}`}
                >
                  {on && <Check className="w-3 h-3 shrink-0" />}
                  <span className="truncate">{t.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {/* Linked: Habits */}
      {habits.length > 0 && (
        <div>
          <p className="text-[10px] text-text-7 mb-1.5">Связанные привычки</p>
          <div className="flex flex-wrap gap-1.5">
            {habits.map(h => {
              const on = linkedHab.includes(h.id)
              return (
                <button key={h.id} onClick={() => toggleId(setLinkedHab, h.id)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-all"
                  style={on ? { background: (h.color||'#6c63ff')+'25', color: h.color||'#6c63ff', border: `1px solid ${h.color||'#6c63ff'}50` } : { background: '#1d1d1d', color: '#555', border: '1px solid #222' }}
                >{h.emoji||'⭐'} {h.name}</button>
              )
            })}
          </div>
        </div>
      )}
      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2.5 text-sm text-subtle border border-border rounded-xl hover:border-border-2 transition-colors">
          Отмена
        </button>
        <button onClick={save} disabled={!title.trim() || saving}
          className="flex-[2] py-2.5 text-sm bg-[#6c63ff] hover:bg-[#8b85ff] text-white font-medium rounded-xl transition-colors disabled:opacity-40"
        >{saving ? 'Сохранение...' : initial ? 'Сохранить' : 'Создать цель'}</button>
      </div>
    </div>
  )
}

// ─── DetailPanel ───────────────────────────────────────────────────────────────

function DetailPanel({ goal, milestones, categories, tasks, projects, habits, userId, onClose, onUpdate, onDelete, onMilestonesChange }) {
  const [editing,      setEditing]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [confirmDel,   setConfirmDel]   = useState(false)
  const [quickVal,     setQuickVal]     = useState('')
  const [savingQuick,  setSavingQuick]  = useState(false)

  const pct = computeProgress(goal, milestones)
  const dl  = deadlineStatus(goal.deadline)
  const cat = categories.find(c => c.id === goal.category_id)

  const save = async (fields) => {
    setSaving(true)
    await onUpdate(goal.id, fields)
    setSaving(false)
    setEditing(false)
  }

  const saveQuickVal = async () => {
    const v = parseFloat(quickVal)
    if (isNaN(v)) return
    setSavingQuick(true)
    await onUpdate(goal.id, { current_value: v })
    setSavingQuick(false)
    setQuickVal('')
  }

  return (
    <SidePanel panelClass="md:w-[420px]" onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-1 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0">{goal.icon}</span>
          <span className="text-sm font-semibold text-text truncate">{goal.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(v => !v)}
            className={`p-1.5 rounded-lg transition-colors ${editing ? 'bg-muted text-text' : 'text-text-6 hover:text-text hover:bg-muted/10'}`}
          ><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-6 hover:text-text hover:bg-muted/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-5 py-4">
        {/* Edit form */}
        {editing ? (
          <GoalForm
            initial={goal}
            categories={categories} tasks={tasks} projects={projects} habits={habits}
            onSave={save} onCancel={() => setEditing(false)} saving={saving}
          />
        ) : (
          <>
            {/* Progress card */}
            {(() => {
              const ms = milestones.filter(m => m.goal_id === goal.id)
              const msD = ms.filter(m => m.done).length
              const noTarget = goal.progress_type === 'numeric' && !goal.target_value
              const noMilestones = goal.progress_type === 'milestones' && ms.length === 0
              return (
                <div className="bg-surface border border-surface-2 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <Ring pct={pct} color={goal.color} size={72} sw={7}>
                      <span className="text-sm font-bold" style={{ color: goal.color }}>{pct}%</span>
                    </Ring>
                    <div className="flex-1 min-w-0">
                      {cat && <p className="text-[10px] mb-0.5" style={{ color: cat.color }}>{cat.emoji} {cat.name}</p>}
                      {goal.progress_type === 'numeric' && goal.target_value ? (
                        <p className="text-sm font-semibold text-text">{goal.current_value} / {goal.target_value}{goal.unit ? ' '+goal.unit : ''}</p>
                      ) : goal.progress_type === 'milestones' ? (
                        ms.length > 0
                          ? <p className="text-sm font-semibold text-text">{msD} из {ms.length} вех</p>
                          : <p className="text-sm font-semibold text-text-6">Нет вех</p>
                      ) : (
                        <p className="text-sm font-semibold text-text">{pct}% выполнено</p>
                      )}
                      {dl && <p className="text-[10px] mt-1" style={{ color: dl.color }}>{dl.label}</p>}
                      {goal.description && <p className="text-xs text-text-6 mt-1 line-clamp-2">{goal.description}</p>}
                    </div>
                  </div>

                  {/* Context hint */}
                  {noMilestones && (
                    <div className="mt-3 pt-3 border-t border-surface-3">
                      <p className="text-[11px] text-[#8b85ff]">Добавьте вехи ниже — прогресс пойдёт автоматически</p>
                    </div>
                  )}
                  {!noMilestones && goal.progress_type === 'milestones' && ms.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-surface-3">
                      <p className="text-[11px] text-text-6">Отмечайте вехи ниже, чтобы двигать прогресс</p>
                    </div>
                  )}
                  {goal.progress_type === 'percent' && (
                    <div className="mt-3 pt-3 border-t border-surface-3">
                      <p className="text-[11px] text-text-6">Измените прогресс через редактирование цели (карандаш выше)</p>
                    </div>
                  )}
                  {noTarget && (
                    <div className="mt-3 pt-3 border-t border-surface-3">
                      <p className="text-[11px] text-[#f59e0b]">Укажите целевое значение в редакторе — иначе прогресс не считается</p>
                    </div>
                  )}
                  {!noTarget && goal.progress_type === 'numeric' && goal.target_value && (
                    <div className="mt-3 pt-3 border-t border-surface-3">
                      <p className="text-[10px] text-text-7 mb-1.5">Обновить текущее значение</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={quickVal}
                          onChange={e => setQuickVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveQuickVal() }}
                          placeholder={String(goal.current_value ?? 0)}
                          className="flex-1 bg-bg-2 border border-border rounded-lg px-2.5 py-1.5 text-sm text-text outline-none focus:border-[#6c63ff]/40 placeholder:text-text-8"
                        />
                        {goal.unit && <span className="self-center text-xs text-text-6 shrink-0">{goal.unit}</span>}
                        <button
                          onClick={saveQuickVal}
                          disabled={!quickVal.trim() || savingQuick}
                          className="px-3 py-1.5 bg-[#6c63ff] hover:bg-[#8b85ff] text-white text-xs rounded-lg disabled:opacity-40 transition-colors shrink-0"
                        >{savingQuick ? '...' : 'Сохранить'}</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Milestones */}
            {goal.progress_type === 'milestones' && (
              <div>
                <p className="text-[10px] text-muted uppercase tracking-widest mb-2">Вехи</p>
                <MilestoneList milestones={milestones} goalId={goal.id} userId={userId} onMilestonesChange={onMilestonesChange} />
              </div>
            )}

            {/* Linked items */}
            {(goal.linked_project_ids?.length > 0 || goal.linked_task_ids?.length > 0 || goal.linked_habit_ids?.length > 0) && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-muted uppercase tracking-widest">Связано</p>
                <LinkedChips ids={goal.linked_project_ids || []} items={projects}
                  getLabel={x => `${x.icon||'📁'} ${x.name}`} getColor={x => x.color}
                  baseRoute="/modules/projects" />
                <LinkedChips ids={goal.linked_task_ids || []} items={tasks}
                  getLabel={x => x.title} getColor={() => '#6c63ff'}
                  baseRoute="/modules/tasks" />
                <LinkedChips ids={goal.linked_habit_ids || []} items={habits}
                  getLabel={x => `${x.emoji||'⭐'} ${x.name}`} getColor={x => x.color}
                  baseRoute="/modules/habits" />
              </div>
            )}

            {/* Delete */}
            <div className="pt-2 border-t border-border-1" onClick={e => e.stopPropagation()}>
              {confirmDel ? (
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDel(false)} className="flex-1 py-2 text-xs text-subtle border border-border rounded-xl hover:border-border-2 transition-colors">Отмена</button>
                  <button onClick={() => onDelete(goal.id)} className="flex-1 py-2 text-xs text-[#ef4444] border border-[#ef4444]/30 rounded-xl hover:bg-red-500/10 transition-colors">Удалить цель</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(true)} className="w-full py-2 text-xs text-text-7 hover:text-[#ef4444] transition-colors flex items-center justify-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Удалить цель
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </SidePanel>
  )
}

// ─── GoalsModule ────────────────────────────────────────────────────────────────

export default function GoalsModule() {
  const { userId } = useOS()

  const [goals,      setGoals]      = useState([])
  const [milestones, setMilestones] = useState([])
  const [categories, setCategories] = useState([])
  const [tasks,      setTasks]      = useState([])
  const [projects,   setProjects]   = useState([])
  const [habits,     setHabits]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [panel,      setPanel]      = useState(null) // null | 'new' | goal
  const [tab,        setTab]        = useState('active')
  const [filterCat,  setFilterCat]  = useState(null)
  const [creating,   setCreating]   = useState(false)
  const [savingNew,  setSavingNew]  = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true); setError(null)
    try {
      const [g, ms, cats, t, p, h] = await Promise.all([
        goalsRepo.list(userId),
        goalMilestonesRepo.listAll(userId),
        goalCategoriesRepo.ensureDefaults(userId),
        tasksRepo.list(userId),
        projectsRepo.list(userId),
        habitsRepo.list(userId),
      ])
      setGoals(g); setMilestones(ms); setCategories(cats)
      setTasks(t); setProjects(p); setHabits(h)
    } catch (err) {
      setError(err.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  // ── Grouped + filtered ────────────────────────────────────────────────────────
  const byStatus = useMemo(() => {
    const filter = gs => {
      let res = gs
      if (filterCat) res = res.filter(g => g.category_id === filterCat)
      return sortGoals(res)
    }
    return {
      active:    filter(goals.filter(g => g.status === 'active')),
      completed: filter(goals.filter(g => g.status === 'completed')),
      archived:  filter(goals.filter(g => g.status === 'archived')),
    }
  }, [goals, filterCat])

  const visibleList = byStatus[tab] ?? []
  const tabCounts   = { active: byStatus.active.length, completed: byStatus.completed.length, archived: byStatus.archived.length }

  // ── CRUD ──────────────────────────────────────────────────────────────────────
  const createGoal = useCallback(async (fields) => {
    setSavingNew(true)
    const opt = { id: `tmp-${Date.now()}`, ...fields, status: 'active', created_at: new Date().toISOString() }
    setGoals(p => [opt, ...p])
    setCreating(false)
    try {
      const saved = await goalsRepo.create(userId, fields)
      setGoals(p => p.map(g => g.id === opt.id ? saved : g))
      setPanel(saved)
    } catch {
      setGoals(p => p.filter(g => g.id !== opt.id))
    } finally {
      setSavingNew(false)
    }
  }, [userId])

  const updateGoal = useCallback(async (id, fields) => {
    const snap = goals
    setGoals(p => p.map(g => g.id === id ? { ...g, ...fields } : g))
    if (panel && typeof panel === 'object' && panel.id === id) setPanel(prev => ({ ...prev, ...fields }))
    try {
      const saved = await goalsRepo.update(id, fields)
      setGoals(p => p.map(g => g.id === id ? saved : g))
      if (panel && typeof panel === 'object' && panel.id === id) setPanel(saved)
    } catch { setGoals(snap) }
  }, [goals, panel])

  const changeStatus = useCallback(async (id, status) => {
    await updateGoal(id, { status })
  }, [updateGoal])

  const deleteGoal = useCallback(async (id) => {
    const snap = goals
    setGoals(p => p.filter(g => g.id !== id))
    setMilestones(p => p.filter(m => m.goal_id !== id))
    if (panel && typeof panel === 'object' && panel.id === id) setPanel(null)
    try { await goalsRepo.remove(id) } catch { setGoals(snap) }
  }, [goals, panel])

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="px-4 sm:px-8 pt-5 sm:pt-8 flex flex-col gap-3">
      {[1,2,3].map(i => <div key={i} className="h-28 bg-card border border-border-2 rounded-xl animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-8 h-8 text-[#ef4444] mx-auto mb-3" />
        <p className="text-subtle text-sm mb-3">{error}</p>
        <button onClick={load} className="text-sm text-[#6c63ff] hover:underline">Повторить</button>
      </div>
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── List pane ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <div className="px-4 sm:px-8 pt-5 sm:pt-8 pb-4 border-b border-surface shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: MODULE_ICONS.goals.color + '20' }}>
                <MODULE_ICONS.goals.Icon size={20} style={{ color: MODULE_ICONS.goals.color }} />
              </div>
              <div>
              <h1 className="text-2xl font-bold text-text">Цели</h1>
              <p className="text-subtle text-sm mt-0.5">{byStatus.active.length} активных</p>
            </div></div>
            <button onClick={() => { setCreating(true); setPanel('new') }}
              className="flex items-center gap-2 px-4 py-2 bg-[#6c63ff] hover:bg-[#8b85ff] text-white text-sm font-medium rounded-xl transition-colors"
            ><Plus className="w-4 h-4" /> Цель</button>
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-3">
              <button onClick={() => setFilterCat(null)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all ${!filterCat ? 'bg-muted border-muted text-text' : 'border-surface-2 text-text-6 hover:border-border-2'}`}
              >Все</button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setFilterCat(filterCat === c.id ? null : c.id)}
                  className="px-2.5 py-1 rounded-full text-xs border transition-all"
                  style={filterCat === c.id
                    ? { background: c.color+'30', color: c.color, border: `1px solid ${c.color}50` }
                    : { background: 'transparent', color: '#555', border: '1px solid #222' }}
                >{c.emoji} {c.name}</button>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-bg-2 rounded-xl p-1">
            {STATUS_TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t.key ? 'bg-muted text-text' : 'text-text-6 hover:text-text'}`}
              >
                {t.label}
                {tabCounts[t.key] > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${tab === t.key ? 'bg-[#3a3a3a] text-text-3' : 'bg-surface text-text-7'}`}>
                    {tabCounts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-5">
          {visibleList.length === 0 ? (
            tab === 'active' ? (
              <EmptyState
                modId="goals"
                title="Целей пока нет"
                description="Поставьте первую цель и отслеживайте прогресс"
                actionLabel="Создать цель"
                onAction={() => { setCreating(true); setPanel('new') }}
              />
            ) : (
              <EmptyState
                modId="goals"
                title={tab === 'completed' ? 'Нет завершённых целей' : 'Архив пуст'}
                compact
              />
            )
          ) : (
            <div className="flex flex-col gap-2.5">
              {visibleList.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  milestones={milestones}
                  categories={categories}
                  isSelected={panel && typeof panel === 'object' && panel.id === goal.id}
                  onSelect={g => { setCreating(false); setPanel(g) }}
                  onStatusChange={changeStatus}
                  onDelete={deleteGoal}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      {panel === 'new' && (
        <SidePanel panelClass="md:w-[420px]" onClose={() => { setPanel(null); setCreating(false) }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-1 shrink-0">
            <span className="text-sm font-semibold text-text">Новая цель</span>
            <button onClick={() => { setPanel(null); setCreating(false) }} className="p-1.5 rounded-lg text-text-6 hover:text-text hover:bg-muted/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <GoalForm
              initial={null}
              categories={categories} tasks={tasks} projects={projects} habits={habits}
              onSave={createGoal}
              onCancel={() => { setPanel(null); setCreating(false) }}
              saving={savingNew}
            />
          </div>
        </SidePanel>
      )}
      {panel && typeof panel === 'object' && (
        <DetailPanel
          key={panel.id}
          goal={goals.find(g => g.id === panel.id) ?? panel}
          milestones={milestones}
          categories={categories}
          tasks={tasks}
          projects={projects}
          habits={habits}
          userId={userId}
          onClose={() => setPanel(null)}
          onUpdate={updateGoal}
          onDelete={deleteGoal}
          onMilestonesChange={setMilestones}
        />
      )}
    </div>
  )
}
