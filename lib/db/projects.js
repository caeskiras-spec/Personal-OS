import { supabase } from '../supabase'

export const PROJECT_COLORS = [
  '#6c63ff', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#8b5cf6', '#ec4899', '#64748b',
]

function fromDB(row) {
  return {
    id:    row.id,
    name:  row.name,
    color: row.color || '#6c63ff',
  }
}

export const projectsRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, name, color) {
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: userId, name, color: color || PROJECT_COLORS[0] })
      .select()
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, fields) {
    const { data, error } = await supabase
      .from('projects')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
  },
}
