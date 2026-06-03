import { supabase } from '../supabase'

function fromDB(row) {
  return {
    id:       row.id,
    userId:   row.user_id,
    name:     row.name,
    calories: row.calories ?? 0,
    protein:  Number(row.protein ?? 0),
    carbs:    Number(row.carbs   ?? 0),
    fat:      Number(row.fat     ?? 0),
  }
}

export const foodFavoritesRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('food_favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, { name, calories, protein, carbs, fat }) {
    const { data, error } = await supabase
      .from('food_favorites')
      .insert({ user_id: userId, name, calories: calories || 0, protein: protein || 0, carbs: carbs || 0, fat: fat || 0 })
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('food_favorites').delete().eq('id', id)
    if (error) throw error
  },
}
