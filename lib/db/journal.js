import { supabase } from '../supabase'

// UI uses { text, mood: emoji string, date:'Сегодня', tags:[] }
// DB uses { content, mood: integer 1-5, date:'YYYY-MM-DD' }

const EMOJI_TO_INT = { '😊': 4, '😐': 3, '😔': 2, '🤩': 5, '😤': 2, '😴': 2 }
const INT_TO_EMOJI = { 5: '🤩', 4: '😊', 3: '😐', 2: '😔', 1: '😔' }

function fromDB(row) {
  return {
    id:   row.id,
    text: row.content,
    mood: INT_TO_EMOJI[row.mood] ?? '😐',
    date: row.date,
    tags: [],
  }
}

export const journalRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromDB)
  },

  async create(userId, { text, mood = '😊' }) {
    const date = new Date().toISOString().split('T')[0]
    const moodInt = EMOJI_TO_INT[mood] ?? 3
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({ user_id: userId, content: text, mood: moodInt, date })
      .select().single()
    if (error) throw error
    return fromDB(data)
  },

  async remove(id) {
    const { error } = await supabase.from('journal_entries').delete().eq('id', id)
    if (error) throw error
  },
}
