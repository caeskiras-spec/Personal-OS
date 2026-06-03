import { supabase } from '../supabase'

const DEFAULTS = [
  { name: 'Здоровье',   emoji: '💪', color: '#22c55e' },
  { name: 'Карьера',    emoji: '💼', color: '#6c63ff' },
  { name: 'Финансы',    emoji: '💰', color: '#f59e0b' },
  { name: 'Отношения',  emoji: '❤️',  color: '#ec4899' },
  { name: 'Развитие',   emoji: '📚', color: '#3b82f6' },
  { name: 'Прочее',     emoji: '🎯', color: '#666666' },
]

export const goalCategoriesRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('goal_categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async ensureDefaults(userId) {
    const existing = await this.list(userId)
    if (existing.length > 0) return existing
    const rows = DEFAULTS.map(d => ({ user_id: userId, ...d }))
    const { data, error } = await supabase.from('goal_categories').insert(rows).select()
    if (error) throw error
    return data ?? []
  },

  async create(userId, { name, emoji, color }) {
    const { data, error } = await supabase
      .from('goal_categories')
      .insert({ user_id: userId, name, emoji: emoji || null, color: color || null })
      .select().single()
    if (error) throw error
    return data
  },

  async update(id, { name, emoji, color }) {
    const { data, error } = await supabase
      .from('goal_categories')
      .update({ name, emoji: emoji || null, color: color || null })
      .eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async remove(id) {
    const { error } = await supabase.from('goal_categories').delete().eq('id', id)
    if (error) throw error
  },
}
