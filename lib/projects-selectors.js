import { getTodayStr } from './tasks-selectors'

/** Tasks linked to a project */
export function getProjectTasks(tasks, projectId) {
  return tasks.filter(t => t.project_id === projectId)
}

/** done / total */
export function getProjectProgress(tasks, projectId) {
  const linked = getProjectTasks(tasks, projectId)
  const done   = linked.filter(t => t.done).length
  return { done, total: linked.length, pct: linked.length > 0 ? Math.round(done / linked.length * 100) : 0 }
}

/** Deadline status for display */
export function deadlineStatus(deadline) {
  if (!deadline) return null
  const today = getTodayStr()
  if (deadline < today) {
    const days = Math.ceil((new Date(today) - new Date(deadline)) / 86400000)
    return { label: `Просрочен ${days} дн.`, color: '#ef4444' }
  }
  if (deadline === today) return { label: 'Сегодня', color: '#f59e0b' }
  const days = Math.ceil((new Date(deadline) - new Date(today)) / 86400000)
  if (days <= 3) return { label: `${days} дн.`, color: '#f59e0b' }
  const [y, m, d] = deadline.split('-')
  return {
    label: new Date(+y, +m - 1, +d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    color: '#666',
  }
}

/** Sort: active by deadline ASC (nulls last), then created_at DESC */
export function sortProjects(projects) {
  return [...projects].sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
    if (a.deadline && !b.deadline) return -1
    if (!a.deadline && b.deadline) return 1
    return (b.created_at || '').localeCompare(a.created_at || '')
  })
}
