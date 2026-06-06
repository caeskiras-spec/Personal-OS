'use client';

import { useOS } from '../../lib/store';
import { ALL_MODULES as MODULES } from '../../lib/modules';
import FitnessModule from './modules/FitnessModule';
import TasksModule from './modules/TasksModule';
import HabitsModule from './modules/HabitsModule';
import FinanceModule from './modules/FinanceModule';
import JournalModule from './modules/JournalModule';
import GenericModule from './modules/GenericModule';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const MODULE_COMPONENTS = {
  fitness: FitnessModule,
  tasks: TasksModule,
  habits: HabitsModule,
  finance: FinanceModule,
  journal: JournalModule,
};

export default function ModulePage({ moduleId }) {
  const { activeModules } = useOS();
  const moduleDef = MODULES.find(m => m.id === moduleId);
  const isInstalled = activeModules.includes(moduleId);

  if (!moduleDef) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-2xl font-bold text-gray-800 mb-2">Module not found</p>
        <Link href="/modules" className="text-emerald-500 hover:underline mt-4">← Back to modules</Link>
      </div>
    );
  }

  const ModuleComponent = MODULE_COMPONENTS[moduleId] || GenericModule;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="text-3xl">{moduleDef.icon}</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{moduleDef.name}</h1>
          <p className="text-sm text-gray-500">{moduleDef.description}</p>
        </div>
      </div>

      {isInstalled ? (
        <ModuleComponent moduleId={moduleId} />
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-2xl">
          <div className="text-5xl mb-4">{moduleDef.icon}</div>
          <p className="text-xl font-bold text-gray-800 mb-2">Module not installed</p>
          <p className="text-gray-500 mb-6">Install this module from the store to start using it.</p>
          <Link
            href="/modules"
            className="bg-emerald-500 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-emerald-600 transition-colors"
          >
            Go to Module Store
          </Link>
        </div>
      )}
    </div>
  );
}