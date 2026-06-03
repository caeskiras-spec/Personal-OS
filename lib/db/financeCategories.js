import { supabase } from '../supabase'

function fromDB(row) {
  return {
    id:        row.id,
    userId:    row.user_id,
    name:      row.name,
    emoji:     row.emoji  ?? '📦',
    color:     row.color  ?? '#666666',
    kind:      row.kind   ?? 'expense',   // 'expense' | 'income' | 'both'
    createdAt: row.created_at,
  }
}

/** Canonical default category definitions (used for seeding only). */
const DEFAULT_SEEDS = [
  { name: 'Еда',          emoji: '🍕', color: '#f59e0b', kind: 'expense' },
  { name: 'Транспорт',    emoji: '🚗', color: '#3b82f6', kind: 'expense' },
  { name: 'Жильё',        emoji: '🏠', color: '#6c63ff', kind: 'expense' },
  { name: 'Развлечения',  emoji: '🎉', color: '#ec4899', kind: 'expense' },
  { name: 'Здоровье',     emoji: '💊', color: '#22c55e', kind: 'expense' },
  { name: 'Зарплата',     emoji: '💰', color: '#10b981', kind: 'income'  },
  { name: 'Прочее',       emoji: '📦', color: '#888888', kind: 'both'    },
]

export const financeCategoriesRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('finance_categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  /**
   * Idempotent: seed default categories for user if not yet present.
   * Identifies existing defaults by (name, kind) match.
   * Returns full list (defaults first, then user-created).
   */
  async ensureDefaults(userId) {
    const existing = await this.list(userId)
    const toInsert = DEFAULT_SEEDS.filter(seed =>
      !existing.some(c => c.name === seed.name && c.kind === seed.kind)
    )

    let seeded = []
    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from('finance_categories')
        .insert(toInsert.map(s => ({ user_id: userId, ...s })))
        .select()
      if (error) throw error
      seeded = (data ?? []).map(fromDB)
    }

    // Merge: keep existing order, append any newly seeded ones
    const all = [...existing, ...seeded]

    // Sort so defaults come first (by DEFAULT_SEEDS order), then user-created
    const seedNames = DEFAULT_SEEDS.map(s => s.name)
    return all.sort((a, b) => {
      const ai = seedNames.indexOf(a.name)
      const bi = seedNames.indexOf(b.name)
      if (ai !== -1 && bi !== -1) return ai - bi   // both default → preserve seed order
      if (ai !== -1) return -1                       // a is default → first
      if (bi !== -1) return 1                        // b is default → last
      return a.createdAt.localeCompare(b.createdAt) // both user → chronological
    })
  },

  async create(userId, { name, emoji = '📦', color = '#666666', kind = 'expense' }) {
    const { data, error } = await supabase
      .from('finance_categories')
      .insert({ user_id: userId, name, emoji, color, kind })
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('finance_categories').delete().eq('id', id)
    if (error) throw error
  },
}
