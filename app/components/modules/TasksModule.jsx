'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import EmptyState from '../EmptyState'
import {
  ChevronDown, ChevronRight, ChevronLeft, Check, X, FileText,
  AlertCircle, Plus, Repeat, List, CalendarDays,
} from 'lucide-react'
import { useOS } from '../../../lib/store'
import { MODULE_ICONS } from '../../../lib/moduleIcons'
import { tasksRepo }    from '../../../lib/db/tasks'
import { subtasksRepo } from '../../../lib/db/subtasks'
import { projectsRepo, PROJECT_COLORS } from '../../../lib/db/projects'
import { groupTasks, formatDueDate, isOverdue, calculateNextDueDate, getTodayStr } from '../../../lib/tasks-selectors'
import DatePicker from './DatePicker'
import Select from '../Select'
import InlineSubtaskList from './InlineSubtaskList'
import TagChips from './TagChips'

// ─── constants ────────────────────────────────────────────────────────────────

const PRIORITY = {
  low:    { label: 'Низкий',  dot: 'bg-subtle', text: 'text-subtle' },
  medium: { label: 'Средний', dot: 'bg-accent',  text: 'text-accent' },
  high:   { label: 'Высокий', dot: 'bg-danger',  text: 'text-danger' },
}

const STATUS_LABELS = {
  todo:        'К выполнению',
  in_progress: 'В работе',
  done:        'Выполнено',
}

const RECURRENCE_LABELS = {
  none:    'Не повторяется',
  daily:   'Ежедневно',
  weekly:  'Еженедельно',
  monthly: 'Ежемесячно',
}

const SECTIONS = [
  { key: 'overdue',  label: 'Просрочено',  danger: true  },
  { key: 'today',    label: 'Сегодня',      danger: false },
  { key: 'upcoming', label: 'Предстоящее',  danger: false },
  { key: 'noDate',   label: 'Без срока',    danger: false },
  { key: 'done',     label: 'Завершённые',  danger: false },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

function sortTasks(list, by) {
  if (by === 'priority') {
    const ord = { high: 0, medium: 1, low: 2 }
    return [...list].sort((a, b) => (ord[a.priority] ?? 1) - (ord[b.priority] ?? 1))
  }
  return [...list].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })
}

// ─── ui primitives ────────────────────────────────────────────────────────────

function PriorityDot({ priority }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${PRIORITY[priority]?.dot ?? 'bg-subtle'}`} />
}

function SegmentedGroup({ options, value, onChange, canDeselect = true }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      {options.map(({ v, l }) => (
        <button
          key={v}
          onClick={() => onChange(canDeselect && value === v && v !== options[0].v ? options[0].v : v)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
            value === v ? 'bg-accent/20 text-accent' : 'text-subtle hover:text-text'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function CompactSelect({ value, onChange, options, placeholder }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      placeholderValue="all"
      compact
    />
  )
}

// ─── filter row ───────────────────────────────────────────────────────────────

function FilterRow({ sortBy, setSortBy, filterStatus, setFilterStatus, filterPriority, setFilterPriority, filterProject, setFilterProject, filterTag, setFilterTag, projects, allTags }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-5">
      <SegmentedGroup
        canDeselect={false}
        value={sortBy}
        onChange={setSortBy}
        options={[{ v: 'date', l: 'По дате' }, { v: 'priority', l: 'По приоритету' }]}
      />
      <span className="text-border">·</span>
      <SegmentedGroup
        value={filterStatus}
        onChange={setFilterStatus}
        options={[{ v: 'all', l: 'Все' }, { v: 'active', l: 'Активные' }, { v: 'done', l: 'Выполненные' }]}
      />
      <span className="text-border">·</span>
      <CompactSelect
        value={filterPriority}
        onChange={setFilterPriority}
        placeholder="Приоритет"
        options={[
          { v: 'high',   l: '↑ Высокий' },
          { v: 'medium', l: '– Средний'  },
          { v: 'low',    l: '↓ Низкий'   },
        ]}
      />
      {projects.length > 0 && (
        <CompactSelect
          value={filterProject}
          onChange={setFilterProject}
          placeholder="Проект"
          options={projects.map(p => ({ v: p.id, l: p.name }))}
        />
      )}
      {allTags.length > 0 && (
        <CompactSelect
          value={filterTag}
          onChange={setFilterTag}
          placeholder="Тег"
          options={allTags.map(t => ({ v: t, l: `#${t}` }))}
        />
      )}
    </div>
  )
}

// ─── tag input ────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('')
  const addTag = () => {
    const t = input.trim().toLowerCase().replace(/,/g, '')
    if (!t || tags.includes(t)) { setInput(''); return }
    onChange([...tags, t])
    setInput('')
  }
  return (
    <div className="flex flex-wrap gap-1.5 items-center px-2.5 py-2 bg-surface border border-border rounded-lg min-h-[36px] focus-within:border-accent/60 transition-colors">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-muted/60 rounded text-xs text-text">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="text-subtle hover:text-text">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
          if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1))
        }}
        onBlur={addTag}
        placeholder={tags.length === 0 ? 'Теги через Enter или запятую...' : ''}
        className="flex-1 min-w-[100px] bg-transparent text-xs text-text outline-none placeholder:text-subtle"
      />
    </div>
  )
}

// ─── subtask list (inside edit panel) ────────────────────────────────────────

