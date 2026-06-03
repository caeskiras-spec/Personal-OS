export const MODULE_CATEGORIES = [
  { id: 'productivity', label: 'Продуктивность', color: '#6c63ff' },
  { id: 'health', label: 'Здоровье', color: '#22c55e' },
  { id: 'finance', label: 'Финансы', color: '#f59e0b' },
  { id: 'personal', label: 'Личное', color: '#ec4899' }
]

export const ALL_MODULES = [
  {
    id: 'tasks',
    name: 'Задачи',
    description: 'Управление задачами и делами',
    icon: '✓',
    category: 'productivity',
    color: '#6c63ff'
  },
  {
    id: 'habits',
    name: 'Привычки',
    description: 'Отслеживание ежедневных привычек',
    icon: '◎',
    category: 'productivity',
    color: '#8b85ff'
  },
  {
    id: 'fitness',
    name: 'Тренировки',
    description: 'Планирование и учёт тренировок',
    icon: '⚡',
    category: 'health',
    color: '#22c55e'
  },
  {
    id: 'nutrition',
    name: 'Питание',
    description: 'Дневник питания и калорий',
    icon: '◑',
    category: 'health',
    color: '#10b981'
  },
  {
    id: 'sleep',
    name: 'Сон',
    description: 'Мониторинг качества сна',
    icon: '◐',
    category: 'health',
    color: '#3b82f6'
  },
  {
    id: 'finance',
    name: 'Финансы',
    description: 'Учёт доходов и расходов',
    icon: '◈',
    category: 'finance',
    color: '#f59e0b'
  },
  {
    id: 'journal',
    name: 'Дневник',
    description: 'Личный дневник и заметки',
    icon: '◉',
    category: 'personal',
    color: '#ec4899'
  },
  {
    id: 'goals',
    name: 'Цели',
    description: 'Долгосрочные цели и прогресс',
    icon: '◎',
    category: 'personal',
    color: '#8b5cf6'
  },
  {
    id: 'focus',
    name: 'Фокус',
    description: 'Таймер Помодоро и сессии',
    icon: '◑',
    category: 'productivity',
    color: '#f97316'
  },
  {
    id: 'projects',
    name: 'Проекты',
    description: 'Управление проектами',
    icon: '◫',
    category: 'productivity',
    color: '#06b6d4'
  },
  {
    id: 'calendar',
    name: 'Календарь',
    description: 'Задачи, привычки и тренировки в одном виде',
    icon: '▦',
    category: 'productivity',
    color: '#0891b2'
  }
]

export function getModuleById(id) {
  return ALL_MODULES.find(m => m.id === id)
}

export function getModulesByCategory(categoryId) {
  return ALL_MODULES.filter(m => m.category === categoryId)
}