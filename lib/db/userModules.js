import { supabase } from '../supabase'

export const userModulesRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('user_modules')
      .select('module_id, position')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('position', { ascending: true, nullsFirst: false })
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
    // Individual UPDATEs are reliable with RLS; upsert paths can fail silently
    const results = await Promise.all(
      orderedIds.map((moduleId, i) =>
        supabase
          .from('user_modules')
          .update({ position: i })
          .eq('user_id', userId)
          .eq('module_id', moduleId)
      )
    )
    const failed = results.find(r => r.error)
    if (failed) throw failed.error
  },
}
