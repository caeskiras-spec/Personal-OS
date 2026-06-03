import { supabase } from '../supabase'

export const moduleDataRepo = {
  async get(userId, moduleId, dataType) {
    const { data } = await supabase
      .from('module_data')
      .select('content')
      .eq('user_id', userId)
      .eq('module_id', moduleId)
      .eq('data_type', dataType)
      .maybeSingle()
    return data?.content ?? null
  },

  async upsert(userId, moduleId, dataType, content) {
    const { error } = await supabase
      .from('module_data')
      .upsert(
        { user_id: userId, module_id: moduleId, data_type: dataType, content },
        { onConflict: 'user_id,module_id,data_type' }
      )
    if (error) throw error
  },
}
