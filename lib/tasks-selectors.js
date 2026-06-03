export function getTodayStr() {
  const d   = new Date()
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function groupTasks(tasks) {
  const today = getTodayStr()
  const active = tasks.filter(t => t.status !== 'done')
  const done   = tasks.filter(t => t.status === 'done')
  return {
    overdue:  active.filter(t => t.due_date && t.due_date < today),
    today:    active.filter(t => t.due_date === today),
    upcoming: active.filter(t => t.due_date && t.due_date > today),
    noDate:   active.filter(t => !t.due_date),
    done,
  }
}

// Today View: только задачи с due_date = сегодня или просроченные (без срока — не включаем)
export function getTodayAndOverdue(tasks) {
  const today = getTodayStr()
  return tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date <= today)
}

export function formatDueDate(due_date) {
  if (!due_date) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(due_date + 'T00:00:00')
  const diff = Math.round((due - now) / 86400000)
  if (diff < 0) return `Просрочено ${Math.abs(diff)} дн.`
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Завтра'
  return due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function isOverdue(due_date) {
  if (!due_date) return false
  return due_date < getTodayStr()
}

export function calculateNextDueDate(dueDateStr, recurrence) {
  const base = dueDateStr ? new Date(dueDateStr + 'T00:00:00') : new Date()
  switch (recurrence) {
    case 'daily':
      return new Date(base.getTime() + 86400000).toISOString().split('T')[0]
    case 'weekly':
      return new Date(base.getTime() + 7 * 86400000).toISOString().split('T')[0]
    case 'monthly': {
      const d = new Date(base)
      d.setMonth(d.getMonth() + 1)
      return d.toISOString().split('T')[0]
    }
    default:
      return null
  }
}
