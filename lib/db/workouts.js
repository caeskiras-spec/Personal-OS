import { supabase } from '../supabase'
import { getTodayStr } from '../tasks-selectors'

function fromDB(row) {
  const wt = row.workout_types ?? null   // joined type (may be null)
  return {
    id:        row.id,
    typeId:    row.type_id    ?? null,
    typeName:  wt?.name       ?? row.type ?? '',
    typeEmoji: wt?.emoji      ?? '⚡',
    typeColor: wt?.color      ?? '#22c55e',
    duration:  row.duration   ?? 0,
    calories:  row.calories   ?? null,
    notes:     row.notes      ?? '',
    date:      row.date,
    exercises: row.exercises  ?? [],
  }
}

const SELECT = '*, workout_types(id, name, emoji, color)'

export const workoutsRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('workouts')
      .select(SELECT)
      .eq('user_id', userId)
      .order('date',       { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, { typeId = null, typeName = '', duration = 0, calories = null, notes = '', date, exercises = [] }) {
    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id:   userId,
        type_id:   typeId,
        type:      typeName,   // legacy label — kept for CalendarModule backward compat
        duration:  duration  || 0,
        calories:  calories  || null,
        notes:     notes     || '',
        date:      date      || getTodayStr(),
        exercises: exercises || [],
      })
      .select(SELECT)
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, { typeId, typeName, duration, calories, notes, date, exercises }) {
    const patch = {}
    if (typeId    !== undefined) { patch.type_id = typeId; patch.type = typeName ?? '' }
    if (duration  !== undefined)   patch.duration  = duration  || 0
    if (calories  !== undefined)   patch.calories  = calories  || null
    if (notes     !== undefined)   patch.notes     = notes     || ''
    if (date      !== undefined)   patch.date      = date
    if (exercises !== undefined)   patch.exercises = exercises || []
    const { data, error } = await supabase
      .from('workouts')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('workouts').delete().eq('id', id)
    if (error) throw error
  },
}
