'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOS } from '@/lib/store'

export default function QuickCapture({ onAdded }) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const { state } = useOS()

  const handleAdd = async () => {
    if (!value.trim()) return
    setLoading(true)
    try {
      const userId = state.user?.id || 'anonymous'
      await supabase.from('tasks').insert({
        user_id: userId,
        title: value.trim(),
        status: 'todo',
        priority: 'medium',
        due_date: new Date().toISOString().split('T')[0],
      })
      setValue('')
      if (onAdded) onAdded()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        className="os-input flex-1"
        placeholder="Быстро добавить задачу..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
      />
      <button
        onClick={handleAdd}
        disabled={!value.trim() || loading}
        className="os-button os-button-primary px-4 disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}