import { supabase } from '../supabase'

function localStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fromDB(row) {
  return {
    id:                  row.id,
    title:               row.title,
    description:         row.description   || '',
    category_id:         row.category_id   || null,
    progress_type:       row.progress_type  || 'percent',
    progress:            row.progress       ?? 0,
    current_value:       row.current_value  ?? 0,
    target_value:        row.target_value   ?? null,
    unit:                row.unit           || '',
    status:              row.status         || 'active',
    deadline:            row.deadline       || null,
    color:               row.color          || '#6c63ff',
    icon:                row.icon           || '🎯',
    linked_project_ids:  row.linked_project_ids  || [],
    linked_task_ids:     row.linked_task_ids     || [],
    linked_habit_ids:    row.linked_habit_ids    || [],
    created_at:          row.created_at,
  }
}

function toPatch(fields) {
  const p = {}
  const allowed = ['title','description','category_id','progress_type','progress',
    'current_value','target_value','unit','status','deadline','color','icon',
    'linked_project_ids','linked_task_ids','linked_habit_ids']
  for (const k of allowed) {
    if (k in fields) p[k] = fields[k] ?? null
  }
  return p
}

export const goalsRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('goals').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, fields) {
    const { data, error } = await supabase.from('goals')
      .insert({ user_id: userId, ...toPatch(fields) })
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, fields) {
    const { data, error } = await supabase.from('goals')
      .update(toPatch(fields)).eq('id', id).select().single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) throw error
  },
}
