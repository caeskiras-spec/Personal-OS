'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  BookOpen, Plus, Search, X, Tag, Filter,
  Bold, Italic, Underline, List, ListOrdered, Heading2, CheckSquare,
  AlertCircle, Trash2, Edit2,
} from 'lucide-react'
import { useOS } from '../../../lib/store'
import { journalRepo }     from '../../../lib/db/journal'
import { journalTagsRepo } from '../../../lib/db/journalTags'
import DatePicker from './DatePicker'

// ─── Constants ────────────────────────────────────────────────────────────────

const MOODS = [
  { key: 'awful',   emoji: '😞', label: 'Ужасно' },
  { key: 'bad',     emoji: '😔', label: 'Плохо' },
  { key: 'ok',      emoji: '😐', label: 'Нейтрально' },
  { key: 'good',    emoji: '🙂', label: 'Хорошо' },
  { key: 'great',   emoji: '😄', label: 'Отлично' },
  { key: 'amazing', emoji: '🤩', label: 'Невероятно' },
]

const TAG_COLORS = [
  '#6c63ff','#22c55e','#f59e0b','#ef4444',
  '#3b82f6','#ec4899','#8b5cf6','#06b6d4','#10b981','#f97316',
]
const TAG_EMOJIS = ['🏷️','⭐','🔥','💡','📝','🎯','💬','🌟','🎨','📚','🌿','🎵']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return new Date(+y, +m - 1, +d).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ─── RichEditor ───────────────────────────────────────────────────────────────

function RichEditor({ value, onChange, placeholder = 'Напишите что-нибудь...' }) {
  const ref = useRef(null)

  // Only sync on mount; after that contenteditable owns its DOM
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || ''
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const exec = useCallback((cmd, val = null) => {
    ref.current?.focus()
    document.execCommand(cmd, false, val)
    onChange(ref.current?.innerHTML ?? '')
  }, [onChange])

  const handleChecklist = useCallback(() => {
    const editor = ref.current
    if (!editor) return
    editor.focus()
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    const item = document.createElement('div')
    item.className = 'cl-item'
    item.setAttribute('data-done', 'false')
    item.innerHTML = '☐ '
    range.insertNode(item)
    // Move cursor to end of inserted node
    const newRange = document.createRange()
    newRange.setStartAfter(item)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
    onChange(editor.innerHTML)
  }, [onChange])

  // Toggle checklist item on click
  const handleClick = useCallback((e) => {
    const item = e.target.closest?.('.cl-item')
    if (!item) return
    const done = item.getAttribute('data-done') === 'true'
    item.setAttribute('data-done', String(!done))
    const text = item.innerHTML
    item.innerHTML = text.replace(/^[☐☑] ?/, (!done ? '☑' : '☐') + ' ')
    onChange(ref.current?.innerHTML ?? '')
  }, [onChange])

  const TOOLS = [
    { icon: Bold,        title: 'Жирный',             action: () => exec('bold') },
    { icon: Italic,      title: 'Курсив',              action: () => exec('italic') },
    { icon: Underline,   title: 'Подчёркнутый',        action: () => exec('underline') },
    null,
    { icon: Heading2,    title: 'Заголовок',           action: () => exec('formatBlock', 'h2') },
    { icon: List,        title: 'Маркированный список', action: () => exec('insertUnorderedList') },
    { icon: ListOrdered, title: 'Нумерованный список', action: () => exec('insertOrderedList') },
    { icon: CheckSquare, title: 'Чек-лист',            action: handleChecklist },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-0.5 p-1.5 bg-[#111] border border-[#2a2a2a] rounded-lg flex-wrap">
        {TOOLS.map((tool, i) =>
          tool === null
            ? <div key={i} className="w-px h-4 bg-[#2a2a2a] mx-1 shrink-0" />
            : (
              <button
                key={i}
                type="button"
                title={tool.title}
                onMouseDown={e => { e.preventDefault(); tool.action() }}
                className="p-1.5 rounded hover:bg-white/10 text-[#666] hover:text-[#f0f0f0] transition-colors"
              >
                <tool.icon className="w-3.5 h-3.5" />
              </button>
            )
        )}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange(e.currentTarget.innerHTML)}
        onClick={handleClick}
        data-placeholder={placeholder}
        className="min-h-[180px] text-sm text-[#f0f0f0] leading-relaxed outline-none p-3 bg-[#111] border border-[#2a2a2a] rounded-lg focus:border-[#6c63ff]/40 transition-colors rich-editor"
      />
    </div>
  )
}

