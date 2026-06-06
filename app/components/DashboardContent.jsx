'use client';

import { useOS } from '../../lib/store';
import { ALL_MODULES } from '../../lib/modules';
import Link from 'next/link';
import { Plus, TrendingUp, Zap } from 'lucide-react';

export default function DashboardContent() {
  const { activeModules } = useOS();
  const installed = ALL_MODULES.filter(m => activeModules.includes(m.id));
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Доброе утро';
    if (h < 17) return 'Добрый день';
    return 'Добрый вечер';
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-500 text-sm font-medium mb-1">{greeting()}</p>
        <h1 className="text-3xl font-bold text-gray-900">Добро пожаловать 👋</h1>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-emerald-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">Active Modules</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{installed.length}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-blue-500" />
            <span className="text-xs font-medium text-blue-600">Streak</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">7 🔥</p>
        </div>
        <div className="bg-purple-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-purple-600">Life Score</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">84%</p>
        </div>
      </div>

      {/* Modules grid */}
      {installed.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-3xl">
          <p className="text-5xl mb-4">📦</p>
          <p className="text-xl font-bold text-gray-800 mb-2">No modules yet</p>
          <p className="text-gray-500 mb-6">Add your first module to get started</p>
          <Link href="/modules" className="bg-emerald-500 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-emerald-600 transition-colors">
            Browse Modules
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-bold text-gray-800 mb-4">Your Modules</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {installed.map(mod => (
              <Link
                key={mod.id}
                href={`/modules/${mod.id}`}
                className="group bg-white border-2 border-gray-100 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-md transition-all"
              >
                <div className="text-3xl mb-3">{mod.icon}</div>
                <p className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">{mod.name}</p>
                <p className="text-xs text-gray-400 mt-1">{mod.description}</p>
              </Link>
            ))}
            <Link
              href="/modules"
              className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center hover:border-emerald-300 transition-all group"
            >
              <Plus size={24} className="text-gray-400 group-hover:text-emerald-500 transition-colors mb-2" />
              <p className="text-sm font-medium text-gray-400 group-hover:text-emerald-500 transition-colors">Add Module</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}