'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useOS } from '../../lib/store'
import { tasksRepo }    from '../../lib/db/tasks'
import { subtasksRepo } from '../../lib/db/subtasks'
import { getTodayAndOverdue, getTodayStr, formatDueDate, isOverdue } from '../../lib/tasks-selectors'
import InlineSubtaskList from './modules/InlineSubtaskList'
import TagChips          from './modules/TagChips'

export default function TodayTasks() {
  const { userId } = useOS()
  const [tasks,          setTasks]          = useState([])
  const [subtasksByTask, setSubtasksByTask] = useState({})
  const [expandedSubs,   setExpandedSubs]   = useState(new Set())
  const [loading,        setLoading]        = useState(true)
  const [input,          setInput]          = useState('')

  useEffect(() => {
    if (!userId) return
    Promise.all([
      tasksRepo.list(userId),
      subtasksRepo.listByUser(userId),
    ]).then(([taskList, subList]) => {
      setTasks(taskList)
      const byTask = {}
      subList.forEach(s => {
        if (!byTask[s.task_id]) byTask[s.task_id] = []
        byTask[s.task_id].push(s)
      })
      setSubtasksByTask(byTask)
      // Home = today view → all tasks with subtasks start expanded
      setExpandedSubs(new Set(
        taskList
          .filter(t => t.status !== 'done' && (byTask[t.id] || []).length > 0)
          .map(t => t.id)
      ))
    }).catch(e => console.error('TodayTasks load:', e.message))
      .finally(() => setLoading(false))
  }, [userId])

  const visible   = getTodayAndOverdue(tasks)
  const remaining = visible.filter(t => !t.done).length

  // ── task toggle ──────────────────────────────────────────────────────────────

  const toggle = useCallback(async (task) => {
    const newDone = !task.done
    setTasks(prev => prev.map(t => t.id === task.id ? {
      ...t, done: newDone,
      status:       newDone ? 'done' : 'todo',
      completed_at: newDone ? new Date().toISOString() : null,
    } : t))
    try {
      await tasksRepo.toggleComplete(task.id, task.done)
    } catch(e) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      console.error('TodayTasks toggle:', e.message)
    }
  }, [])

  // ── subtask toggle ───────────────────────────────────────────────────────────

  const toggleSubtask = useCallback(async (subtask) => {
    const tid = subtask.task_id
    setSubtasksByTask(prev => ({
      ...prev,
      [tid]: (prev[tid] || []).map(s => s.id === subtask.id ? { ...s, is_done: !s.is_done } : s),
    }))
    try {
      await subtasksRepo.toggle(subtask.id, subtask.is_done)
    } catch(e) {
      setSubtasksByTask(prev => ({
        ...prev,
        [tid]: (prev[tid] || []).map(s => s.id === subtask.id ? { ...s, is_done: subtask.is_done } : s),
      }))
      console.error('TodayTasks toggleSubtask:', e.message)
    }
  }, [])

  const toggleSubExpand = (taskId) => setExpandedSubs(prev => {
    const n = new Set(prev); n.has(taskId) ? n.delete(taskId) : n.add(taskId); return n
  })

  // ── quick add ─────────────────────────────────────────────────────────────────

  const add = useCallback(async () => {
    const title = input.trim()
    if (!title || !userId) return
    const today = getTodayStr()
    const optimistic = {
      id: `tmp-${Date.now()}`, title, text: title,
      status: 'todo', done: false, priority: 'medium',
      due_date: today, description: '', completed_at: null,
      tags: [], project_id: null, recurrence: 'none',
    }
    setTasks(prev => [optimistic, ...prev])
    setInput('')
    try {
      const saved = await tasksRepo.create(userId, { title, due_date: today })
      setTasks(prev => prev.map(t => t.id === optimistic.id ? saved : t))
    } catch(e) {
      setTasks(prev => prev.filter(t => t.id !== optimistic.id))
      console.error('TodayTasks add:', e.message)
    }
  }, [input, userId])

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-subtle">Задачи на сегодня</h2>
        {!loading && <span className="text-xs text-subtle">{remaining} осталось</span>}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <>
            {[0, 1, 2].map(i => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 animate-pulse ${i > 0 ? 'border-t border-border' : ''}`}>
                <div className="w-5 h-5 rounded-full bg-muted shrink-0" />
                <div className="flex-1 h-3.5 bg-muted rounded" style={{ width: `${50 + i * 15}%` }} />
              </div>
            ))}
          </>
        ) : visible.length === 0 ? (
          <div className="px-4 py-6 text-center text-subtle text-sm">
            Задач на сегодня нет
          </div>
        ) : (
          visible.map((task, i) => {
            const subtasks = subtasksByTask[task.id] || []
            const subTotal  = subtasks.length
            const subDone   = subtasks.filter(s => s.is_done).length
            const isExpanded = expandedSubs.has(task.id)
            const dueFmt     = formatDueDate(task.due_date)
            const overdue    = isOverdue(task.due_date)

            return (
              <div key={task.id} className={i > 0 ? 'border-t border-border' : ''}>
                {/* Main task row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Completion checkbox — not affected by subtask e.stopPropagation */}
                  <button
                    type="button"
                    onClick={() => toggle(task)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      task.done ? 'bg-success border-success' : 'border-muted hover:border-accent'
                    }`}
                  >
                    {task.done && <Check className="w-3 h-3 text-white" />}
                  </button>

                  {/* Title */}
                  <span className={`flex-1 text-sm min-w-0 truncate ${task.done ? 'line-through text-subtle' : 'text-text'}`}>
                    {task.title}
                  </span>

                  {/* Metadata: subtask progress + due label */}
                  <div className="flex items-center gap-2 shrink-0">
                    {subTotal > 0 && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); toggleSubExpand(task.id) }}
                        className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                          isExpanded
                            ? 'bg-accent/20 text-accent'
                            : 'bg-muted/40 text-subtle hover:text-text'
                        }`}
                      >
                        {subDone}/{subTotal}
                        {isExpanded
                          ? <ChevronDown  className="w-2.5 h-2.5 ml-0.5" />
                          : <ChevronRight className="w-2.5 h-2.5 ml-0.5" />}
                      </button>
                    )}
                    {dueFmt && !task.done && (
                      <span className={`text-xs ${overdue ? 'text-danger' : 'text-subtle'}`}>
                        {dueFmt}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tags row */}
                {(task.tags || []).length > 0 && (
                  <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
                    <TagChips tags={task.tags} />
                  </div>
                )}

                {/* Inline subtask checklist (disabled for done tasks) */}
                {isExpanded && subTotal > 0 && (
                  <InlineSubtaskList
                    subtasks={subtasks}
                    onToggle={toggleSubtask}
                    disabled={task.done}
                  />
                )}
              </div>
            )
          })
        )}

        {/* Quick add */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-border">
          <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted shrink-0" />
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Добавить задачу на сегодня..."
            className="flex-1 bg-transparent text-sm text-subtle placeholder:text-muted outline-none"
          />
          <button
            onClick={add}
            disabled={!input.trim()}
            className="text-accent text-xs hover:text-accent-light disabled:text-muted disabled:cursor-default transition-colors shrink-0"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}
