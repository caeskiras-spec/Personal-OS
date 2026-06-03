import { supabase } from '../supabase'

export const PROJECT_COLORS = [
  '#6c63ff', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#8b5cf6', '#ec4899', '#64748b',
  '#10b981', '#f97316',
]

export const PROJECT_ICONS = [
  '📁','🚀','⭐','💡','🎯','🔥','💼','📊',
  '🎨','🛠️','📝','🌿','🎵','📚','🌟','⚡',
]

function fromDB(row) {
  return {
    id:          row.id,
    name:        row.name,
    color:       row.color  || '#6c63ff',
    icon:        row.icon   || '📁',
    description: row.description || '',
    status:      row.status || 'active',
    deadline:    row.deadline || null,
    created_at:  row.created_at,
  }
}

export const projectsRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, fields) {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id:     userId,
        name:        fields.name,
        color:       fields.color       || PROJECT_COLORS[0],
        icon:        fields.icon        || '📁',
        description: fields.description || null,
        status:      fields.status      || 'active',
        deadline:    fields.deadline    || null,
      })
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, fields) {
    const patch = {}
    if ('name'        in fields) patch.name        = fields.name
    if ('color'       in fields) patch.color       = fields.color
    if ('icon'        in fields) patch.icon        = fields.icon
    if ('description' in fields) patch.description = fields.description ?? null
    if ('status'      in fields) patch.status      = fields.status
    if ('deadline'    in fields) patch.deadline    = fields.deadline ?? null

    const { data, error } = await supabase
      .from('projects')
      .update(patch)
      .eq('id', id)
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
  },
}
