import { supabase } from '../supabase'

function fromDB(row) {
  return {
    id:        row.id,
    userId:    row.user_id,
    date:      row.date,
    mealType:  row.meal_type,
    name:      row.name,
    calories:  row.calories  ?? 0,
    protein:   Number(row.protein  ?? 0),
    carbs:     Number(row.carbs    ?? 0),
    fat:       Number(row.fat      ?? 0),
    time:      row.time      ?? null,
    createdAt: row.created_at,
  }
}

export const foodEntriesRepo = {
  async listByDate(userId, date) {
    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async listAll(userId) {
    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, { date, mealType, name, calories, protein, carbs, fat, time }) {
    const { data, error } = await supabase
      .from('food_entries')
      .insert({
        user_id:   userId,
        date:      date,
        meal_type: mealType  || 'breakfast',
        name:      name,
        calories:  calories  || 0,
        protein:   protein   || 0,
        carbs:     carbs     || 0,
        fat:       fat       || 0,
        time:      time      || null,
      })
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, { name, calories, protein, carbs, fat, mealType, date }) {
    const patch = {}
    if (name      !== undefined) patch.name      = name
    if (calories  !== undefined) patch.calories  = calories  || 0
    if (protein   !== undefined) patch.protein   = protein   || 0
    if (carbs     !== undefined) patch.carbs     = carbs     || 0
    if (fat       !== undefined) patch.fat       = fat       || 0
    if (mealType  !== undefined) patch.meal_type = mealType
    if (date      !== undefined) patch.date      = date
    const { data, error } = await supabase
      .from('food_entries')
      .update(patch)
      .eq('id', id)
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('food_entries').delete().eq('id', id)
    if (error) throw error
  },
}
