import { supabase } from '../supabase'

function fromDB(row) {
  return {
    id:              row.id,
    userId:          row.user_id,
    date:            row.date,
    bedtime:         row.bedtime      ?? null,
    wakeTime:        row.wake_time    ?? null,
    durationMinutes: row.duration_minutes ?? 0,
    quality:         row.quality      ?? null,
    notes:           row.notes        ?? '',
    createdAt:       row.created_at,
  }
}

export const sleepRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('sleep_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, { date, bedtime, wakeTime, durationMinutes, quality, notes }) {
    const { data, error } = await supabase
      .from('sleep_entries')
      .insert({
        user_id:          userId,
        date:             date,
        bedtime:          bedtime          ?? null,
        wake_time:        wakeTime         ?? null,
        duration_minutes: durationMinutes  ?? 0,
        quality:          quality          ?? null,
        notes:            notes            ?? '',
      })
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, { date, bedtime, wakeTime, durationMinutes, quality, notes }) {
    const patch = {}
    if (date             !== undefined) patch.date             = date
    if (bedtime          !== undefined) patch.bedtime          = bedtime ?? null
    if (wakeTime         !== undefined) patch.wake_time        = wakeTime ?? null
    if (durationMinutes  !== undefined) patch.duration_minutes = durationMinutes ?? 0
    if (quality          !== undefined) patch.quality          = quality ?? null
    if (notes            !== undefined) patch.notes            = notes ?? ''
    const { data, error } = await supabase
      .from('sleep_entries')
      .update(patch)
      .eq('id', id)
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('sleep_entries').delete().eq('id', id)
    if (error) throw error
  },
}
