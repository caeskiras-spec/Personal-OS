'use client';

import { useOSStore } from '../../lib/store';
import { Bell, Search } from 'lucide-react';

export default function TopBar() {
  const { state } = useOSStore();
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">{dateStr}</p>
        <p className="text-xs text-gray-400">{timeStr}</p>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Search size={18} className="text-gray-500" />
        </button>
        <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Bell size={18} className="text-gray-500" />
        </button>
        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">
            {(state.userName || 'U')[0].toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  );
}