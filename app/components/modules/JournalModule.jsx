'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MODULE_ICONS } from '../../../lib/moduleIcons'
import SidePanel from '../SidePanel'
import EmptyState from '../EmptyState'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import {
  BookOpen, Plus, Search, X, Tag, Filter,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, CheckSquare,
  AlertCircle, Trash2, Edit2, Check,
} from 'lucide-react'
import { useOS } from '../../../lib/store'
import { journalRepo }     from '../../../lib/db/journal'
import { journalTagsRepo } from '../../../lib/db/journalTags'
import DatePicker from './DatePicker'

// ─── Constants ─────────────────────────────────────────────────────────────────

const MOODS = [
  { key: 'awful',   emoji: '😞', label: 'Ужасно' },
  { key: 'bad',     emoji: '😔', label: 'Плохо' },
  { key: 'ok',      emoji: '😐', label: 'Нейтрально' },
  { key: 'good',    emoji: '🙂', label: 'Хорошо' },
  { key: 'great',   emoji: '😄', label: 'Отлично' },
  { key: 'amazing', emoji: '🤩', label: 'Невероятно' },
]

const TAG_COLORS  = ['#6c63ff','#22c55e','#f59e0b','#ef4444','#3b82f6','#ec4899','#8b5cf6','#06b6d4','#10b981','#f97316']
const TAG_EMOJIS  = ['🏷️','⭐','🔥','💡','📝','🎯','💬','🌟','🎨','📚','🌿','🎵']

// ─── Helpers ───────────────────────────────────────────────────────────────────

function localStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return new Date(+y, +m - 1, +d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ─── Tiptap RichEditor ─────────────────────────────────────────────────────────

function RichEditor({ defaultContent, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2] } }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({ placeholder: 'Напишите что-нибудь...' }),
    ],
    content: defaultContent || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
    immediatelyRender: false,
  })

  if (!editor) return null

  const TOOLS = [
    {
      icon: Bold, title: 'Жирный',
      active: editor.isActive('bold'),
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic, title: 'Курсив',
      active: editor.isActive('italic'),
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: UnderlineIcon, title: 'Подчёркнутый',
      active: editor.isActive('underline'),
      action: () => editor.chain().focus().toggleUnderline().run(),
    },
    null,
    {
      icon: Heading2, title: 'Заголовок',
      active: editor.isActive('heading', { level: 2 }),
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: List, title: 'Маркированный список',
      active: editor.isActive('bulletList'),
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered, title: 'Нумерованный список',
      active: editor.isActive('orderedList'),
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: CheckSquare, title: 'Чек-лист',
      active: editor.isActive('taskList'),
      action: () => editor.chain().focus().toggleTaskList().run(),
    },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 bg-bg border border-border rounded-lg flex-wrap">
        {TOOLS.map((tool, i) =>
          tool === null
            ? <div key={i} className="w-px h-4 bg-muted mx-1 shrink-0" />
            : (
              <button
                key={i}
                type="button"
                title={tool.title}
                onMouseDown={e => { e.preventDefault(); tool.action() }}
                className={`p-1.5 rounded transition-colors ${
                  tool.active
                    ? 'bg-[#6c63ff]/25 text-[#8b85ff]'
                    : 'text-subtle hover:bg-white/8 hover:text-text'
                }`}
              >
                <tool.icon className="w-3.5 h-3.5" />
              </button>
            )
        )}
      </div>
      {/* Editor area */}
      <div className="bg-bg border border-border rounded-lg focus-within:border-[#6c63ff]/40 transition-colors">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

// ─── HTML viewer (read-mode) ────────────────────────────────────────────────────

function RichView({ html }) {
  return (
    <div
      className="tiptap-view text-sm text-text leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html || '' }}
    />
  )
}

// ─── InlineTagCreator ──────────────────────────────────────────────────────────

function InlineTagCreator({ userId, onCreated, onCancel }) {
  const [name,  setName]  = useState('')
  const [emoji, setEmoji] = useState('🏷️')
  const [color, setColor] = useState(TAG_COLORS[0])
  const [busy,  setBusy]  = useState(false)

  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const saved = await journalTagsRepo.create(userId, { name: name.trim(), emoji, color })
      onCreated(saved)
    } catch { /* silent */ } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 p-3 bg-bg border border-border rounded-xl flex flex-col gap-2 animate-slide-up">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') onCancel() }}
        placeholder="Название тега"
        className="bg-transparent border-b border-border focus:border-[#6c63ff]/40 py-1 text-sm text-text outline-none placeholder:text-muted transition-colors"
      />
      <div className="flex gap-1 flex-wrap">
        {TAG_EMOJIS.map(em => (
          <button key={em} type="button" onClick={() => setEmoji(em)}
            className={`text-base px-1 py-0.5 rounded transition-all ${emoji === em ? 'bg-[#6c63ff]/20 scale-110' : 'hover:bg-muted/10'}`}
          >{em}</button>
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {TAG_COLORS.map(c => (
          <button key={c} type="button" onClick={() => setColor(c)}
            className={`w-5 h-5 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-1.5 text-xs text-subtle border border-border rounded-lg hover:border-border-2 transition-colors">
          Отмена
        </button>
        <button type="button" onClick={create} disabled={!name.trim() || busy}
          className="flex-1 py-1.5 text-xs bg-[#6c63ff] hover:bg-[#8b85ff] text-white rounded-lg transition-colors disabled:opacity-40"
        >
          {busy ? '...' : 'Создать'}
        </button>
      </div>
    </div>
  )
}

// ─── TagsManagerModal ──────────────────────────────────────────────────────────

function TagsManagerModal({ tags, userId, onClose, onTagsChange }) {
  const [list,         setList]         = useState(tags)
  const [creatingNew,  setCreatingNew]  = useState(false)
  const [editingId,    setEditingId]    = useState(null)
  const [editName,     setEditName]     = useState('')
  const [editEmoji,    setEditEmoji]    = useState('')
  const [editColor,    setEditColor]    = useState('')

  const sync = next => { setList(next); onTagsChange(next) }

  const handleCreated = saved => {
    const next = [...list, saved]
    sync(next)
    setCreatingNew(false)
  }

  const startEdit = tag => {
    setEditingId(tag.id); setEditName(tag.name)
    setEditEmoji(tag.emoji || '🏷️'); setEditColor(tag.color || TAG_COLORS[0])
  }

  const saveEdit = async () => {
    if (!editName.trim()) return
    const next = list.map(t => t.id === editingId ? { ...t, name: editName.trim(), emoji: editEmoji, color: editColor } : t)
    sync(next); setEditingId(null)
    try {
      await journalTagsRepo.update(editingId, { name: editName.trim(), emoji: editEmoji, color: editColor })
    } catch { /* silent */ }
  }

  const remove = async id => {
    sync(list.filter(t => t.id !== id))
    try { await journalTagsRepo.remove(id) } catch { /* silent */ }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface border border-border-2 rounded-2xl w-full max-w-sm p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text">Управление тегами</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted/10 text-subtle hover:text-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col max-h-52 overflow-y-auto gap-1 mb-3">
          {list.length === 0 && !creatingNew && (
            <p className="text-sm text-subtle text-center py-3">Нет тегов</p>
          )}
          {list.map(tag => (
            <div key={tag.id}>
              {editingId === tag.id ? (
                <div className="p-2 bg-bg-2 border border-border rounded-xl flex flex-col gap-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                    className="bg-transparent border-b border-border text-sm text-text outline-none py-0.5"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {TAG_EMOJIS.map(em => (
                      <button key={em} type="button" onClick={() => setEditEmoji(em)}
                        className={`text-sm px-1 rounded ${editEmoji === em ? 'bg-[#6c63ff]/20' : 'hover:bg-muted/10'}`}
                      >{em}</button>
                    ))}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {TAG_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setEditColor(c)}
                        className={`w-4 h-4 rounded-full transition-transform ${editColor === c ? 'scale-125 ring-1 ring-white/30' : ''}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className="flex-1 py-1 text-xs text-subtle border border-border rounded-lg">Отмена</button>
                    <button type="button" onClick={saveEdit} className="flex-1 py-1 text-xs bg-[#6c63ff] text-white rounded-lg">Сохранить</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-2 px-1 rounded-lg hover:bg-white/3 group">
                  <span className="text-base leading-none">{tag.emoji}</span>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
                  <span className="flex-1 text-sm text-text">{tag.name}</span>
                  <button onClick={() => startEdit(tag)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted/10 text-subtle hover:text-text transition-all">
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => remove(tag.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-subtle hover:text-[#ef4444] transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {creatingNew ? (
          <InlineTagCreator userId={userId} onCreated={handleCreated} onCancel={() => setCreatingNew(false)} />
        ) : (
          <button onClick={() => setCreatingNew(true)}
            className="w-full py-2 text-sm text-subtle hover:text-text border border-dashed border-border-2 hover:border-[#444] rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Новый тег
          </button>
        )}
      </div>
    </div>
  )
}

// ─── EntryCard ─────────────────────────────────────────────────────────────────

function EntryCard({ entry, tags, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const mood      = MOODS.find(m => m.key === entry.mood)
  const entryTags = tags.filter(t => (entry.tags || []).includes(t.id))
  const snippet   = stripHtml(entry.content).slice(0, 130)

  return (
    <div
      className="bg-card border border-border-2 hover:bg-surface-2 hover:border-border-hover rounded-xl p-4 transition-all cursor-pointer group"
      onClick={() => !confirmDelete && onEdit(entry)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-subtle">{fmtDate(entry.date)}</span>
            {mood && <span title={mood.label} className="text-base leading-none">{mood.emoji}</span>}
          </div>
          {entry.title && (
            <h3 className="text-sm font-semibold text-text mb-1 truncate">{entry.title}</h3>
          )}
          {snippet && (
            <p className="text-xs text-subtle leading-relaxed line-clamp-2">{snippet}</p>
          )}
          {entryTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entryTags.map(tag => (
                <span key={tag.id}
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
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-subtle px-2 py-1 rounded hover:bg-muted/10 transition-colors">Нет</button>
              <button onClick={() => onDelete(entry.id)} className="text-xs text-[#ef4444] px-2 py-1 rounded hover:bg-red-500/10 transition-colors">Удалить</button>
            </>
          ) : (
            <>
              <button onClick={() => onEdit(entry)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted/10 text-subtle transition-all"
              ><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => setConfirmDelete(true)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-subtle hover:text-[#ef4444] transition-all"
              ><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── EditorPanel ───────────────────────────────────────────────────────────────
// key={entry?.id || 'new'} on this component ensures full remount when switching entries

function EditorPanel({ entry, tags, userId, onSave, onClose, onTagsChange }) {
  const isNew = !entry

  const [date,       setDate]       = useState(entry?.date    || localStr())
  const [title,      setTitle]      = useState(entry?.title   || '')
  const [content,    setContent]    = useState(entry?.content || '')
  const [mood,       setMood]       = useState(entry?.mood    || null)
  const [selTags,    setSelTags]    = useState(entry?.tags    || [])
  const [saving,     setSaving]     = useState(false)
  const [addingTag,  setAddingTag]  = useState(false)

  const toggleTag = id => setSelTags(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id])

  const handleTagCreated = saved => {
    onTagsChange(p => [...p, saved])
    setSelTags(p => [...p, saved.id])
    setAddingTag(false)
  }

  const save = async () => {
    if (!content.trim() && !title.trim()) return
    setSaving(true)
    try { await onSave({ id: entry?.id, date, title, content, mood, tags: selTags }) }
    finally { setSaving(false) }
  }

  return (
    <SidePanel panelClass="md:w-[440px]" onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <span className="text-sm font-semibold text-text">{isNew ? 'Новая запись' : 'Редактирование'}</span>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/10 text-subtle hover:text-text transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
        {/* Date */}
        <DatePicker value={date} onChange={setDate} noOverdue />

        {/* Mood */}
        <div>
          <p className="text-[10px] text-muted uppercase tracking-widest mb-2">Настроение</p>
          <div className="flex gap-1">
            {MOODS.map(m => (
              <button key={m.key} title={m.label}
                onClick={() => setMood(mood === m.key ? null : m.key)}
                className={`text-xl p-1.5 rounded-lg transition-all select-none ${
                  mood === m.key ? 'bg-white/10 scale-125' : 'opacity-35 hover:opacity-70'
                }`}
              >{m.emoji}</button>
            ))}
          </div>
        </div>

        {/* Title */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
          placeholder="Заголовок (необязательно)"
          className="bg-transparent border-b border-border focus:border-[#6c63ff]/40 pb-2 text-base font-medium text-text outline-none placeholder:text-muted transition-colors"
        />

        {/* Rich editor */}
        <RichEditor defaultContent={content} onChange={setContent} />

        {/* Tags */}
        <div>
          <p className="text-[10px] text-muted uppercase tracking-widest mb-2">Теги</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => {
              const active = selTags.includes(tag.id)
              return (
                <button key={tag.id} onClick={() => toggleTag(tag.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                  style={active
                    ? { background: tag.color + '30', color: tag.color, border: `1px solid ${tag.color}60` }
                    : { background: '#1d1d1d', color: '#666', border: '1px solid #2a2a2a' }
                  }
                >
                  {tag.emoji && <span>{tag.emoji}</span>}
                  {tag.name}
                  {active && <Check className="w-3 h-3 ml-0.5" />}
                </button>
              )
            })}
            <button
              onClick={() => setAddingTag(v => !v)}
              className="px-2.5 py-1 rounded-full text-xs text-subtle hover:text-text border border-dashed border-border hover:border-muted transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Новый
            </button>
          </div>
          {addingTag && (
            <InlineTagCreator userId={userId} onCreated={handleTagCreated} onCancel={() => setAddingTag(false)} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border flex gap-2 shrink-0">
        <button onClick={onClose}
          className="flex-1 py-2.5 text-sm text-subtle border border-border hover:border-muted rounded-xl transition-colors"
        >Отмена</button>
        <button onClick={save} disabled={saving || (!content.trim() && !title.trim())}
          className="flex-[2] py-2.5 text-sm bg-[#6c63ff] hover:bg-[#8b85ff] text-white font-medium rounded-xl transition-colors disabled:opacity-40"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </SidePanel>
  )
}

// ─── JournalModule ─────────────────────────────────────────────────────────────

export default function JournalModule() {
  const { userId } = useOS()

  const [entries,  setEntries]  = useState([])
  const [tags,     setTags]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [panel,    setPanel]    = useState(null) // null | 'new' | entry
  const [showMgr,  setShowMgr]  = useState(false)

  const [search,          setSearch]         = useState('')
  const [filterTag,       setFilterTag]      = useState(null)
  const [filterMood,      setFilterMood]     = useState(null)
  const [filterDateFrom,  setFilterDateFrom] = useState('')
  const [filterDateTo,    setFilterDateTo]   = useState('')
  const [showFilters,     setShowFilters]    = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true); setError(null)
    try {
      const [e, t] = await Promise.all([journalRepo.list(userId), journalTagsRepo.list(userId)])
      setEntries(e); setTags(t)
    } catch (err) {
      setError(err.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let res = entries
    const q = search.trim().toLowerCase()
    if (q) {
      res = res.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        stripHtml(e.content || '').toLowerCase().includes(q)
      )
    }
    if (filterTag)      res = res.filter(e => Array.isArray(e.tags) && e.tags.includes(filterTag))
    if (filterMood)     res = res.filter(e => e.mood === filterMood)
    if (filterDateFrom) res = res.filter(e => (e.date || '') >= filterDateFrom)
    if (filterDateTo)   res = res.filter(e => (e.date || '') <= filterDateTo)
    return res
  }, [entries, search, filterTag, filterMood, filterDateFrom, filterDateTo])

  const hasFilter = !!(search || filterTag || filterMood || filterDateFrom || filterDateTo)

  const clearFilters = () => {
    setSearch(''); setFilterTag(null); setFilterMood(null)
    setFilterDateFrom(''); setFilterDateTo('')
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const saveEntry = useCallback(async ({ id, date, title, content, mood, tags: entryTags }) => {
    if (id) {
      const snapshot = entries
      setEntries(p => p.map(e => e.id === id ? { ...e, title, content, mood, tags: entryTags, date } : e))
      setPanel(null)
      try {
        const saved = await journalRepo.update(id, { title, content, mood, tags: entryTags, date })
        setEntries(p => p.map(e => e.id === id ? saved : e))
      } catch { setEntries(snapshot) }
    } else {
      const optimistic = { id: `tmp-${Date.now()}`, title, content, mood, tags: entryTags, date, created_at: new Date().toISOString() }
      setEntries(p => [optimistic, ...p])
      setPanel(null)
      try {
        const saved = await journalRepo.create(userId, { title, content, mood, tags: entryTags, date })
        setEntries(p => p.map(e => e.id === optimistic.id ? saved : e))
      } catch { setEntries(p => p.filter(e => e.id !== optimistic.id)) }
    }
  }, [entries, userId])

  const deleteEntry = useCallback(async id => {
    const snapshot = entries
    setEntries(p => p.filter(e => e.id !== id))
    if (panel && typeof panel === 'object' && panel.id === id) setPanel(null)
    try { await journalRepo.remove(id) }
    catch { setEntries(snapshot) }
  }, [entries, panel])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="px-4 sm:px-8 pt-5 sm:pt-8 flex flex-col gap-3">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-card border border-border-2 rounded-xl animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-8 h-8 text-[#ef4444] mx-auto mb-3" />
        <p className="text-subtle text-sm mb-3">{error}</p>
        <button onClick={load} className="text-sm text-[#6c63ff] hover:underline">Повторить</button>
      </div>
    </div>
  )

  const panelKey = panel === 'new' ? 'new' : (panel?.id || null)

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── List pane ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <div className="px-4 sm:px-8 pt-5 sm:pt-8 pb-4 border-b border-surface shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: MODULE_ICONS.journal.color + '20' }}>
                <MODULE_ICONS.journal.Icon size={20} style={{ color: MODULE_ICONS.journal.color }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text">Дневник</h1>
                <p className="text-subtle text-sm mt-0.5">
                  {entries.length} {entries.length === 1 ? 'запись' : entries.length < 5 ? 'записи' : 'записей'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowMgr(true)} title="Управление тегами"
                className="p-2 rounded-xl border border-border text-subtle hover:text-text hover:border-muted transition-colors"
              ><Tag className="w-4 h-4" /></button>
              <button onClick={() => setPanel('new')}
                className="flex items-center gap-2 px-4 py-2 bg-[#6c63ff] hover:bg-[#8b85ff] text-white text-sm font-medium rounded-xl transition-colors"
              ><Plus className="w-4 h-4" /> Запись</button>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 focus-within:border-[#6c63ff]/40 transition-colors">
              <Search className="w-4 h-4 text-muted shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по записям..."
                className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-muted hover:text-subtle transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`p-2.5 rounded-xl border transition-colors ${
                filterTag || filterMood || filterDateFrom || filterDateTo
                  ? 'border-[#6c63ff]/50 text-[#6c63ff] bg-[#6c63ff]/10'
                  : showFilters
                    ? 'border-muted text-text'
                    : 'border-border text-subtle hover:text-text hover:border-muted'
              }`}
            ><Filter className="w-4 h-4" /></button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 flex flex-wrap gap-2 items-center animate-fade-in">
              {/* Mood */}
              <div className="flex gap-0.5">
                {MOODS.map(m => (
                  <button key={m.key} title={m.label}
                    onClick={() => setFilterMood(filterMood === m.key ? null : m.key)}
                    className={`text-lg px-1.5 py-1 rounded-lg transition-all select-none ${
                      filterMood === m.key ? 'bg-white/10 scale-110' : 'opacity-35 hover:opacity-70'
                    }`}
                  >{m.emoji}</button>
                ))}
              </div>
              {/* Tags */}
              {tags.map(tag => (
                <button key={tag.id}
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
              {/* Date range */}
              <div className="flex items-center gap-1.5 text-xs text-subtle">
                <span>с</span>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                  className="bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text outline-none focus:border-[#6c63ff]/40 [color-scheme:dark]"
                />
                <span>по</span>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                  className="bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text outline-none focus:border-[#6c63ff]/40 [color-scheme:dark]"
                />
              </div>
              {hasFilter && (
                <button onClick={clearFilters} className="text-xs text-[#ef4444] hover:underline">Сбросить</button>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-5">
          {filtered.length === 0 ? (
            hasFilter ? (
              // no-results state: filter active but nothing matches
              <EmptyState
                modId="journal"
                title="Ничего не найдено"
                description="Попробуйте изменить фильтры или поисковый запрос"
                actionLabel="Сбросить фильтры"
                onAction={clearFilters}
                compact
              />
            ) : (
              // empty state: no entries at all
              <EmptyState
                modId="journal"
                title="Дневник пуст"
                description="Начните с первой записи — мыслей, событий или планов"
                actionLabel="Написать запись"
                onAction={() => setPanel('new')}
              />
            )
          ) : (
            <div className="flex flex-col gap-2.5">
              {filtered.map(entry => (
                <EntryCard key={entry.id} entry={entry} tags={tags}
                  onEdit={e => setPanel(e)}
                  onDelete={deleteEntry}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Editor panel ──────────────────────────────────────────────────── */}
      {panel && (
        <EditorPanel
          key={panelKey}
          entry={panel === 'new' ? null : panel}
          tags={tags}
          userId={userId}
          onSave={saveEntry}
          onClose={() => setPanel(null)}
          onTagsChange={setTags}
        />
      )}

      {/* ── Tags manager ──────────────────────────────────────────────────── */}
      {showMgr && (
        <TagsManagerModal
          tags={tags}
          userId={userId}
          onClose={() => setShowMgr(false)}
          onTagsChange={setTags}
        />
      )}
    </div>
  )
}
