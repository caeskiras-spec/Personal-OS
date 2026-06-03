import { supabase } from '../supabase'

export const userModulesRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('user_modules')
      .select('module_id, position')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('position')
    if (error) throw error
    return (data ?? []).map(r => r.module_id)
  },

  async upsert(userId, moduleId, position = 0) {
    const { error } = await supabase
      .from('user_modules')
      .upsert(
        { user_id: userId, module_id: moduleId, is_active: true, position },
        { onConflict: 'user_id,module_id' }
      )
    if (error) throw error
  },

  async remove(userId, moduleId) {
    const { error } = await supabase
      .from('user_modules')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('module_id', moduleId)
    if (error) throw error
  },

  async reorder(userId, orderedIds) {
    const rows = orderedIds.map((moduleId, i) => ({
      user_id: userId,
      module_id: moduleId,
      is_active: true,
      position: i,
    }))
    const { error } = await supabase
      .from('user_modules')
      .upsert(rows, { onConflict: 'user_id,module_id' })
    if (error) throw error
  },
}
