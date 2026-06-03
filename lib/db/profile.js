import { supabase } from '../supabase'

export const profileRepo = {
  async get(userId) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    return data ?? null
  },

  async upsert(userId, fields) {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({ user_id: userId, ...fields }, { onConflict: 'user_id' })
      .select().single()
    if (error) throw error
    return data
  },
}
