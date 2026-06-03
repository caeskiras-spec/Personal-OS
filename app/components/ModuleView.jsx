'use client'

import { useOS } from '../../lib/store'
import { getModuleById } from '../../lib/modules'
import { useRouter } from 'next/navigation'
import TasksModule     from './modules/TasksModule'
import HabitsModule    from './modules/HabitsModule'
import FitnessModule   from './modules/FitnessModule'
import NutritionModule from './modules/NutritionModule'
import SleepModule     from './modules/SleepModule'
import FinanceModule   from './modules/FinanceModule'
import JournalModule   from './modules/JournalModule'
import CalendarModule  from './modules/CalendarModule'
import FocusModule     from './modules/FocusModule'
import ProjectsModule  from './modules/ProjectsModule'
import GoalsModule     from './modules/GoalsModule'
import GenericModule   from './modules/GenericModule'

const MODULE_COMPONENTS = {
  tasks:     TasksModule,
  habits:    HabitsModule,
  fitness:   FitnessModule,
  nutrition: NutritionModule,
  sleep:     SleepModule,
  finance:   FinanceModule,
  journal:   JournalModule,
  calendar:  CalendarModule,
  focus:     FocusModule,
  projects:  ProjectsModule,
  goals:     GoalsModule,
}

export default function ModuleView({ moduleId }) {
  const { activeModules, addModule } = useOS()
  const router = useRouter()
  const mod = getModuleById(moduleId)

  if (!mod) {
    return (
      <div className="p-8 flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-subtle">Модуль не найден</p>
        <button onClick={() => router.push('/modules')} className="text-accent hover:underline text-sm">
          ← Назад к модулям
        </button>
      </div>
    )
  }

  const isActive = activeModules.includes(moduleId)

  if (!isActive) {
    return (
      <div className="p-8 flex flex-col items-center gap-6 py-20 text-center max-w-sm mx-auto">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
          style={{ backgroundColor: mod.color + '20', color: mod.color }}
        >
          {mod.icon}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text">{mod.name}</h2>
          <p className="text-subtle mt-2">{mod.description}</p>
        </div>
        <button
          onClick={() => addModule(moduleId)}
          className="bg-accent hover:bg-accent-light text-white font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          Подключить модуль
        </button>
      </div>
    )
  }

  const Component = MODULE_COMPONENTS[moduleId] || GenericModule
  return <Component module={mod} />
}