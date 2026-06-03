'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOS } from '../../lib/store';
import { ALL_MODULES as MODULES } from '../../lib/modules';

const STEPS = ['welcome', 'name', 'modules', 'ready'];

export default function OnboardingFlow() {
  const router = useRouter();
  const { completeOnboarding } = useOS();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);

  const toggleModule = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const finish = () => {
    completeOnboarding(selected.length > 0 ? selected : ['tasks']);
    router.push('/home');
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Progress dots */}
        <div className="flex gap-2 justify-center mb-10">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-emerald-500' : i < step ? 'w-2 bg-emerald-300' : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Step: Welcome */}
        {step === 0 && (
          <div className="text-center">
            <div className="text-6xl mb-6">🚀</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome to<br />Personal OS</h1>
            <p className="text-gray-500 text-lg mb-10">Your personal life management system. Build it your way.</p>
            <button
              onClick={() => setStep(1)}
              className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-600 transition-colors"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Step: Name */}
        {step === 1 && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">What should we call you?</h2>
            <p className="text-gray-500 mb-8">This helps personalize your experience.</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name..."
              className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-emerald-500 transition-colors mb-6"
              autoFocus
            />
            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step: Modules */}
        {step === 2 && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose your modules</h2>
            <p className="text-gray-500 mb-6">Select what you want to track. You can change this later.</p>
            <div className="grid grid-cols-2 gap-3 mb-8 max-h-96 overflow-y-auto pr-1">
              {MODULES.map(mod => (
                <button
                  key={mod.id}
                  onClick={() => toggleModule(mod.id)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                    selected.includes(mod.id)
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{mod.icon}</span>
                  <div>
                    <p className={`font-semibold text-sm ${selected.includes(mod.id) ? 'text-emerald-700' : 'text-gray-800'}`}>
                      {mod.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(3)}
              disabled={selected.length === 0}
              className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue ({selected.length} selected)
            </button>
          </div>
        )}

        {/* Step: Ready */}
        {step === 3 && (
          <div className="text-center">
            <div className="text-6xl mb-6">✨</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">You're all set, {name}!</h2>
            <p className="text-gray-500 mb-4">Your Personal OS is ready with {selected.length} module{selected.length !== 1 ? 's' : ''}.</p>
            <div className="flex flex-wrap gap-2 justify-center mb-10">
              {selected.map(id => {
                const mod = MODULES.find(m => m.id === id);
                return mod ? (
                  <span key={id} className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">
                    {mod.icon} {mod.name}
                  </span>
                ) : null;
              })}
            </div>
            <button
              onClick={finish}
              className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-600 transition-colors"
            >
              Launch My OS 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}