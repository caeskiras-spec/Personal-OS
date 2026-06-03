'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOSStore } from '../../lib/store';
import { MODULES } from '../../lib/modules';
import { LayoutDashboard, Store, Settings } from 'lucide-react';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/modules', icon: Store, label: 'Modules' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { state } = useOSStore();
  const installed = MODULES.filter(m => state.installedModules.includes(m.id));

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">OS</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Personal OS</p>
            <p className="text-xs text-gray-400">{state.userName || 'User'}</p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="p-3 space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                active ? 'bg-emerald-50 text-emerald-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Installed modules */}
      {installed.length > 0 && (
        <div className="p-3 mt-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">My Modules</p>
          <div className="space-y-1">
            {installed.map(mod => {
              const active = pathname === `/modules/${mod.id}`;
              return (
                <Link
                  key={mod.id}
                  href={`/modules/${mod.id}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                    active ? 'bg-emerald-50 text-emerald-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base">{mod.icon}</span>
                  {mod.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-auto p-4">
        <div className="bg-emerald-50 rounded-2xl p-3 text-center">
          <p className="text-xs font-semibold text-emerald-600">Personal OS</p>
          <p className="text-xs text-gray-400">v1.0 MVP</p>
        </div>
      </div>
    </aside>
  );
}