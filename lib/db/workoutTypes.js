import { supabase } from '../supabase'

export const DEFAULT_TYPES = [
  { name: 'Силовая',   emoji: '🏋️', color: '#ef4444' },
  { name: 'Кардио',    emoji: '🏃', color: '#f59e0b' },
  { name: 'Бег',       emoji: '👟', color: '#22c55e' },
  { name: 'Йога',      emoji: '🧘', color: '#8b5cf6' },
  { name: 'Плавание',  emoji: '🏊', color: '#3b82f6' },
  { name: 'Велосипед', emoji: '🚴', color: '#06b6d4' },
]

export const workoutTypesRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('workout_types')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
    if (error) throw error
    return data ?? []
  },

  /** Seed default types if user has none yet; returns the full list. */
  async ensureDefaults(userId) {
    const existing = await this.list(userId)
    if (existing.length > 0) return existing
    const rows = DEFAULT_TYPES.map(t => ({ user_id: userId, ...t }))
    const { data, error } = await supabase
      .from('workout_types')
      .insert(rows)
      .select()
    if (error) throw error
    return data ?? []
  },

  async create(userId, { name, emoji, color }) {
    const { data, error } = await supabase
      .from('workout_types')
      .insert({ user_id: userId, name, emoji, color })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, { name, emoji, color }) {
    const { data, error } = await supabase
      .from('workout_types')
      .update({ name, emoji, color })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async remove(id) {
    const { error } = await supabase.from('workout_types').delete().eq('id', id)
    if (error) throw error
  },
}
