'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import EmptyState from '../EmptyState'
import SidePanel from '../SidePanel'
import {
  FolderOpen, Plus, X, Trash2, Edit2, Check,
  ChevronRight, AlertCircle, Circle, CheckCircle2,
  Archive, RotateCcw,
} from 'lucide-react'
import { useOS }           from '../../../lib/store'
import { MODULE_ICONS }    from '../../../lib/moduleIcons'
import { projectsRepo, PROJECT_COLORS, PROJECT_ICONS } from '../../../lib/db/projects'
import { tasksRepo }       from '../../../lib/db/tasks'
import { getProjectProgress, deadlineStatus, sortProjects } from '../../../lib/projects-selectors'
import DatePicker          from './DatePicker'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function localStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const STATUS_TABS = [
  { key: 'active',    label: 'Активные' },
  { key: 'completed', label: 'Завершённые' },
  { key: 'archived',  label: 'Архив' },
]

// ─── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct, color, done, total }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[10px] text-text-6 shrink-0 tabular-nums">{done}/{total}</span>
    </div>
  )
}

// ─── ColorPicker ───────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PROJECT_COLORS.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full transition-transform ${value === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`}
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

// ─── IconPicker ────────────────────────────────────────────────────────────────

function IconPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PROJECT_ICONS.map(em => (
        <button key={em} type="button" onClick={() => onChange(em)}
          className={`text-base px-1.5 py-1 rounded-lg transition-all ${value === em ? 'bg-muted scale-110' : 'hover:bg-surface'}`}
        >{em}</button>
      ))}
    </div>
  )
}

// ─── ProjectCard ───────────────────────────────────────────────────────────────

