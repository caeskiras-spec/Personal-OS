import { supabase } from '../supabase'
import { getTodayStr } from '../tasks-selectors'

export const habitCompletionsRepo = {
  /**
   * Returns all completion dates for a list of habits.
   * Result: { [habitId]: string[] } — array of 'YYYY-MM-DD'
   */
  async listAllByHabits(userId, habitIds) {
    if (!habitIds.length) return {}
    const { data, error } = await supabase
      .from('habit_completions')
      .select('habit_id, date')
      .eq('user_id', userId)
      .in('habit_id', habitIds)
    if (error) throw error
    const map = {}
    for (const id of habitIds) map[id] = []
    for (const row of (data ?? [])) {
      map[row.habit_id] = [...(map[row.habit_id] ?? []), row.date]
    }
    return map
  },

  /**
   * Returns completion dates for TODAY only.
   * Result: Set<habitId>
   */
  async listTodayByHabits(userId, habitIds) {
    if (!habitIds.length) return new Set()
    const today = getTodayStr()
    const { data, error } = await supabase
      .from('habit_completions')
      .select('habit_id')
      .eq('user_id', userId)
      .eq('date', today)
      .in('habit_id', habitIds)
    if (error) throw error
    return new Set((data ?? []).map(r => r.habit_id))
  },

  /**
   * Toggle completion for a specific date (default = today).
   * Returns true if now completed, false if removed.
   */
  async toggleByDate(userId, habitId, date = getTodayStr()) {
    const { data: existing } = await supabase
      .from('habit_completions')
      .select('id')
      .eq('habit_id', habitId)
      .eq('date', date)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase.from('habit_completions').delete().eq('id', existing.id)
      if (error) throw error
      return false
    } else {
      const { error } = await supabase
        .from('habit_completions')
        .insert({ user_id: userId, habit_id: habitId, date })
      if (error) throw error
      return true
    }
  },
}
