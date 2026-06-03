import { supabase } from '../supabase'

const VALID_SCHEDULES = ['daily', 'custom']

function fromDB(row) {
  return {
    id:            row.id,
    name:          row.name,
    emoji:         row.emoji         ?? '◎',
    color:         row.color         ?? '#6c63ff',
    schedule:      row.schedule      ?? 'daily',
    schedule_days: row.schedule_days ?? [],
    streak:        row.streak        ?? 0,
    best_streak:   row.best_streak   ?? 0,
    position:      row.position      ?? 0,
  }
}

export const habitsRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, { name, emoji = '◎', color = '#6c63ff', schedule = 'daily', schedule_days = [], position = 0 }) {
    const { data, error } = await supabase
      .from('habits')
      .insert({
        user_id: userId,
        name,
        emoji,
        color,
        schedule: VALID_SCHEDULES.includes(schedule) ? schedule : 'daily',
        schedule_days,
        streak: 0,
        best_streak: 0,
        position,
      })
      .select()
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, fields) {
    const allowed = {}
    if (fields.name          !== undefined) allowed.name          = fields.name
    if (fields.emoji         !== undefined) allowed.emoji         = fields.emoji
    if (fields.color         !== undefined) allowed.color         = fields.color
    if (fields.schedule      !== undefined) allowed.schedule      = VALID_SCHEDULES.includes(fields.schedule) ? fields.schedule : 'daily'
    if (fields.schedule_days !== undefined) allowed.schedule_days = fields.schedule_days
    if (fields.streak        !== undefined) allowed.streak        = fields.streak
    if (fields.best_streak   !== undefined) allowed.best_streak   = fields.best_streak
    if (fields.position      !== undefined) allowed.position      = fields.position

    const { data, error } = await supabase
      .from('habits')
      .update(allowed)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async updatePosition(id, position) {
    const { error } = await supabase.from('habits').update({ position }).eq('id', id)
    if (error) throw error
  },

  async remove(id) {
    const { error } = await supabase.from('habits').delete().eq('id', id)
    if (error) throw error
  },
}