function ProjectCard({ project, tasks, isSelected, onSelect, onStatusChange, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { done, total, pct } = getProjectProgress(tasks, project.id)
  const dl = deadlineStatus(project.deadline)

  return (
    <div
      onClick={() => !confirmDelete && onSelect(project)}
      className={`bg-card border rounded-xl p-4 cursor-pointer transition-all group ${
        isSelected
          ? 'border-[#6c63ff]/60 bg-card-selected'
          : 'border-border-2 hover:bg-surface-2 hover:border-border-hover'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: project.color + '22' }}
        >
          {project.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-text truncate">{project.name}</h3>
            {/* Actions */}
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => e.stopPropagation()}
            >
              {confirmDelete ? (
                <>
                  <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-subtle px-1.5 py-1 rounded hover:bg-muted/10">Нет</button>
                  <button onClick={() => onDelete(project.id)} className="text-[10px] text-[#ef4444] px-1.5 py-1 rounded hover:bg-red-500/10">Удалить</button>
                </>
              ) : (
                <>
                  {project.status === 'active' && (
                    <button onClick={() => onStatusChange(project.id, 'completed')} title="Завершить"
                      className="p-1 rounded hover:bg-muted/10 text-text-6 hover:text-[#22c55e] transition-colors"
                    ><Check className="w-3.5 h-3.5" /></button>
                  )}
                  {project.status === 'active' && (
                    <button onClick={() => onStatusChange(project.id, 'archived')} title="Архивировать"
                      className="p-1 rounded hover:bg-muted/10 text-text-6 hover:text-subtle transition-colors"
                    ><Archive className="w-3.5 h-3.5" /></button>
                  )}
                  {(project.status === 'completed' || project.status === 'archived') && (
                    <button onClick={() => onStatusChange(project.id, 'active')} title="Вернуть в активные"
                      className="p-1 rounded hover:bg-muted/10 text-text-6 hover:text-[#6c63ff] transition-colors"
                    ><RotateCcw className="w-3.5 h-3.5" /></button>
                  )}
                  <button onClick={() => setConfirmDelete(true)}
                    className="p-1 rounded hover:bg-red-500/10 text-text-6 hover:text-[#ef4444] transition-colors"
                  ><Trash2 className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
          </div>
          {project.description && (
            <p className="text-[11px] text-text-6 mt-0.5 line-clamp-1">{project.description}</p>
          )}
        </div>
      </div>

      {/* Progress + deadline */}
      <div className="mt-3 flex flex-col gap-1.5">
        {total > 0 && (
          <>
            <ProgressBar pct={pct} color={project.color} done={done} total={total} />
            {pct === 100 && project.status === 'active' && (
              <span className="text-[10px] text-[#22c55e]">✓ Все задачи выполнены — можно завершить</span>
            )}
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-7">{total} {total === 1 ? 'задача' : total < 5 ? 'задачи' : 'задач'}</span>
          {dl && (
            <span className="text-[10px] font-medium" style={{ color: dl.color }}>{dl.label}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle }) {
  return (
    <div
      className={`flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors hover:bg-surface cursor-pointer group ${task.done ? 'opacity-50' : ''}`}
      onClick={() => onToggle(task.id, task.done)}
    >
      {task.done
        ? <CheckCircle2 className="w-4 h-4 shrink-0 text-[#22c55e]" />
        : <Circle className="w-4 h-4 shrink-0 text-text-8 group-hover:text-text-6 transition-colors" />
      }
      <span className={`text-sm flex-1 min-w-0 truncate ${task.done ? 'line-through text-text-6' : 'text-text'}`}>
        {task.title}
      </span>
      {task.due_date && (
        <span className={`text-[10px] shrink-0 ${task.due_date < localStr() && !task.done ? 'text-[#ef4444]' : 'text-text-7'}`}>
          {task.due_date}
        </span>
      )}
    </div>
  )
}

// ─── DetailPanel ───────────────────────────────────────────────────────────────

function DetailPanel({ project, tasks, userId, onClose, onUpdate, onDelete, onTaskToggle, onTaskCreate }) {
  const [editing,   setEditing]   = useState(false)
  const [name,      setName]      = useState(project.name)
  const [desc,      setDesc]      = useState(project.description || '')
  const [icon,      setIcon]      = useState(project.icon || '📁')
  const [color,     setColor]     = useState(project.color || '#6c63ff')
  const [deadline,  setDeadline]  = useState(project.deadline || '')
  const [saving,    setSaving]    = useState(false)
  const [newTask,   setNewTask]   = useState('')
  const [addingTask, setAddingTask] = useState(false)

  const linked = tasks.filter(t => t.project_id === project.id)
  const { done, total, pct } = getProjectProgress(tasks, project.id)
  const dl = deadlineStatus(project.deadline)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onUpdate(project.id, { name: name.trim(), description: desc, icon, color, deadline: deadline || null })
    setSaving(false)
    setEditing(false)
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    setNewTask('')
    setAddingTask(false)
    await onTaskCreate(newTask.trim(), project.id)
  }

  return (
    <SidePanel panelClass="md:w-[400px]" onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-1 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
            style={{ background: project.color + '22' }}
          >{project.icon}</div>
          <span className="text-sm font-semibold text-text truncate">{project.name}</span>
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
        {/* Progress */}
        {total > 0 && (
          <div className="bg-surface border border-surface-2 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-subtle">Прогресс</span>
              <span className="text-sm font-bold" style={{ color: project.color }}>{pct}%</span>
            </div>
            <ProgressBar pct={pct} color={project.color} done={done} total={total} />
            {dl && <p className="text-[10px] mt-2" style={{ color: dl.color }}>Дедлайн: {dl.label}</p>}
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="bg-surface border border-surface-2 rounded-xl p-4 flex flex-col gap-3 animate-slide-up">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Название проекта"
              className="bg-transparent border-b border-border focus:border-[#6c63ff]/40 pb-1.5 text-sm font-medium text-text outline-none placeholder:text-muted transition-colors"
            />
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Описание (необязательно)"
              rows={2}
              className="bg-bg-2 border border-border rounded-lg px-3 py-2 text-xs text-text outline-none resize-none focus:border-[#6c63ff]/40 placeholder:text-muted transition-colors"
            />
            <div>
              <p className="text-[10px] text-text-7 mb-1.5">Иконка</p>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div>
              <p className="text-[10px] text-text-7 mb-1.5">Цвет</p>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div>
              <p className="text-[10px] text-text-7 mb-1.5">Дедлайн</p>
              <DatePicker value={deadline} onChange={setDeadline} noOverdue />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="flex-1 py-2 text-xs text-subtle border border-border rounded-xl hover:border-border-2 transition-colors">
                Отмена
              </button>
              <button onClick={save} disabled={!name.trim() || saving}
                className="flex-[2] py-2 text-xs bg-[#6c63ff] hover:bg-[#8b85ff] text-white rounded-xl transition-colors disabled:opacity-40"
              >{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        )}

        {/* Description (read mode) */}
        {!editing && project.description && (
          <p className="text-xs text-text-6 leading-relaxed">{project.description}</p>
        )}

        {/* Tasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted uppercase tracking-widest">Задачи</p>
            <button onClick={() => setAddingTask(v => !v)}
              className="flex items-center gap-1 text-[10px] text-text-6 hover:text-[#6c63ff] transition-colors"
            >
              <Plus className="w-3 h-3" /> Добавить
            </button>
          </div>

          {addingTask && (
            <div className="flex gap-2 mb-2 animate-slide-up">
              <input
                autoFocus
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addTask()
                  if (e.key === 'Escape') { setAddingTask(false); setNewTask('') }
                }}
                placeholder="Название задачи..."
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-[#6c63ff]/40 placeholder:text-muted transition-colors"
              />
              <button onClick={addTask} disabled={!newTask.trim()}
                className="px-3 py-2 bg-[#6c63ff] hover:bg-[#8b85ff] text-white rounded-lg text-xs transition-colors disabled:opacity-40"
              >ОК</button>
            </div>
          )}

          {linked.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">Нет задач — добавьте первую</p>
          ) : (
            <div className="flex flex-col">
              {/* Active tasks first */}
              {linked.filter(t => !t.done).map(t => (
                <TaskRow key={t.id} task={t} onToggle={onTaskToggle} />
              ))}
              {linked.some(t => t.done) && linked.some(t => !t.done) && (
                <div className="h-px bg-[#1e1e1e] my-2" />
              )}
              {linked.filter(t => t.done).map(t => (
                <TaskRow key={t.id} task={t} onToggle={onTaskToggle} />
              ))}
            </div>
          )}
        </div>
      </div>
    </SidePanel>
  )
}

// ─── CreatePanel ───────────────────────────────────────────────────────────────

function CreatePanel({ userId, onSave, onClose }) {
  const [name,     setName]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [icon,     setIcon]     = useState('📁')
  const [color,    setColor]    = useState(PROJECT_COLORS[0])
  const [deadline, setDeadline] = useState('')
  const [saving,   setSaving]   = useState(false)

  const save = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    await onSave({ name: name.trim(), description: desc, icon, color, deadline: deadline || null, status: 'active' })
    setSaving(false)
  }

  return (
    <SidePanel panelClass="md:w-[400px]" onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-1 shrink-0">
        <span className="text-sm font-semibold text-text">Новый проект</span>
        <button onClick={onClose} className="p-1.5 rounded-lg text-text-6 hover:text-text hover:bg-muted/10 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-5 py-4">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Название проекта"
          className="bg-transparent border-b border-border focus:border-[#6c63ff]/40 pb-2 text-base font-medium text-text outline-none placeholder:text-muted transition-colors"
        />
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Описание (необязательно)"
          rows={2}
          className="bg-bg-2 border border-border rounded-lg px-3 py-2 text-xs text-text outline-none resize-none focus:border-[#6c63ff]/40 placeholder:text-muted transition-colors"
        />
        <div>
          <p className="text-[10px] text-text-7 mb-1.5">Иконка</p>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div>
          <p className="text-[10px] text-text-7 mb-1.5">Цвет</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div>
          <p className="text-[10px] text-text-7 mb-1.5">Дедлайн</p>
          <DatePicker value={deadline} onChange={setDeadline} noOverdue />
        </div>
      </div>
      <div className="px-5 py-4 border-t border-border-1 flex gap-2 shrink-0">
        <button onClick={onClose} className="flex-1 py-2.5 text-sm text-subtle border border-border rounded-xl hover:border-border-2 transition-colors">
          Отмена
        </button>
        <button onClick={save} disabled={!name.trim() || saving}
          className="flex-[2] py-2.5 text-sm bg-[#6c63ff] hover:bg-[#8b85ff] text-white font-medium rounded-xl transition-colors disabled:opacity-40"
        >{saving ? 'Создание...' : 'Создать проект'}</button>
      </div>
    </SidePanel>
  )
}

// ─── ProjectsModule ────────────────────────────────────────────────────────────

export default function ProjectsModule() {
  const { userId } = useOS()

  const [projects, setProjects] = useState([])
  const [tasks,    setTasks]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [panel,    setPanel]    = useState(null) // null | 'new' | project
  const [tab,      setTab]      = useState('active')

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true); setError(null)
    try {
      const [p, t] = await Promise.all([projectsRepo.list(userId), tasksRepo.list(userId)])
      setProjects(p); setTasks(t)
    } catch (err) {
      setError(err.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  // ── Grouped lists ───────────────────────────────────────────────────────────
  const byStatus = useMemo(() => {
    const active    = sortProjects(projects.filter(p => p.status === 'active'))
    const completed = projects.filter(p => p.status === 'completed').sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''))
    const archived  = projects.filter(p => p.status === 'archived').sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''))
    return { active, completed, archived }
  }, [projects])

  const tabCounts = { active: byStatus.active.length, completed: byStatus.completed.length, archived: byStatus.archived.length }
  const visibleList = byStatus[tab] ?? []

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const createProject = useCallback(async (fields) => {
    const optimistic = { id: `tmp-${Date.now()}`, ...fields, created_at: new Date().toISOString() }
    setProjects(p => [optimistic, ...p])
    setPanel(null)
    try {
      const saved = await projectsRepo.create(userId, fields)
      setProjects(p => p.map(x => x.id === optimistic.id ? saved : x))
      setPanel(saved)
    } catch {
      setProjects(p => p.filter(x => x.id !== optimistic.id))
    }
  }, [userId])

  const updateProject = useCallback(async (id, fields) => {
    const snap = projects
    setProjects(p => p.map(x => x.id === id ? { ...x, ...fields } : x))
    if (panel && typeof panel === 'object' && panel.id === id) {
      setPanel(prev => ({ ...prev, ...fields }))
    }
    try {
      const saved = await projectsRepo.update(id, fields)
      setProjects(p => p.map(x => x.id === id ? saved : x))
      if (panel && typeof panel === 'object' && panel.id === id) setPanel(saved)
    } catch {
      setProjects(snap)
    }
  }, [projects, panel])

  const changeStatus = useCallback(async (id, status) => {
    await updateProject(id, { status })
    if (panel && typeof panel === 'object' && panel.id === id) {
      setTab(status)
    }
  }, [updateProject, panel])

  const deleteProject = useCallback(async (id) => {
    const snap = projects
    setProjects(p => p.filter(x => x.id !== id))
    if (panel && typeof panel === 'object' && panel.id === id) setPanel(null)
    try { await projectsRepo.remove(id) }
    catch { setProjects(snap) }
  }, [projects, panel])

  // ── Task ops ────────────────────────────────────────────────────────────────
  const toggleTask = useCallback(async (taskId, currentDone) => {
    setTasks(p => p.map(t => t.id === taskId ? { ...t, done: !currentDone, status: !currentDone ? 'done' : 'todo' } : t))
    try {
      const saved = await tasksRepo.toggleComplete(taskId, currentDone)
      setTasks(p => p.map(t => t.id === taskId ? saved : t))
    } catch {
      setTasks(p => p.map(t => t.id === taskId ? { ...t, done: currentDone, status: currentDone ? 'done' : 'todo' } : t))
    }
  }, [])

  const createTask = useCallback(async (title, projectId) => {
    const optimistic = {
      id: `tmp-${Date.now()}`, title, text: title, status: 'todo', done: false,
      priority: 'medium', project_id: projectId, tags: [], recurrence: 'none',
      due_date: null, description: '', completed_at: null,
    }
    setTasks(p => [optimistic, ...p])
    try {
      const saved = await tasksRepo.create(userId, { title, project_id: projectId })
      setTasks(p => p.map(t => t.id === optimistic.id ? saved : t))
    } catch {
      setTasks(p => p.filter(t => t.id !== optimistic.id))
    }
  }, [userId])

  // ── Render ──────────────────────────────────────────────────────────────────
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

      {/* ── List pane ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <div className="px-4 sm:px-8 pt-5 sm:pt-8 pb-4 border-b border-surface shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: MODULE_ICONS.projects.color + '20' }}>
                <MODULE_ICONS.projects.Icon size={20} style={{ color: MODULE_ICONS.projects.color }} />
              </div>
              <div>
              <h1 className="text-2xl font-bold text-text">Проекты</h1>
              <p className="text-subtle text-sm mt-0.5">{byStatus.active.length} активных</p>
            </div></div>
            <button
              onClick={() => setPanel('new')}
              className="flex items-center gap-2 px-4 py-2 bg-[#6c63ff] hover:bg-[#8b85ff] text-white text-sm font-medium rounded-xl transition-colors"
            ><Plus className="w-4 h-4" /> Проект</button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-bg-2 rounded-xl p-1">
            {STATUS_TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === t.key ? 'bg-muted text-text' : 'text-text-6 hover:text-text'
                }`}
              >
                {t.label}
                {tabCounts[t.key] > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                    tab === t.key ? 'bg-[#3a3a3a] text-text-3' : 'bg-surface text-text-7'
                  }`}>{tabCounts[t.key]}</span>
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
                modId="projects"
                title="Проектов пока нет"
                description="Создайте первый проект и организуйте задачи"
                actionLabel="Создать проект"
                onAction={() => setPanel('new')}
              />
            ) : (
              <EmptyState
                modId="projects"
                title={tab === 'completed' ? 'Нет завершённых проектов' : 'Архив пуст'}
                compact
              />
            )
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {visibleList.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  tasks={tasks}
                  isSelected={panel && typeof panel === 'object' && panel.id === project.id}
                  onSelect={p => setPanel(p)}
                  onStatusChange={changeStatus}
                  onDelete={deleteProject}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      {panel === 'new' && (
        <CreatePanel userId={userId} onSave={createProject} onClose={() => setPanel(null)} />
      )}
      {panel && typeof panel === 'object' && (
        <DetailPanel
          key={panel.id}
          project={projects.find(p => p.id === panel.id) ?? panel}
          tasks={tasks}
          userId={userId}
          onClose={() => setPanel(null)}
          onUpdate={updateProject}
          onDelete={deleteProject}
          onTaskToggle={toggleTask}
          onTaskCreate={createTask}
        />
      )}
    </div>
  )
}
