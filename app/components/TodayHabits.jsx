'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOS } from '../../lib/store'
import { habitsRepo } from '../../lib/db/habits'
import { habitCompletionsRepo } from '../../lib/db/habitCompletions'
import { getTodayStr } from '../../lib/tasks-selectors'
import { isScheduledToday } from '../../lib/habits-selectors'

export default function TodayHabits() {
  const { userId } = useOS()
  const [habits,    setHabits]    = useState([])
  const [doneToday, setDoneToday] = useState(new Set())
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!userId) return
    async function load() {
      try {
        const loaded = await habitsRepo.list(userId)
        setHabits(loaded)
        if (loaded.length > 0) {
          const ids    = loaded.map(h => h.id)
          const todayS = await habitCompletionsRepo.listTodayByHabits(userId, ids)
          setDoneToday(todayS)
        }
      } catch (e) {
        console.error(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId])

  const toggle = useCallback(async (habit) => {
    if (!isScheduledToday(habit)) return
    const wasD = doneToday.has(habit.id)
    const today = getTodayStr()
    setDoneToday(prev => {
      const next = new Set(prev)
      wasD ? next.delete(habit.id) : next.add(habit.id)
      return next
    })
    try {
      await habitCompletionsRepo.toggleByDate(userId, habit.id, today)
    } catch (e) {
      setDoneToday(prev => {
        const next = new Set(prev)
        wasD ? next.add(habit.id) : next.delete(habit.id)
        return next
      })
      console.error(e.message)
    }
  }, [userId, doneToday])

  const todayHabits = habits.filter(isScheduledToday)
  const doneCount   = todayHabits.filter(h => doneToday.has(h.id)).length

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-subtle">Привычки</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 w-24 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (todayHabits.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-subtle">Привычки</h2>
        <span className="text-xs text-subtle">{doneCount}/{todayHabits.length}</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {todayHabits.map(habit => {
          const done = doneToday.has(habit.id)
          return (
            <button
              key={habit.id}
              onClick={() => toggle(habit)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                done
                  ? 'border-success/40 text-success'
                  : 'bg-surface border-border text-subtle hover:border-muted hover:text-text'
              }`}
              style={done ? { backgroundColor: habit.color + '18', borderColor: habit.color + '60' } : {}}
            >
              <span>{habit.emoji}</span>
              {habit.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