function SubtaskList({ subtasks, onToggle, onRemove, onAdd }) {
  const [input, setInput] = useState('')
  const done = subtasks.filter(s => s.is_done).length

  const handleAdd = () => {
    const t = input.trim()
    if (!t) return
    onAdd(t)
    setInput('')
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs text-subtle font-semibold uppercase tracking-wider">Подзадачи</span>
        {subtasks.length > 0 && (
          <span className="text-xs text-subtle">{done}/{subtasks.length}</span>
        )}
      </div>
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {subtasks.map((s, i) => (
          <div key={s.id} className={`flex items-center gap-2 px-3 py-2 group ${i > 0 ? 'border-t border-border' : ''}`}>
            <button
              type="button"
              onClick={() => onToggle(s)}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                s.is_done ? 'bg-success/20 border-success text-success' : 'border-muted hover:border-accent'
              }`}
            >
              {s.is_done && <Check className="w-2.5 h-2.5" />}
            </button>
            <span className={`flex-1 text-xs ${s.is_done ? 'line-through text-subtle' : 'text-text'}`}>
              {s.title}
            </span>
            <button
              type="button"
              onClick={() => onRemove(s)}
              className="opacity-0 group-hover:opacity-100 text-subtle hover:text-danger transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className={`flex items-center gap-2 px-3 py-1.5 ${subtasks.length > 0 ? 'border-t border-border' : ''}`}>
          <div className="w-4 h-4 rounded border-2 border-dashed border-muted shrink-0" />
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Добавить подзадачу..."
            className="flex-1 min-w-0 bg-transparent text-xs text-subtle placeholder:text-muted outline-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!input.trim()}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-accent hover:text-accent-light hover:bg-accent/10 disabled:text-muted disabled:cursor-default disabled:hover:bg-transparent transition-colors shrink-0 text-base font-medium"
            aria-label="Добавить подзадачу"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── project select (inside edit panel) ──────────────────────────────────────

function ProjectSelect({ value, onChange, projects, onCreateProject }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName,    setNewName]    = useState('')
  const [newColor,   setNewColor]   = useState(PROJECT_COLORS[0])

  const handleCreate = () => {
    if (!newName.trim()) return
    onCreateProject(newName.trim(), newColor)
    setNewName('')
    setShowCreate(false)
  }

  const selected = projects.find(p => p.id === value)

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={value || ''}
        onChange={v => onChange(v || null)}
        options={projects.map(p => ({ value: p.id, label: p.name }))}
        placeholder="Без проекта"
        placeholderValue=""
      />

      {!showCreate ? (
        <button type="button" onClick={() => setShowCreate(true)}
          className="text-xs text-subtle hover:text-accent transition-colors self-start">
          + Новый проект
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Название..."
            className="flex-1 min-w-[100px] bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent/60"
          />
          <div className="flex gap-1">
            {PROJECT_COLORS.map(c => (
              <button
                key={c} type="button" onClick={() => setNewColor(c)}
                className={`w-4 h-4 rounded-full border-2 transition-all ${newColor === c ? 'border-text scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button type="button" onClick={handleCreate} className="text-accent text-xs font-medium">✓</button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-subtle text-xs">✕</button>
        </div>
      )}
    </div>
  )
}

// ─── edit panel ───────────────────────────────────────────────────────────────

function EditPanel({
  fields, onChange, onSave, onCancel, onDelete,
  confirmDelete, onConfirmDelete, onCancelDelete,
  subtasks, onToggleSubtask, onRemoveSubtask, onAddSubtask,
  projects, onCreateProject,
  readOnly = false, onReturnToActive,
  isCreate = false,           // true → create-mode: standalone card, "Создать", no delete
}) {
  // ── Read-only view for done tasks ─────────────────────────────────────────
  if (readOnly) {
    return (
      <div className="border-t border-border bg-bg px-4 py-4 flex flex-col gap-3 animate-slide-up">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 rounded-lg border border-border">
          <Check className="w-3.5 h-3.5 text-success shrink-0" />
          <span className="text-xs text-subtle">Задача выполнена — чтобы редактировать, верните в активные</span>
        </div>
        <input
          disabled
          value={fields.title}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-subtle outline-none opacity-50 cursor-not-allowed"
        />
        {fields.description && (
          <p className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-subtle opacity-50 leading-relaxed">
            {fields.description}
          </p>
        )}
        {subtasks.length > 0 && (
          <div className="opacity-50 pointer-events-none">
            <InlineSubtaskList subtasks={subtasks} onToggle={() => {}} disabled />
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReturnToActive}
              className="px-4 py-1.5 bg-success/20 hover:bg-success/30 text-success text-sm rounded-lg font-medium transition-colors"
            >
              Вернуть в активные
            </button>
            <button type="button" onClick={onCancel} className="px-4 py-1.5 text-subtle hover:text-text text-sm transition-colors">
              Закрыть
            </button>
          </div>
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-subtle">Удалить?</span>
              <button type="button" onClick={onDelete} className="text-danger font-medium hover:text-danger/80 transition-colors">Да</button>
              <button type="button" onClick={onCancelDelete} className="text-subtle hover:text-text transition-colors">Нет</button>
            </div>
          ) : (
            <button type="button" onClick={onConfirmDelete} className="text-subtle hover:text-danger text-sm transition-colors">
              Удалить
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Editable view ─────────────────────────────────────────────────────────
  const panelCls = isCreate
    ? 'bg-surface border border-border rounded-xl px-4 py-4 flex flex-col gap-3 animate-slide-up'
    : 'border-t border-border bg-bg px-4 py-4 flex flex-col gap-3 animate-slide-up'

  return (
    <div className={panelCls}>

      {/* Title */}
      <input
        autoFocus
        type="text"
        value={fields.title}
        onChange={e => onChange({ ...fields, title: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent/60 transition-colors"
        placeholder="Название задачи"
      />

      {/* Description */}
      <textarea
        value={fields.description}
        onChange={e => onChange({ ...fields, description: e.target.value })}
        rows={2}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent/60 transition-colors resize-none placeholder:text-subtle"
        placeholder="Описание (необязательно)"
      />

      {/* Row: status + priority + date + recurrence */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-subtle uppercase tracking-wider">Статус</span>
          <div className="flex gap-1">
            {Object.entries(STATUS_LABELS).map(([k, l]) => (
              <button key={k} type="button" onClick={() => onChange({ ...fields, status: k })}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${fields.status === k ? 'bg-accent/20 text-accent' : 'text-subtle hover:text-text'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-subtle uppercase tracking-wider">Приоритет</span>
          <div className="flex gap-1">
            {Object.entries(PRIORITY).map(([k, v]) => (
              <button key={k} type="button" onClick={() => onChange({ ...fields, priority: k })}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${fields.priority === k ? `bg-accent/20 ${v.text}` : 'text-subtle hover:text-text'}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-subtle uppercase tracking-wider">Срок</span>
          <DatePicker
            value={fields.due_date || null}
            onChange={v => onChange({ ...fields, due_date: v || '' })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-subtle uppercase tracking-wider">Повторение</span>
          <Select
            value={fields.recurrence}
            onChange={v => onChange({ ...fields, recurrence: v })}
            options={Object.entries(RECURRENCE_LABELS).map(([value, label]) => ({ value, label }))}
            compact
          />
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-subtle uppercase tracking-wider">Теги</span>
        <TagInput tags={fields.tags || []} onChange={v => onChange({ ...fields, tags: v })} />
      </div>

      {/* Project */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-subtle uppercase tracking-wider">Проект</span>
        <ProjectSelect
          value={fields.project_id}
          onChange={v => onChange({ ...fields, project_id: v })}
          projects={projects}
          onCreateProject={onCreateProject}
        />
      </div>

      {/* Subtasks */}
      <SubtaskList
        subtasks={subtasks}
        onToggle={onToggleSubtask}
        onRemove={onRemoveSubtask}
        onAdd={onAddSubtask}
      />

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!fields.title.trim()}
            className="px-4 py-1.5 bg-accent hover:bg-accent-light disabled:bg-muted disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
          >
            {isCreate ? 'Создать' : 'Сохранить'}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-1.5 text-subtle hover:text-text text-sm transition-colors">
            Отмена
          </button>
        </div>
        {!isCreate && (confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-subtle">Удалить?</span>
            <button type="button" onClick={onDelete} className="text-danger font-medium hover:text-danger/80 transition-colors">Да</button>
            <button type="button" onClick={onCancelDelete} className="text-subtle hover:text-text transition-colors">Нет</button>
          </div>
        ) : (
          <button type="button" onClick={onConfirmDelete} className="text-subtle hover:text-danger text-sm transition-colors">
            Удалить
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── quick add ────────────────────────────────────────────────────────────────
// Collapsed → one-line placeholder. Focus/click → expands to full EditPanel
// (create mode: standalone card, "Создать" button, no delete).

const EMPTY_DRAFT = {
  title: '', description: '', status: 'todo', priority: 'medium',
  due_date: '', tags: [], project_id: null, recurrence: 'none',
}

function QuickAdd({ onAdd, projects, onCreateProject, inputRef }) {
  const [expanded,        setExpanded]        = useState(false)
  const [fields,          setFields]          = useState(EMPTY_DRAFT)
  const [pendingSubtasks, setPendingSubtasks] = useState([]) // local, pre-DB

  const handleCreate = () => {
    if (!fields.title.trim()) return
    onAdd(fields, pendingSubtasks)
    setFields(EMPTY_DRAFT)
    setPendingSubtasks([])
    setExpanded(false)
  }

  const handleCancel = () => {
    setFields(EMPTY_DRAFT)
    setPendingSubtasks([])
    setExpanded(false)
  }

  if (expanded) {
    return (
      <EditPanel
        isCreate
        fields={fields}
        onChange={setFields}
        onSave={handleCreate}
        onCancel={handleCancel}
        subtasks={pendingSubtasks}
        onToggleSubtask={sub =>
          setPendingSubtasks(p => p.map(s => s.id === sub.id ? { ...s, is_done: !s.is_done } : s))
        }
        onRemoveSubtask={sub =>
          setPendingSubtasks(p => p.filter(s => s.id !== sub.id))
        }
        onAddSubtask={title =>
          setPendingSubtasks(p => [...p, { id: `new-${Date.now()}`, title, is_done: false }])
        }
        projects={projects}
        onCreateProject={(name, color) =>
          // Auto-select the new project in this form's local fields
          onCreateProject(name, color, saved => setFields(f => ({ ...f, project_id: saved.id })))
        }
        // unused in create mode — required by prop types
        onDelete={() => {}}
        confirmDelete={false}
        onConfirmDelete={() => {}}
        onCancelDelete={() => {}}
      />
    )
  }

  // ── Collapsed one-liner ──────────────────────────────────────────────────
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-2">
      <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={fields.title}
        onChange={e => setFields(f => ({ ...f, title: e.target.value }))}
        onFocus={() => setExpanded(true)}
        placeholder="Новая задача..."
        className="flex-1 bg-transparent text-sm text-text placeholder:text-subtle outline-none"
      />
    </div>
  )
}

// ─── task card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, subtasks, project, isFirst, isDone,
  isEditing, editFields, onEditFieldsChange,
  editConfirmDelete, cardConfirmDelete,
  subtasksExpanded, onToggleSubtasksExpand,
  onToggle, onStartEdit, onCancelEdit, onSaveEdit,
  onEditConfirmDelete, onEditCancelDelete,
  onCardConfirmDelete, onCardCancelDelete, onRemove,
  onToggleSubtask, onRemoveSubtask, onAddSubtask,
  projects, onCreateProject,
}) {
  const dueFmt      = formatDueDate(task.due_date)
  const overdue     = isOverdue(task.due_date) && !isDone
  const subTotal    = subtasks?.length || 0
  const subDone     = subtasks?.filter(s => s.is_done).length || 0
  const visibleTags = (task.tags || []).slice(0, 2)
  const extraTags   = (task.tags || []).length - 2
  // Done tasks: row2 only to show subtask progress; active tasks: all metadata
  const hasRow2 = isDone
    ? subTotal > 0
    : (project || visibleTags.length > 0 || subTotal > 0 || (task.recurrence && task.recurrence !== 'none'))

  return (
    <div className={`${!isFirst ? 'border-t border-border' : ''}`}>

      {/* ── Row 1: main ── */}
      <div className="flex items-center gap-3 px-4 py-3 group">
        {/* Checkbox */}
        <button
          type="button"
          onClick={onToggle}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            task.done ? 'bg-success border-success' : 'border-muted hover:border-accent'
          }`}
        >
          {task.done && <Check className="w-3 h-3 text-white" />}
        </button>

        {/* Title */}
        <button
          type="button"
          onClick={onStartEdit}
          className={`flex-1 text-left text-sm truncate transition-colors ${
            isDone ? 'line-through text-subtle' : 'text-text hover:text-text/80'
          }`}
        >
          {task.title}
        </button>

        {/* Metadata (fade in on hover) */}
        <div className="flex items-center gap-2 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          {task.description && <FileText className="w-3 h-3 text-subtle" />}
          {dueFmt && (
            <span className={`text-xs ${overdue ? 'text-danger' : 'text-subtle'}`}>{dueFmt}</span>
          )}
          <PriorityDot priority={task.priority} />
        </div>

        {/* Delete: X on hover → inline confirm */}
        {cardConfirmDelete ? (
          <div className="flex items-center gap-1.5 text-xs shrink-0 animate-fade-in">
            <span className="text-subtle">Удалить?</span>
            <button type="button" onClick={onRemove} className="text-danger font-medium hover:text-danger/80 transition-colors">Да</button>
            <button type="button" onClick={onCardCancelDelete} className="text-subtle hover:text-text transition-colors">Нет</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onCardConfirmDelete}
            className="opacity-0 group-hover:opacity-100 text-subtle hover:text-danger transition-all p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Row 2: tags / project / subtasks / recurrence ── */}
      {hasRow2 && (
        <div className="flex items-center gap-2 px-4 pb-2.5 flex-wrap">
          {project && (
            <span className="flex items-center gap-1 text-xs text-subtle">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
              {project.name}
            </span>
          )}
          <TagChips tags={task.tags} />
          {subTotal > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onToggleSubtasksExpand() }}
              className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors ml-1 ${
                subtasksExpanded
                  ? 'bg-accent/20 text-accent'
                  : 'bg-muted/40 text-subtle hover:text-text'
              }`}
            >
              {subDone}/{subTotal}
              {subtasksExpanded
                ? <ChevronDown  className="w-2.5 h-2.5 ml-0.5" />
                : <ChevronRight className="w-2.5 h-2.5 ml-0.5" />}
            </button>
          )}
          {task.recurrence && task.recurrence !== 'none' && (
            <Repeat className="w-3 h-3 text-subtle ml-1" title={RECURRENCE_LABELS[task.recurrence]} />
          )}
        </div>
      )}

      {/* ── Inline subtask checklist (expanded; disabled for done tasks) ── */}
      {subtasksExpanded && subTotal > 0 && (
        <InlineSubtaskList
          subtasks={subtasks}
          onToggle={onToggleSubtask}
          disabled={isDone}
        />
      )}

      {/* ── Edit panel (read-only for done tasks) ── */}
      {isEditing && (
        <EditPanel
          fields={editFields}
          onChange={onEditFieldsChange}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          onDelete={onRemove}
          confirmDelete={editConfirmDelete}
          onConfirmDelete={onEditConfirmDelete}
          onCancelDelete={onEditCancelDelete}
          subtasks={subtasks || []}
          onToggleSubtask={onToggleSubtask}
          onRemoveSubtask={onRemoveSubtask}
          onAddSubtask={onAddSubtask}
          projects={projects}
          onCreateProject={onCreateProject}
          readOnly={isDone}
          onReturnToActive={onToggle}
        />
      )}
    </div>
  )
}

// ─── loading / empty ──────────────────────────────────────────────────────────

function SkeletonCard({ last }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 animate-pulse ${!last ? 'border-b border-border' : ''}`}>
      <div className="w-5 h-5 rounded-full bg-muted shrink-0" />
      <div className="flex-1 h-3.5 bg-muted rounded" style={{ width: `${50 + Math.random() * 35}%` }} />
      <div className="w-2 h-2 rounded-full bg-muted" />
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 animate-pulse">
        <div className="w-10 h-10 rounded-xl bg-muted" />
        <div><div className="w-20 h-5 bg-muted rounded mb-1" /><div className="w-28 h-3 bg-muted rounded" /></div>
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {[0,1,2].map(i => <SkeletonCard key={i} last={i === 2} />)}
      </div>
    </div>
  )
}

// EmptyState replaced by shared app/components/EmptyState.jsx

function Toast({ msg, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 shadow-lg animate-slide-up">
      <AlertCircle className="w-4 h-4 text-danger shrink-0" />
      <span className="text-sm text-text">{msg}</span>
      <button onClick={onClose} className="text-subtle hover:text-text ml-1 transition-colors"><X className="w-3 h-3" /></button>
    </div>
  )
}

// ─── TasksCalendar ────────────────────────────────────────────────────────────

const MONTHS_RU   = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

const PRIORITY_COLOR = { high: '#ef4444', medium: '#6c63ff', low: '#666666' }

function calLocalStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function TasksCalendar({
  tasks, projects, onAddTask,
  calEditingId, calEditFields, onCalEditFieldsChange,
  calConfirmDel,
  onOpenTask, onCalSave, onCalCancel, onCalDelete,
  onCalConfirmDelete, onCalCancelDelete, onCalReturnActive,
  subtasksByTask, onToggleSubtask, onRemoveSubtask, onAddCalSubtask,
  onCreateProject,
}) {
  const today = getTodayStr()
  const [viewing, setViewing] = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(null)
  const [quickTitle,   setQuickTitle]   = useState('')

  const prevMonth = () => { setSelectedDate(null); setViewing(v => ({ month: v.month === 0 ? 11 : v.month - 1, year: v.month === 0 ? v.year - 1 : v.year })) }
  const nextMonth = () => { setSelectedDate(null); setViewing(v => ({ month: v.month === 11 ? 0 : v.month + 1, year: v.month === 11 ? v.year + 1 : v.year })) }

  // date → tasks[]
  const dateIndex = useMemo(() => {
    const idx = {}
    for (const t of tasks) {
      if (!t.due_date || t.status === 'done') continue
      if (!idx[t.due_date]) idx[t.due_date] = []
      idx[t.due_date].push(t)
    }
    return idx
  }, [tasks])

  const cells = useMemo(() => {
    const { year, month } = viewing
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
    const lastDay  = new Date(year, month + 1, 0).getDate()
    const out = []
    for (let i = 0; i < firstDow; i++) out.push(null)
    for (let d = 1; d <= lastDay; d++) out.push(new Date(year, month, d))
    return out
  }, [viewing])

  const dayTasks   = selectedDate ? (dateIndex[selectedDate] ?? []) : []
  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects])

  const handleQuickAdd = async (e) => {
    e.preventDefault()
    const t = quickTitle.trim()
    if (!t) return
    setQuickTitle('')
    onAddTask({ title: t, due_date: selectedDate, priority: 'medium', status: 'todo', tags: [], recurrence: 'none' })
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 text-subtle hover:text-text transition-colors rounded">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-text">{MONTHS_RU[viewing.month]} {viewing.year}</span>
        <button type="button" onClick={nextMonth} className="p-1 text-subtle hover:text-text transition-colors rounded">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {WEEKDAYS_RU.map(d => (
          <div key={d} className="text-center text-[9px] text-subtle py-0.5">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="h-10" />
          const ds       = calLocalStr(date)
          const items    = dateIndex[ds] ?? []
          const isToday  = ds === today
          const isSelected = ds === selectedDate
          const dots     = items.slice(0, 3)
          const extra    = items.length - 3

          return (
            <button
              key={ds}
              type="button"
              onClick={() => setSelectedDate(d => d === ds ? null : ds)}
              className={`h-10 w-full flex flex-col items-center justify-start pt-1 rounded-lg transition-colors relative
                ${isToday    ? 'bg-accent/10' : ''}
                ${isSelected ? 'ring-1 ring-accent/50' : ''}
                ${items.length > 0 ? 'hover:bg-muted/50 cursor-pointer' : 'hover:bg-muted/20 cursor-pointer'}
              `}
            >
              <span className={`text-[10px] font-medium leading-tight ${isToday ? 'text-accent' : 'text-subtle'}`}>
                {date.getDate()}
              </span>
              {dots.length > 0 && (
                <div className="flex gap-[2px] items-center mt-0.5 flex-wrap justify-center">
                  {dots.map(t => (
                    <span key={t.id} className="w-[5px] h-[5px] rounded-full shrink-0"
                      style={{ backgroundColor: t.project_id && projectMap[t.project_id]?.color ? projectMap[t.project_id].color : PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium }}
                    />
                  ))}
                  {extra > 0 && <span className="text-[7px] text-subtle leading-none font-medium">+{extra}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Day panel */}
      {selectedDate && (
        <div className="mt-3 pt-3 border-t border-border">
          {/* Day header */}
          {!calEditingId && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </span>
              <button onClick={() => setSelectedDate(null)} className="text-subtle hover:text-text transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Task list — hidden when editing */}
          {!calEditingId && (
            <>
              {dayTasks.length > 0 ? (
                <div className="flex flex-col gap-1 mb-3">
                  {dayTasks.map(t => {
                    const proj = t.project_id ? projectMap[t.project_id] : null
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onOpenTask(t)}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 transition-colors text-left w-full"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: proj?.color ?? PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium }} />
                        <span className="text-sm text-text flex-1 truncate">{t.title}</span>
                        {proj && <span className="text-[10px] text-subtle shrink-0">{proj.name}</span>}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-subtle text-xs mb-3">Нет задач</p>
              )}

              <form onSubmit={handleQuickAdd} className="flex gap-2">
                <input
                  value={quickTitle}
                  onChange={e => setQuickTitle(e.target.value)}
                  placeholder="Новая задача..."
                  className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder-subtle outline-none focus:border-accent/50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!quickTitle.trim()}
                  className="px-3 py-1.5 bg-accent/20 text-accent rounded-lg text-sm hover:bg-accent/30 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </>
          )}

          {/* Inline edit panel */}
          {calEditingId && calEditFields && (
            <div className="bg-bg border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-0">
                <span className="text-xs text-subtle">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </span>
                <button onClick={onCalCancel} className="text-subtle hover:text-text transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <EditPanel
                fields={calEditFields}
                onChange={onCalEditFieldsChange}
                onSave={onCalSave}
                onCancel={onCalCancel}
                onDelete={() => onCalDelete(calEditingId)}
                confirmDelete={calConfirmDel}
                onConfirmDelete={onCalConfirmDelete}
                onCancelDelete={onCalCancelDelete}
                subtasks={subtasksByTask[calEditingId] || []}
                onToggleSubtask={onToggleSubtask}
                onRemoveSubtask={onRemoveSubtask}
                onAddSubtask={onAddCalSubtask}
                projects={projects}
                onCreateProject={onCreateProject}
                readOnly={calEditFields.status === 'done'}
                onReturnToActive={onCalReturnActive}
              />
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 justify-end">
        <div className="flex items-center gap-1.5">
          <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLOR.high }} />
          <span className="text-[9px] text-subtle">Высокий</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLOR.medium }} />
          <span className="text-[9px] text-subtle">Средний</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLOR.low }} />
          <span className="text-[9px] text-subtle">Низкий</span>
        </div>
      </div>
    </div>
  )
}

// ─── main component ────────────────────────────────────────────────────────────

const EMPTY_EDIT = { title: '', description: '', status: 'todo', priority: 'medium', due_date: '', tags: [], project_id: null, recurrence: 'none' }

export default function TasksModule() {
  const { userId } = useOS()
  const inputRef   = useRef(null)

  // ── data state ──
  const [tasks,          setTasks]          = useState([])
  const [subtasksByTask, setSubtasksByTask] = useState({})
  const [projects,       setProjects]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [toast,          setToast]          = useState(null)

  // ── edit state ──
  const [editingId,         setEditingId]         = useState(null)
  const [editFields,        setEditFields]         = useState(EMPTY_EDIT)
  const [editConfirmDelete, setEditConfirmDelete]  = useState(false)
  const [confirmDeleteId,   setConfirmDeleteId]    = useState(null)

  // ── view ──
  const [view, setView] = useState('list')

  // ── calendar edit state ──
  const [calEditingId,  setCalEditingId]  = useState(null)
  const [calEditFields, setCalEditFields] = useState(EMPTY_EDIT)
  const [calConfirmDel, setCalConfirmDel] = useState(false)

  // ── filter / sort state ──
  const [sortBy,         setSortBy]         = useState('date')
  const [filterStatus,   setFilterStatus]   = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterProject,  setFilterProject]  = useState('all')
  const [filterTag,      setFilterTag]      = useState('all')
  const [collapsed,        setCollapsed]        = useState(new Set(['done']))
  const [expandedSubtasks, setExpandedSubtasks] = useState(new Set())

  // ── load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return
    Promise.all([
      tasksRepo.list(userId),
      subtasksRepo.listByUser(userId),
      projectsRepo.list(userId),
    ]).then(([taskList, subList, projList]) => {
      setTasks(taskList)
      const byTask = {}
      subList.forEach(s => {
        if (!byTask[s.task_id]) byTask[s.task_id] = []
        byTask[s.task_id].push(s)
      })
      setSubtasksByTask(byTask)
      setProjects(projList)
      // Pre-expand subtasks for today's active tasks
      const today = getTodayStr()
      const todayIds = new Set(
        taskList
          .filter(t => t.status !== 'done' && t.due_date === today && (byTask[t.id] || []).length > 0)
          .map(t => t.id)
      )
      if (todayIds.size > 0) setExpandedSubtasks(todayIds)
    }).catch(e => { showToast('Ошибка загрузки'); console.error(e.message) })
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = (msg) => setToast(msg)

  // ── derived ──────────────────────────────────────────────────────────────────

  const allTags = useMemo(() => {
    const s = new Set()
    tasks.forEach(t => (t.tags || []).forEach(tag => s.add(tag)))
    return [...s].sort()
  }, [tasks])

  const grouped = groupTasks(tasks)

  const getSection = (key) => {
    let list = grouped[key] || []
    if (filterPriority !== 'all') list = list.filter(t => t.priority === filterPriority)
    if (filterProject  !== 'all') list = list.filter(t => t.project_id === filterProject)
    if (filterTag      !== 'all') list = list.filter(t => (t.tags || []).includes(filterTag))
    return sortTasks(list, sortBy)
  }

  const visibleSections = SECTIONS.filter(s => {
    if (filterStatus === 'active' && s.key === 'done') return false
    if (filterStatus === 'done'   && s.key !== 'done') return false
    return true
  })

  const toggleSection = (key) => setCollapsed(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  })
  const toggleSubtaskExpand = (taskId) => setExpandedSubtasks(prev => {
    const n = new Set(prev); n.has(taskId) ? n.delete(taskId) : n.add(taskId); return n
  })

  const totalActive = tasks.filter(t => t.status !== 'done').length

  // ── task CRUD ────────────────────────────────────────────────────────────────

  // add(fields, pendingSubtasks) — called by QuickAdd after full-form submit
  const add = useCallback(async (fields, pendingSubtasks = []) => {
    const title = (fields.title ?? '').trim()
    if (!title || !userId) return

    const status = fields.status || 'todo'
    const optimistic = {
      id:           `tmp-${Date.now()}`,
      title,
      text:         title,
      status,
      done:         status === 'done',
      priority:     fields.priority     || 'medium',
      due_date:     fields.due_date     || null,
      description:  fields.description  || '',
      completed_at: status === 'done' ? new Date().toISOString() : null,
      tags:         fields.tags         || [],
      project_id:   fields.project_id   || null,
      recurrence:   fields.recurrence   || 'none',
    }

    // Optimistic subtasks (keyed by temp task id)
    const optimisticSubs = pendingSubtasks.map((s, i) => ({
      id: s.id, task_id: optimistic.id, user_id: userId,
      title: s.title, is_done: s.is_done ?? false, position: i,
    }))

    setTasks(prev => [optimistic, ...prev])
    if (optimisticSubs.length > 0) {
      setSubtasksByTask(prev => ({ ...prev, [optimistic.id]: optimisticSubs }))
    }

    try {
      const saved = await tasksRepo.create(userId, {
        title,
        status,
        priority:    fields.priority    || 'medium',
        due_date:    fields.due_date    || null,
        description: fields.description || '',
        tags:        fields.tags        || [],
        project_id:  fields.project_id  || null,
        recurrence:  fields.recurrence  || 'none',
        completed_at: status === 'done' ? new Date().toISOString() : null,
      })
      setTasks(prev => prev.map(t => t.id === optimistic.id ? saved : t))

      if (pendingSubtasks.length > 0) {
        const savedSubs = await Promise.all(
          pendingSubtasks.map((s, i) => subtasksRepo.create(userId, saved.id, s.title, i))
        )
        setSubtasksByTask(prev => {
          const { [optimistic.id]: _rm, ...rest } = prev
          return { ...rest, [saved.id]: savedSubs }
        })
      } else {
        // Clean up temp key if it was inserted
        setSubtasksByTask(prev => {
          const { [optimistic.id]: _rm, ...rest } = prev
          return rest
        })
      }
    } catch(e) {
      setTasks(prev => prev.filter(t => t.id !== optimistic.id))
      setSubtasksByTask(prev => {
        const { [optimistic.id]: _rm, ...rest } = prev
        return rest
      })
      showToast('Не удалось добавить задачу'); console.error(e.message)
    }
  }, [userId])

  const toggleComplete = useCallback(async (task) => {
    const newDone = !task.done
    setTasks(prev => prev.map(t => t.id === task.id
      ? { ...t, done: newDone, status: newDone ? 'done' : 'todo', completed_at: newDone ? new Date().toISOString() : null }
      : t))
    try {
      await tasksRepo.toggleComplete(task.id, task.done)
      // Recurrence: create next instance when completing
      if (newDone && task.recurrence && task.recurrence !== 'none') {
        const nextDate = calculateNextDueDate(task.due_date, task.recurrence)
        const nextTask = await tasksRepo.create(userId, {
          title: task.title, priority: task.priority, tags: task.tags || [],
          project_id: task.project_id || null, recurrence: task.recurrence,
          due_date: nextDate, description: task.description || '',
        })
        setTasks(prev => [nextTask, ...prev])
        // Duplicate subtasks as undone
        const existingSubs = subtasksByTask[task.id] || []
        if (existingSubs.length > 0) {
          const newSubs = await Promise.all(
            existingSubs.map((s, i) => subtasksRepo.create(userId, nextTask.id, s.title, i))
          )
          setSubtasksByTask(prev => ({ ...prev, [nextTask.id]: newSubs }))
        }
      }
    } catch(e) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      showToast('Не удалось обновить задачу'); console.error(e.message)
    }
  }, [tasks, userId, subtasksByTask])

  const startEdit = (task) => {
    setEditingId(task.id)
    setEditConfirmDelete(false)
    setConfirmDeleteId(null)
    setEditFields({
      title:       task.title || '',
      description: task.description || '',
      status:      task.status || 'todo',
      priority:    task.priority || 'medium',
      due_date:    task.due_date || '',
      tags:        task.tags || [],
      project_id:  task.project_id || null,
      recurrence:  task.recurrence || 'none',
    })
  }

  const saveEdit = useCallback(async () => {
    const original = tasks.find(t => t.id === editingId)
    if (!original || !editFields.title.trim()) return
    const updates = {
      title:       editFields.title.trim(),
      description: editFields.description,
      status:      editFields.status,
      priority:    editFields.priority,
      due_date:    editFields.due_date || null,
      tags:        editFields.tags || [],
      project_id:  editFields.project_id || null,
      recurrence:  editFields.recurrence || 'none',
      completed_at: editFields.status === 'done'
        ? (original.completed_at || new Date().toISOString()) : null,
    }
    setTasks(prev => prev.map(t => t.id === editingId
      ? { ...t, ...updates, done: updates.status === 'done', text: updates.title }
      : t))
    setEditingId(null)
    try {
      await tasksRepo.update(editingId, updates)
    } catch(e) {
      setTasks(prev => prev.map(t => t.id === editingId ? original : t))
      showToast('Не удалось сохранить'); console.error(e.message)
    }
  }, [tasks, editingId, editFields])

  const remove = useCallback(async (id) => {
    const original = tasks.find(t => t.id === id)
    setTasks(prev => prev.filter(t => t.id !== id))
    setEditingId(null); setEditConfirmDelete(false); setConfirmDeleteId(null)
    try {
      await tasksRepo.remove(id)
    } catch(e) {
      if (original) setTasks(prev => [original, ...prev])
      showToast('Не удалось удалить задачу'); console.error(e.message)
    }
  }, [tasks])

  // ── subtask CRUD ──────────────────────────────────────────────────────────────

  const addSubtask = useCallback(async (title) => {
    if (!editingId || !userId) return
    const pos = (subtasksByTask[editingId] || []).length
    const optimistic = { id: `tmp-${Date.now()}`, task_id: editingId, title, is_done: false, position: pos }
    setSubtasksByTask(prev => ({ ...prev, [editingId]: [...(prev[editingId] || []), optimistic] }))
    try {
      const saved = await subtasksRepo.create(userId, editingId, title, pos)
      setSubtasksByTask(prev => ({
        ...prev,
        [editingId]: (prev[editingId] || []).map(s => s.id === optimistic.id ? saved : s)
      }))
    } catch(e) {
      setSubtasksByTask(prev => ({ ...prev, [editingId]: (prev[editingId] || []).filter(s => s.id !== optimistic.id) }))
      showToast('Не удалось добавить подзадачу'); console.error(e.message)
    }
  }, [editingId, userId, subtasksByTask])

  const toggleSubtask = useCallback(async (subtask) => {
    const tid = subtask.task_id
    setSubtasksByTask(prev => ({
      ...prev,
      [tid]: (prev[tid] || []).map(s => s.id === subtask.id ? { ...s, is_done: !s.is_done } : s)
    }))
    try {
      await subtasksRepo.toggle(subtask.id, subtask.is_done)
    } catch(e) {
      setSubtasksByTask(prev => ({
        ...prev,
        [tid]: (prev[tid] || []).map(s => s.id === subtask.id ? { ...s, is_done: subtask.is_done } : s)
      }))
      showToast('Не удалось обновить подзадачу'); console.error(e.message)
    }
  }, [])

  const removeSubtask = useCallback(async (subtask) => {
    const tid = subtask.task_id
    setSubtasksByTask(prev => ({ ...prev, [tid]: (prev[tid] || []).filter(s => s.id !== subtask.id) }))
    try {
      await subtasksRepo.remove(subtask.id)
    } catch(e) {
      setSubtasksByTask(prev => ({ ...prev, [tid]: [...(prev[tid] || []), subtask] }))
      showToast('Не удалось удалить подзадачу'); console.error(e.message)
    }
  }, [])

  // ── project CRUD ──────────────────────────────────────────────────────────────

  // Returns saved project so callers (EditPanel in edit AND create mode) can
  // select it in their own fields state.
  const createProject = useCallback(async (name, color, onCreated) => {
    if (!userId) return
    try {
      const saved = await projectsRepo.create(userId, name, color)
      setProjects(prev => [...prev, saved])
      if (onCreated) {
        onCreated(saved)          // caller (QuickAdd or TaskCard) updates its own fields
      } else {
        setEditFields(f => ({ ...f, project_id: saved.id }))  // legacy: edit panel
      }
    } catch(e) {
      showToast('Не удалось создать проект'); console.error(e.message)
    }
  }, [userId])

  // ── calendar edit CRUD ────────────────────────────────────────────────────────

  const startCalEdit = (task) => {
    setCalEditingId(task.id)
    setCalConfirmDel(false)
    setCalEditFields({
      title: task.title || '', description: task.description || '',
      status: task.status || 'todo', priority: task.priority || 'medium',
      due_date: task.due_date || '', tags: task.tags || [],
      project_id: task.project_id || null, recurrence: task.recurrence || 'none',
    })
  }

  const saveCalEdit = useCallback(async () => {
    const original = tasks.find(t => t.id === calEditingId)
    if (!original || !calEditFields.title.trim()) return
    const updates = {
      title: calEditFields.title.trim(), description: calEditFields.description,
      status: calEditFields.status, priority: calEditFields.priority,
      due_date: calEditFields.due_date || null, tags: calEditFields.tags || [],
      project_id: calEditFields.project_id || null, recurrence: calEditFields.recurrence || 'none',
      completed_at: calEditFields.status === 'done'
        ? (original.completed_at || new Date().toISOString()) : null,
    }
    setTasks(prev => prev.map(t => t.id === calEditingId
      ? { ...t, ...updates, done: updates.status === 'done', text: updates.title } : t))
    setCalEditingId(null)
    try { await tasksRepo.update(calEditingId, updates) }
    catch(e) { setTasks(prev => prev.map(t => t.id === calEditingId ? original : t)); showToast('Не удалось сохранить') }
  }, [tasks, calEditingId, calEditFields])

  const cancelCalEdit = () => { setCalEditingId(null); setCalConfirmDel(false) }

  const removeCalTask = useCallback(async (id) => {
    const original = tasks.find(t => t.id === id)
    setTasks(prev => prev.filter(t => t.id !== id))
    setCalEditingId(null); setCalConfirmDel(false)
    try { await tasksRepo.remove(id) }
    catch(e) { if (original) setTasks(prev => [original, ...prev]); showToast('Не удалось удалить задачу') }
  }, [tasks])

  const addCalSubtask = useCallback(async (title) => {
    if (!calEditingId || !userId) return
    const pos = (subtasksByTask[calEditingId] || []).length
    const optimistic = { id: `tmp-${Date.now()}`, task_id: calEditingId, title, is_done: false, position: pos }
    setSubtasksByTask(prev => ({ ...prev, [calEditingId]: [...(prev[calEditingId] || []), optimistic] }))
    try {
      const saved = await subtasksRepo.create(userId, calEditingId, title, pos)
      setSubtasksByTask(prev => ({ ...prev, [calEditingId]: (prev[calEditingId] || []).map(s => s.id === optimistic.id ? saved : s) }))
    } catch(e) {
      setSubtasksByTask(prev => ({ ...prev, [calEditingId]: (prev[calEditingId] || []).filter(s => s.id !== optimistic.id) }))
      showToast('Не удалось добавить подзадачу')
    }
  }, [calEditingId, userId, subtasksByTask])

  const returnCalToActive = useCallback(async () => {
    const id = calEditingId
    const original = tasks.find(t => t.id === id)
    if (!original) return
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'todo', done: false, completed_at: null } : t))
    setCalEditingId(null)
    try { await tasksRepo.update(id, { status: 'todo', completed_at: null }) }
    catch(e) { setTasks(prev => prev.map(t => t.id === id ? original : t)); showToast('Не удалось обновить') }
  }, [calEditingId, tasks])

  // ── render ────────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto animate-fade-in">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: MODULE_ICONS.tasks.color + '20' }}>
          <MODULE_ICONS.tasks.Icon size={20} style={{ color: MODULE_ICONS.tasks.color }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Задачи</h1>
          <p className="text-subtle text-sm">{totalActive} активных</p>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-1 mb-4 bg-surface border border-border rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-accent/20 text-accent' : 'text-subtle hover:text-text'}`}
        >
          <List className="w-3.5 h-3.5" />
          Список
        </button>
        <button
          onClick={() => setView('calendar')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'calendar' ? 'bg-accent/20 text-accent' : 'text-subtle hover:text-text'}`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Календарь
        </button>
      </div>

      {/* Calendar view */}
      {view === 'calendar' && (
        <TasksCalendar
          tasks={tasks}
          projects={projects}
          onAddTask={(fields) => add(fields, [])}
          calEditingId={calEditingId}
          calEditFields={calEditFields}
          onCalEditFieldsChange={setCalEditFields}
          calConfirmDel={calConfirmDel}
          onOpenTask={startCalEdit}
          onCalSave={saveCalEdit}
          onCalCancel={cancelCalEdit}
          onCalDelete={removeCalTask}
          onCalConfirmDelete={() => setCalConfirmDel(true)}
          onCalCancelDelete={() => setCalConfirmDel(false)}
          onCalReturnActive={returnCalToActive}
          subtasksByTask={subtasksByTask}
          onToggleSubtask={toggleSubtask}
          onRemoveSubtask={removeSubtask}
          onAddCalSubtask={addCalSubtask}
          onCreateProject={createProject}
        />
      )}

      {/* List view */}
      {view === 'list' && <>
        <FilterRow
          sortBy={sortBy}         setSortBy={setSortBy}
          filterStatus={filterStatus}   setFilterStatus={setFilterStatus}
          filterPriority={filterPriority} setFilterPriority={setFilterPriority}
          filterProject={filterProject}  setFilterProject={setFilterProject}
          filterTag={filterTag}         setFilterTag={setFilterTag}
          projects={projects}
          allTags={allTags}
        />

        {/* Quick add — click/focus expands to full form */}
        <QuickAdd
          onAdd={add}
          projects={projects}
          onCreateProject={createProject}
          inputRef={inputRef}
        />

        {/* Empty state */}
        {tasks.length === 0 && (
            <EmptyState
              modId="tasks"
              title="Задач пока нет"
              description="Добавьте первую задачу и начните отслеживать дела"
              actionLabel="Добавить задачу"
              onAction={() => inputRef.current?.focus()}
            />
          )}

        {/* Sections */}
        {tasks.length > 0 && (
        <div className="flex flex-col gap-4 mt-6">
          {visibleSections.map(section => {
            const list = getSection(section.key)
            if (list.length === 0) return null
            const isCollapsed = collapsed.has(section.key)
            return (
              <div key={section.key}>
                <button
                  onClick={() => toggleSection(section.key)}
                  className="flex items-center gap-1.5 mb-2 w-full select-none"
                >
                  {isCollapsed
                    ? <ChevronRight className="w-3.5 h-3.5 text-subtle" />
                    : <ChevronDown  className="w-3.5 h-3.5 text-subtle" />}
                  <span className={`text-xs uppercase tracking-widest font-semibold ${section.danger ? 'text-danger' : 'text-subtle'}`}>
                    {section.label}
                  </span>
                  <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-md font-medium ${
                    section.danger ? 'bg-danger/10 text-danger' : 'bg-surface text-subtle'
                  }`}>
                    {list.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className={`bg-surface border rounded-xl overflow-hidden ${section.danger ? 'border-danger/20' : 'border-border'}`}>
                    {list.map((task, i) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        subtasks={subtasksByTask[task.id] || []}
                        project={projects.find(p => p.id === task.project_id) || null}
                        isFirst={i === 0}
                        isDone={section.key === 'done'}
                        isEditing={editingId === task.id}
                        editFields={editFields}
                        onEditFieldsChange={setEditFields}
                        editConfirmDelete={editConfirmDelete}
                        cardConfirmDelete={confirmDeleteId === task.id}
                        subtasksExpanded={expandedSubtasks.has(task.id)}
                        onToggleSubtasksExpand={() => toggleSubtaskExpand(task.id)}
                        onToggle={() => toggleComplete(task)}
                        onStartEdit={() => {
                          if (editingId === task.id) { setEditingId(null); return }
                          setConfirmDeleteId(null)
                          startEdit(task)
                        }}
                        onCancelEdit={() => setEditingId(null)}
                        onSaveEdit={saveEdit}
                        onEditConfirmDelete={() => setEditConfirmDelete(true)}
                        onEditCancelDelete={() => setEditConfirmDelete(false)}
                        onCardConfirmDelete={() => { setConfirmDeleteId(task.id); setEditingId(null) }}
                        onCardCancelDelete={() => setConfirmDeleteId(null)}
                        onRemove={() => remove(task.id)}
                        onToggleSubtask={toggleSubtask}
                        onRemoveSubtask={removeSubtask}
                        onAddSubtask={addSubtask}
                        projects={projects}
                        onCreateProject={createProject}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )}
      </>}
    </div>
  )
}
