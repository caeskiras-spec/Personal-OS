import { supabase } from '../supabase'

export const meetingsRepo = {
  /** List all meetings for a user, newest first */
  async list(userId) {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', userId)
      .order('start_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async create(userId, fields) {
    const { data, error } = await supabase
      .from('meetings')
      .insert({ user_id: userId, ...fields })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, fields) {
    const { data, error } = await supabase
      .from('meetings')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async cancel(id) {
    const { data, error } = await supabase
      .from('meetings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },
}
