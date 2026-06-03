import { supabase } from '../supabase'

export const journalTagsRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('journal_tags')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async create(userId, { name, emoji, color }) {
    const { data, error } = await supabase
      .from('journal_tags')
      .insert({ user_id: userId, name, emoji: emoji || null, color: color || null })
      .select().single()
    if (error) throw error
    return data
  },

  async update(id, { name, emoji, color }) {
    const { data, error } = await supabase
      .from('journal_tags')
      .update({ name, emoji: emoji || null, color: color || null })
      .eq('id', id)
      .select().single()
    if (error) throw error
    return data
  },

  async remove(id) {
    const { error } = await supabase.from('journal_tags').delete().eq('id', id)
    if (error) throw error
  },
}
