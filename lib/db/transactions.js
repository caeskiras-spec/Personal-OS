import { supabase } from '../supabase'

// DB columns: id, user_id, type, amount, category(text,legacy), description(text,legacy),
//             date(date), created_at, category_id(uuid), note(text), import_hash(text)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Ensure we never send a non-uuid slug into a uuid column. */
function safeUuid(val) {
  if (!val) return null
  return UUID_RE.test(val) ? val : null
}

function fromDB(row) {
  return {
    id:         row.id,
    userId:     row.user_id,
    type:       row.type        ?? 'expense',
    amount:     Number(row.amount ?? 0),
    categoryId: row.category_id ?? null,
    // Legacy: fall back to description if note is null
    note:       row.note ?? row.description ?? '',
    date:       row.date ? String(row.date).slice(0, 10) : null,
    importHash: row.import_hash ?? null,
    createdAt:  row.created_at,
  }
}

export const transactionsRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date',       { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, { type, amount, categoryId = null, note = '', date, importHash = null }) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id:     userId,
        type:        type       || 'expense',
        amount:      amount     || 0,
        category_id: safeUuid(categoryId),
        note:        note       ?? '',
        date:        date,
        import_hash: importHash ?? null,
      })
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, { type, amount, categoryId, note, date }) {
    const patch = {}
    if (type       !== undefined) patch.type        = type
    if (amount     !== undefined) patch.amount      = amount
    if (categoryId !== undefined) patch.category_id = safeUuid(categoryId)
    if (note       !== undefined) patch.note        = note
    if (date       !== undefined) patch.date        = date
    const { data, error } = await supabase
      .from('transactions')
      .update(patch)
      .eq('id', id)
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
  },
}
