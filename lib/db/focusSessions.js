import { supabase } from '../supabase'

function localStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export const focusSessionsRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async create(userId, { date, type, duration_minutes, task_id, project_id, completed }) {
    const { data, error } = await supabase
      .from('focus_sessions')
      .insert({
        user_id:          userId,
        date:             date             ?? localStr(),
        type:             type             ?? 'focus',
        duration_minutes: duration_minutes ?? 0,
        task_id:          task_id          ?? null,
        project_id:       project_id       ?? null,
        completed:        completed        ?? true,
      })
      .select().single()
    if (error) throw error
    return data
  },

  async remove(id) {
    const { error } = await supabase.from('focus_sessions').delete().eq('id', id)
    if (error) throw error
  },
}
