import { supabase } from '../supabase'

export const bookingLinksRepo = {
  /** List all booking links for a user */
  async list(userId) {
    const { data, error } = await supabase
      .from('booking_links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  /** Get the first (primary) booking link for a user */
  async getFirst(userId) {
    const { data, error } = await supabase
      .from('booking_links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ?? null
  },

  async create(userId, fields) {
    const { data, error } = await supabase
      .from('booking_links')
      .insert({ user_id: userId, ...fields })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, fields) {
    const { data, error } = await supabase
      .from('booking_links')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async remove(id) {
    const { error } = await supabase
      .from('booking_links')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
