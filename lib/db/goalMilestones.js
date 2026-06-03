import { supabase } from '../supabase'

export const goalMilestonesRepo = {
  async listAll(userId) {
    const { data, error } = await supabase
      .from('goal_milestones').select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async create(userId, goalId, title, position) {
    const { data, error } = await supabase
      .from('goal_milestones')
      .insert({ user_id: userId, goal_id: goalId, title, position: position ?? 0 })
      .select().single()
    if (error) throw error
    return data
  },

  async toggle(id, done) {
    const { data, error } = await supabase
      .from('goal_milestones').update({ done }).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async updateTitle(id, title) {
    const { data, error } = await supabase
      .from('goal_milestones').update({ title }).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async reorder(userId, orderedIds) {
    const results = await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('goal_milestones').update({ position: i }).eq('user_id', userId).eq('id', id)
      )
    )
    const failed = results.find(r => r.error)
    if (failed) throw failed.error
  },

  async remove(id) {
    const { error } = await supabase.from('goal_milestones').delete().eq('id', id)
    if (error) throw error
  },
}
