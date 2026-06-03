import { supabase } from '../supabase'

function fromDB(row) {
  return {
    id:       row.id,
    task_id:  row.task_id,
    title:    row.title,
    is_done:  row.is_done || false,
    position: row.position ?? 0,
  }
}

export const subtasksRepo = {
  /** Load all subtasks for a user (one query, group client-side) */
  async listByUser(userId) {
    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, taskId, title, position = 0) {
    const { data, error } = await supabase
      .from('subtasks')
      .insert({ user_id: userId, task_id: taskId, title, is_done: false, position })
      .select()
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async toggle(id, currentDone) {
    const { data, error } = await supabase
      .from('subtasks')
      .update({ is_done: !currentDone })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, title) {
    const { data, error } = await supabase
      .from('subtasks')
      .update({ title })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('subtasks').delete().eq('id', id)
    if (error) throw error
  },
}
