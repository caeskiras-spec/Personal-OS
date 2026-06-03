import { supabase } from '../supabase'

function localStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fromDB(row) {
  return {
    id:         row.id,
    user_id:    row.user_id,
    title:      row.title   ?? '',
    content:    row.content ?? '',
    mood:       row.mood    ?? null,
    tags:       row.tags    ?? [],
    date:       row.date    ?? localStr(),
    created_at: row.created_at,
  }
}

export const journalRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date',       { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, { title, content, mood, tags, date }) {
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
        title:   title   || null,
        content: content || null,
        mood:    mood    || null,
        tags:    tags    ?? [],
        date:    date    ?? localStr(),
      })
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async update(id, { title, content, mood, tags, date }) {
    const { data, error } = await supabase
      .from('journal_entries')
      .update({
        title:   title   || null,
        content: content || null,
        mood:    mood    || null,
        tags:    tags    ?? [],
        date:    date    ?? localStr(),
      })
      .eq('id', id)
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('journal_entries').delete().eq('id', id)
    if (error) throw error
  },
}
