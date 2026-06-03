export function computeProgress(goal, milestones) {
  if (goal.progress_type === 'milestones') {
    const linked = milestones.filter(m => m.goal_id === goal.id)
    if (!linked.length) return 0
    return Math.round(linked.filter(m => m.done).length / linked.length * 100)
  }
  if (goal.progress_type === 'numeric') {
    if (!goal.target_value || goal.target_value <= 0) return 0
    return Math.min(100, Math.round(Number(goal.current_value ?? 0) / Number(goal.target_value) * 100))
  }
  return goal.progress ?? 0
}

export function deadlineStatus(deadline) {
  if (!deadline) return null
  const today = new Date().toISOString().slice(0, 10)
  if (deadline < today) {
    const days = Math.ceil((new Date(today) - new Date(deadline)) / 86400000)
    return { label: `Просрочено ${days} дн.`, color: '#ef4444' }
  }
  if (deadline === today) return { label: 'Сегодня', color: '#f59e0b' }
  const days = Math.ceil((new Date(deadline) - new Date(today)) / 86400000)
  if (days <= 3) return { label: `${days} дн.`, color: '#f59e0b' }
  const [y, m, d] = deadline.split('-')
  return {
    label: new Date(+y, +m - 1, +d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    color: '#555',
  }
}

export function sortGoals(goals) {
  return [...goals].sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
    if (a.deadline && !b.deadline) return -1
    if (!a.deadline && b.deadline) return 1
    return (b.created_at || '').localeCompare(a.created_at || '')
  })
}
