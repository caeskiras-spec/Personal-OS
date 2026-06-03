'use client'

import { useState, useEffect } from 'react'
import { useOS } from '../../../lib/store'
import { journalRepo } from '../../../lib/db/journal'

const MOODS = ['😊', '😐', '😔', '🤩', '😤', '😴']

export default function JournalModule({ module: mod }) {
  const { userId } = useOS()
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  const [entries, setEntries] = useState([])
  const [current, setCurrent] = useState('')
  const [mood, setMood] = useState('😊')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    journalRepo.list(userId)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const save = async () => {
    if (!current.trim() || !userId) return
    const text = current
    const optimistic = { id: `tmp-${Date.now()}`, text, mood, date: new Date().toISOString().split('T')[0], tags: [] }
    setEntries(prev => [optimistic, ...prev])
    setCurrent('')
    setEditing(false)
    try {
      const saved = await journalRepo.create(userId, { text, mood })
      setEntries(prev => prev.map(e => e.id === optimistic.id ? saved : e))
    } catch {
      setEntries(prev => prev.filter(e => e.id !== optimistic.id))
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-xl text-pink-400">◉</div>
        <div>
          <h1 className="text-2xl font-bold text-text">Дневник</h1>
          <p className="text-subtle text-sm">{today}</p>
        </div>
      </div>

      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          className="w-full bg-surface border border-border rounded-xl p-5 text-left text-subtle hover:border-accent/40 transition-colors mb-6 group"
        >
          <span className="text-sm group-hover:text-text transition-colors">Написать сегодняшнюю запись...</span>
        </button>
      ) : (
        <div className="bg-surface border border-accent/30 rounded-xl p-5 mb-6 animate-slide-up">
          <div className="flex gap-2 mb-4">
            {MOODS.map(m => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className={`text-2xl p-1.5 rounded-lg transition-all ${mood === m ? 'scale-125' : 'opacity-50 hover:opacity-80'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <textarea
            value={current}
            onChange={e => setCurrent(e.target.value)}
            placeholder="Как прошёл день?"
            autoFocus
            rows={5}
            className="w-full bg-transparent text-text text-sm outline-none resize-none placeholder:text-muted leading-relaxed"
          />
          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-lg border border-border text-subtle text-sm">Отмена</button>
            <button onClick={save} className="flex-[2] py-2 rounded-lg bg-accent text-white text-sm font-medium">Сохранить</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-subtle text-sm py-8">Загрузка...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.length === 0 ? (
            <div className="text-center text-subtle text-sm py-8">Нет записей. Напишите первую!</div>
          ) : entries.map(entry => (
            <div key={entry.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{entry.mood}</span>
                <span className="text-subtle text-xs">{entry.date}</span>
              </div>
              <p className="text-text text-sm leading-relaxed">{entry.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