// ─── TagsManagerModal ─────────────────────────────────────────────────────────

function TagsManagerModal({ tags, userId, onClose, onTagsChange }) {
  const [list, setList] = useState(tags)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [newEmoji, setNewEmoji] = useState('🏷️')
  const [newColor, setNewColor] = useState(TAG_COLORS[0])

  const create = async () => {
    if (!newName.trim()) return
    const optimistic = { id: `tmp-${Date.now()}`, name: newName.trim(), emoji: newEmoji, color: newColor }
    const next = [...list, optimistic]
    setList(next)
    onTagsChange(next)
    setCreating(false); setNewName('')
    try {
      const saved = await journalTagsRepo.create(userId, { name: optimistic.name, emoji: newEmoji, color: newColor })
      setList(p => p.map(t => t.id === optimistic.id ? saved : t))
      onTagsChange(p => p.map(t => t.id === optimistic.id ? saved : t))
    } catch {
      setList(p => p.filter(t => t.id !== optimistic.id))
      onTagsChange(p => p.filter(t => t.id !== optimistic.id))
    }
  }

  const remove = async (id) => {
    setList(p => p.filter(t => t.id !== id))
    onTagsChange(p => p.filter(t => t.id !== id))
    try { await journalTagsRepo.remove(id) } catch { /* silent */ }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl w-full max-w-sm p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#f0f0f0]">Теги</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-[#666] hover:text-[#f0f0f0] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col max-h-48 overflow-y-auto mb-3">
          {list.length === 0 && !creating && (
            <p className="text-sm text-[#666] text-center py-4">Нет тегов</p>
          )}
          {list.map(tag => (
            <div key={tag.id} className="flex items-center gap-2 py-2 border-b border-[#222] last:border-0">
              <span className="text-base leading-none">{tag.emoji}</span>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
              <span className="flex-1 text-sm text-[#f0f0f0]">{tag.name}</span>
              <button onClick={() => remove(tag.id)} className="p-1 rounded hover:bg-red-500/10 text-[#666] hover:text-[#ef4444] transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {creating ? (
          <div className="flex flex-col gap-2.5 pt-2 border-t border-[#222]">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Название тега"
              className="bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#f0f0f0] outline-none focus:border-[#6c63ff]/50 placeholder:text-[#3a3a3a]"
            />
            <div className="flex gap-1 flex-wrap">
              {TAG_EMOJIS.map(em => (
                <button key={em} onClick={() => setNewEmoji(em)}
                  className={`text-lg px-1 py-0.5 rounded transition-all ${newEmoji === em ? 'bg-[#6c63ff]/20 scale-110' : 'hover:bg-white/5'}`}
                >{em}</button>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {TAG_COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 py-2 text-sm text-[#666] border border-[#333] rounded-xl hover:border-[#444] transition-colors">
                Отмена
              </button>
              <button onClick={create} disabled={!newName.trim()} className="flex-1 py-2 text-sm bg-[#6c63ff] hover:bg-[#8b85ff] text-white rounded-xl transition-colors disabled:opacity-40">
                Создать
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full py-2 text-sm text-[#666] hover:text-[#f0f0f0] border border-dashed border-[#333] hover:border-[#444] rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Новый тег
          </button>
        )}
      </div>
    </div>
  )
}

// ─── EntryCard ────────────────────────────────────────────────────────────────

function EntryCard({ entry, tags, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const mood       = MOODS.find(m => m.key === entry.mood)
  const entryTags  = tags.filter(t => (entry.tags || []).includes(t.id))
  const snippet    = stripHtml(entry.content).slice(0, 130)

  return (
    <div
      className="bg-[#1d1d1d] border border-[#333] hover:bg-[#222] hover:border-[#3f3f3f] rounded-xl p-4 transition-all cursor-pointer group"
      onClick={() => !confirmDelete && onEdit(entry)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-[#666]">{formatDate(entry.date)}</span>
            {mood && <span title={mood.label} className="text-base leading-none">{mood.emoji}</span>}
          </div>
          {entry.title && (
            <h3 className="text-sm font-semibold text-[#f0f0f0] mb-1 truncate">{entry.title}</h3>
          )}
          {snippet && (
            <p className="text-xs text-[#666] leading-relaxed line-clamp-2">{snippet}</p>
          )}
          {entryTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entryTags.map(tag => (
                <span
                  key={tag.id}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: tag.color + '25', color: tag.color }}
                >
                  {tag.emoji && <span className="text-[9px]">{tag.emoji}</span>}
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {confirmDelete ? (
            <>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-[#666] px-2 py-1 rounded hover:bg-white/5 transition-colors">
                Нет
              </button>
              <button onClick={() => onDelete(entry.id)} className="text-xs text-[#ef4444] px-2 py-1 rounded hover:bg-red-500/10 transition-colors">
                Удалить
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onEdit(entry)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/5 text-[#666] transition-all"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-[#666] hover:text-[#ef4444] transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── EditorPanel ──────────────────────────────────────────────────────────────

function EditorPanel({ entry, tags, onSave, onClose }) {
  const isNew        = !entry
  const [date, setDate]         = useState(entry?.date    || localStr())
  const [title, setTitle]       = useState(entry?.title   || '')
  const [content, setContent]   = useState(entry?.content || '')
  const [mood, setMood]         = useState(entry?.mood    || null)
  const [selTags, setSelTags]   = useState(entry?.tags    || [])
  const [saving, setSaving]     = useState(false)

  const toggleTag = id => setSelTags(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id])

  const save = async () => {
    if (!content.trim() && !title.trim()) return
    setSaving(true)
    try {
      await onSave({ id: entry?.id, date, title, content, mood, tags: selTags })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-[420px] shrink-0 border-l border-[#2a2a2a] bg-[#141414] flex flex-col h-full overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
        <span className="text-sm font-semibold text-[#f0f0f0]">
          {isNew ? 'Новая запись' : 'Редактирование'}
        </span>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-[#f0f0f0] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
        {/* Date row */}
        <div className="flex items-center gap-3">
          <DatePicker value={date} onChange={setDate} noOverdue />
        </div>

        {/* Mood */}
        <div>
          <p className="text-[10px] text-[#3a3a3a] uppercase tracking-widest mb-2">Настроение</p>
          <div className="flex gap-1">
            {MOODS.map(m => (
              <button
                key={m.key}
                title={m.label}
                onClick={() => setMood(mood === m.key ? null : m.key)}
                className={`text-xl p-1.5 rounded-lg transition-all select-none ${
                  mood === m.key ? 'bg-white/10 scale-125' : 'opacity-35 hover:opacity-70'
                }`}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
          placeholder="Заголовок (необязательно)"
          className="bg-transparent border-b border-[#2a2a2a] focus:border-[#6c63ff]/40 pb-2 text-base font-medium text-[#f0f0f0] outline-none placeholder:text-[#3a3a3a] transition-colors"
        />

        {/* Rich editor */}
        <RichEditor value={content} onChange={setContent} />

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <p className="text-[10px] text-[#3a3a3a] uppercase tracking-widest mb-2">Теги</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => {
                const active = selTags.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={active
                      ? { background: tag.color + '30', color: tag.color, border: `1px solid ${tag.color}60` }
                      : { background: '#1d1d1d', color: '#666', border: '1px solid #2a2a2a' }
                    }
                  >
                    {tag.emoji && <span>{tag.emoji}</span>}
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#2a2a2a] flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 text-sm text-[#666] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-xl transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={save}
          disabled={saving || (!content.trim() && !title.trim())}
          className="flex-[2] py-2.5 text-sm bg-[#6c63ff] hover:bg-[#8b85ff] text-white font-medium rounded-xl transition-colors disabled:opacity-40"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

// ─── JournalModule ────────────────────────────────────────────────────────────

export default function JournalModule() {
  const { userId } = useOS()

  const [entries, setEntries] = useState([])
  const [tags,    setTags]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [panel,   setPanel]   = useState(null) // null | 'new' | entry object
  const [showTagsManager, setShowTagsManager] = useState(false)

  // ── Filters
  const [search,          setSearch]          = useState('')
  const [filterTag,       setFilterTag]       = useState(null)
  const [filterMood,      setFilterMood]      = useState(null)
  const [filterDateFrom,  setFilterDateFrom]  = useState('')
  const [filterDateTo,    setFilterDateTo]    = useState('')
  const [showFilters,     setShowFilters]     = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true); setError(null)
    try {
      const [e, t] = await Promise.all([
        journalRepo.list(userId),
        journalTagsRepo.list(userId),
      ])
      setEntries(e); setTags(t)
    } catch (err) {
      setError(err.message || 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  // ── Filtered list
  const filtered = useMemo(() => {
    let res = entries
    if (search.trim()) {
      const q = search.toLowerCase()
      res = res.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        stripHtml(e.content || '').toLowerCase().includes(q)
      )
    }
    if (filterTag)      res = res.filter(e => (e.tags || []).includes(filterTag))
    if (filterMood)     res = res.filter(e => e.mood === filterMood)
    if (filterDateFrom) res = res.filter(e => e.date >= filterDateFrom)
    if (filterDateTo)   res = res.filter(e => e.date <= filterDateTo)
    return res
  }, [entries, search, filterTag, filterMood, filterDateFrom, filterDateTo])

  const hasActiveFilter = search || filterTag || filterMood || filterDateFrom || filterDateTo

  const clearFilters = () => {
    setSearch(''); setFilterTag(null); setFilterMood(null)
    setFilterDateFrom(''); setFilterDateTo('')
  }

  // ── CRUD
  const saveEntry = useCallback(async ({ id, date, title, content, mood, tags: entryTags }) => {
    if (id) {
      // Optimistic update
      const snapshot = entries
      setEntries(p => p.map(e => e.id === id ? { ...e, title, content, mood, tags: entryTags, date } : e))
      setPanel(null)
      try {
        const saved = await journalRepo.update(id, { title, content, mood, tags: entryTags, date })
        setEntries(p => p.map(e => e.id === id ? saved : e))
      } catch {
        setEntries(snapshot)
      }
    } else {
      const optimistic = {
        id: `tmp-${Date.now()}`, title, content, mood,
        tags: entryTags, date, created_at: new Date().toISOString(),
      }
      setEntries(p => [optimistic, ...p])
      setPanel(null)
      try {
        const saved = await journalRepo.create(userId, { title, content, mood, tags: entryTags, date })
        setEntries(p => p.map(e => e.id === optimistic.id ? saved : e))
      } catch {
        setEntries(p => p.filter(e => e.id !== optimistic.id))
      }
    }
  }, [entries, userId])

  const deleteEntry = useCallback(async (id) => {
    const snapshot = entries
    setEntries(p => p.filter(e => e.id !== id))
    if (panel && typeof panel === 'object' && panel.id === id) setPanel(null)
    try { await journalRepo.remove(id) }
    catch { setEntries(snapshot) }
  }, [entries, panel])

  // ── Loading / Error
  if (loading) return (
    <div className="flex h-full">
      <div className="flex-1 px-8 pt-8 flex flex-col gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-24 bg-[#1d1d1d] border border-[#333] rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )

  if (error) return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-8 h-8 text-[#ef4444] mx-auto mb-3" />
        <p className="text-[#666] text-sm mb-3">{error}</p>
        <button onClick={load} className="text-sm text-[#6c63ff] hover:underline">Повторить</button>
      </div>
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── List pane ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-[#1a1a1a] shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-[#f0f0f0]">Дневник</h1>
              <p className="text-[#666] text-sm mt-0.5">
                {entries.length} {entries.length === 1 ? 'запись' : entries.length < 5 ? 'записи' : 'записей'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTagsManager(true)}
                title="Управление тегами"
                className="p-2 rounded-xl border border-[#2a2a2a] text-[#666] hover:text-[#f0f0f0] hover:border-[#3a3a3a] transition-colors"
              >
                <Tag className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPanel('new')}
                className="flex items-center gap-2 px-4 py-2 bg-[#6c63ff] hover:bg-[#8b85ff] text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" /> Запись
              </button>
            </div>
          </div>

          {/* Search + filter toggle */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 focus-within:border-[#6c63ff]/40 transition-colors">
              <Search className="w-4 h-4 text-[#3a3a3a] shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по записям..."
                className="flex-1 bg-transparent text-sm text-[#f0f0f0] outline-none placeholder:text-[#3a3a3a]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-[#3a3a3a] hover:text-[#666] transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`p-2.5 rounded-xl border transition-colors ${
                (filterTag || filterMood || filterDateFrom || filterDateTo)
                  ? 'border-[#6c63ff]/50 text-[#6c63ff] bg-[#6c63ff]/10'
                  : showFilters
                    ? 'border-[#3a3a3a] text-[#f0f0f0]'
                    : 'border-[#2a2a2a] text-[#666] hover:text-[#f0f0f0] hover:border-[#3a3a3a]'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 flex flex-wrap gap-2 items-center animate-fade-in">
              {/* Mood */}
              <div className="flex gap-0.5">
                {MOODS.map(m => (
                  <button
                    key={m.key}
                    title={m.label}
                    onClick={() => setFilterMood(filterMood === m.key ? null : m.key)}
                    className={`text-lg px-1.5 py-1 rounded-lg transition-all select-none ${
                      filterMood === m.key ? 'bg-white/10 scale-110' : 'opacity-35 hover:opacity-70'
                    }`}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>

              {/* Tags */}
              {tags.length > 0 && tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                  style={filterTag === tag.id
                    ? { background: tag.color + '30', color: tag.color, border: `1px solid ${tag.color}60` }
                    : { background: '#1d1d1d', color: '#666', border: '1px solid #2a2a2a' }
                  }
                >
                  {tag.emoji} {tag.name}
                </button>
              ))}

              {/* Date range — used custom DatePicker is too heavy here, using text inputs styled consistently */}
              <div className="flex items-center gap-1.5 text-xs text-[#666]">
                <span>с</span>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-1 text-xs text-[#f0f0f0] outline-none focus:border-[#6c63ff]/40 [color-scheme:dark]"
                />
                <span>по</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-1 text-xs text-[#f0f0f0] outline-none focus:border-[#6c63ff]/40 [color-scheme:dark]"
                />
              </div>

              {hasActiveFilter && (
                <button onClick={clearFilters} className="text-xs text-[#ef4444] hover:underline transition-colors">
                  Сбросить
                </button>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-8 py-5">
          {filtered.length === 0 ? (
            hasActiveFilter ? (
              <div className="text-center py-12">
                <p className="text-[#666] text-sm">Нет записей по фильтру</p>
                <button onClick={clearFilters} className="text-sm text-[#6c63ff] mt-2 hover:underline">
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              <div className="text-center py-20">
                <BookOpen className="w-10 h-10 text-[#2a2a2a] mx-auto mb-4" />
                <p className="text-[#f0f0f0] font-medium mb-1">Дневник пуст</p>
                <p className="text-[#666] text-sm mb-5">Начните с первой записи</p>
                <button
                  onClick={() => setPanel('new')}
                  className="px-4 py-2 bg-[#6c63ff] hover:bg-[#8b85ff] text-white text-sm rounded-xl transition-colors"
                >
                  Написать запись
                </button>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-2.5">
              {filtered.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  tags={tags}
                  onEdit={e => setPanel(e)}
                  onDelete={deleteEntry}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Editor panel ── */}
      {panel && (
        <EditorPanel
          entry={panel === 'new' ? null : panel}
          tags={tags}
          onSave={saveEntry}
          onClose={() => setPanel(null)}
        />
      )}

      {/* ── Tags manager modal ── */}
      {showTagsManager && (
        <TagsManagerModal
          tags={tags}
          userId={userId}
          onClose={() => setShowTagsManager(false)}
          onTagsChange={setTags}
        />
      )}
    </div>
  )
}
