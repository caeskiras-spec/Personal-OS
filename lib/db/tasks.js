import { supabase } from '../supabase'

const VALID_STATUS   = ['todo', 'in_progress', 'done']
const VALID_PRIORITY = ['low', 'medium', 'high']
const VALID_RECURRENCE = ['none', 'daily', 'weekly', 'monthly']

function validate(fields) {
  if ('status' in fields && !VALID_STATUS.includes(fields.status))
    throw new Error(`Invalid status: ${fields.status}`)
  if ('priority' in fields && !VALID_PRIORITY.includes(fields.priority))
    throw new Error(`Invalid priority: ${fields.priority}`)
  if ('recurrence' in fields && !VALID_RECURRENCE.includes(fields.recurrence))
    throw new Error(`Invalid recurrence: ${fields.recurrence}`)
}

function toDB(fields) {
  const out = {}
  if ('title' in fields)        out.title        = fields.title
  if ('text' in fields)         out.title        = fields.text
  if ('status' in fields)       out.status       = fields.status
  if ('done' in fields)         out.status       = fields.done ? 'done' : 'todo'
  if ('priority' in fields)     out.priority     = fields.priority === 'normal' ? 'medium' : fields.priority
  if ('due_date' in fields)     out.due_date     = fields.due_date ?? null
  if ('description' in fields)  out.description  = fields.description ?? null
  if ('completed_at' in fields) out.completed_at = fields.completed_at ?? null
  if ('tags' in fields)         out.tags         = fields.tags ?? []
  if ('project_id' in fields)   out.project_id   = fields.project_id ?? null
  if ('recurrence' in fields)   out.recurrence   = fields.recurrence ?? 'none'
  validate(out)
  return out
}

function fromDB(row) {
  return {
    id:           row.id,
    title:        row.title,
    text:         row.title,
    status:       row.status || 'todo',
    done:         row.status === 'done',
    priority:     row.priority || 'medium',
    due_date:     row.due_date || null,
    description:  row.description || '',
    completed_at: row.completed_at || null,
    tags:         row.tags || [],
    project_id:   row.project_id || null,
    recurrence:   row.recurrence || 'none',
  }
}

export const tasksRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, fields) {
    const row = {
      user_id: userId,
      status: 'todo',
      priority: 'medium',
      tags: [],
      recurrence: 'none',
      ...toDB(fields),
    }
    const { data, error } = await supabase.from('tasks').insert(row).select().single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, fields) {
    const { data, error } = await supabase
      .from('tasks')
      .update(toDB(fields))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async toggleComplete(id, currentDone) {
    const newDone = !currentDone
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status:       newDone ? 'done' : 'todo',
        completed_at: newDone ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  },
}
