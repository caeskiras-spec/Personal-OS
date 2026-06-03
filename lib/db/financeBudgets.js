import { supabase } from '../supabase'

function fromDB(row) {
  return {
    id:           row.id,
    userId:       row.user_id,
    categoryId:   row.category_id ?? null,
    monthlyLimit: Number(row.monthly_limit ?? 0),
    createdAt:    row.created_at,
  }
}

export const financeBudgetsRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('finance_budgets')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async upsert(userId, categoryId, monthlyLimit) {
    // Find existing budget for this category and user
    const { data: existing } = await supabase
      .from('finance_budgets')
      .select('id')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await supabase
        .from('finance_budgets')
        .update({ monthly_limit: monthlyLimit })
        .eq('id', existing.id)
        .select().single()
      if (error) throw error
      return fromDB(data)
    } else {
      const { data, error } = await supabase
        .from('finance_budgets')
        .insert({ user_id: userId, category_id: categoryId, monthly_limit: monthlyLimit })
        .select().single()
      if (error) throw error
      return fromDB(data)
    }
  },

  async remove(id) {
    const { error } = await supabase.from('finance_budgets').delete().eq('id', id)
    if (error) throw error
  },
}
