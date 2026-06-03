'use client';

import { useOSStore } from '../../lib/store';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsContent() {
  const { state, dispatch } = useOSStore();
  const router = useRouter();
  const [name, setName] = useState(state.userName || '');

  const saveSettings = () => {
    dispatch({ type: 'SET_USER_NAME', payload: name });
  };

  const resetOS = () => {
    dispatch({ type: 'RESET' });
    router.push('/onboarding');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4">Profile</h2>
          <label className="block text-sm font-medium text-gray-600 mb-2">Your Name</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={saveSettings}
              className="bg-emerald-500 text-white px-5 py-3 rounded-xl font-semibold hover:bg-emerald-600 transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {/* Modules summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-2">Active Modules</h2>
          <p className="text-gray-500 text-sm mb-4">
            You have <span className="font-bold text-emerald-600">{state.installedModules.length}</span> modules installed.
          </p>
          <a href="/modules" className="text-emerald-500 text-sm font-medium hover:underline">
            Manage modules →
          </a>
        </div>

        {/* Reset */}
        <div className="bg-white rounded-2xl border border-red-100 p-6">
          <h2 className="font-bold text-gray-800 mb-2">Reset System</h2>
          <p className="text-gray-500 text-sm mb-4">This will clear all your data and restart the onboarding.</p>
          <button
            onClick={resetOS}
            className="bg-red-50 text-red-500 px-5 py-3 rounded-xl font-semibold hover:bg-red-100 transition-colors"
          >
            Reset Personal OS
          </button>
        </div>
      </div>
    </div>
  );
}