import { supabase } from '../supabase'

export const availabilityRepo = {
  /** List availability rules for a specific booking link */
  async listByLink(userId, linkId) {
    const { data, error } = await supabase
      .from('availability_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('link_id', linkId)
      .order('weekday')
    if (error) throw error
    return data ?? []
  },

  /**
   * Replace all rules for a link atomically (delete existing, insert new).
   * rules = [{ weekday, start_time, end_time }]
   */
  async replaceForLink(userId, linkId, rules) {
    // Delete all existing rules for this link
    const { error: delErr } = await supabase
      .from('availability_rules')
      .delete()
      .eq('user_id', userId)
      .eq('link_id', linkId)
    if (delErr) throw delErr

    if (!rules || rules.length === 0) return []

    const { data, error } = await supabase
      .from('availability_rules')
      .insert(rules.map(r => ({
        user_id:    userId,
        link_id:    linkId,
        weekday:    r.weekday,
        start_time: r.start_time,
        end_time:   r.end_time,
      })))
      .select()
    if (error) throw error
    return data ?? []
  },
}
