'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
import type { Task } from '@/lib/types'

interface Props {
  tasks: Task[]
  onSaveNote: (id: string, title: string, description: string) => void
  onCreateNote: (title: string, description: string) => void
  onDelete: (id: string) => void
}

function NoteCard({ note, onSave, onDelete }: {
  note: Task
  onSave: (id: string, title: string, description: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.description ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  function commit() {
    if (title.trim()) onSave(note.id, title.trim(), body)
    setEditing(false)
  }

  return (
    <div
      onClick={() => !editing && setEditing(true)}
      className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 min-h-[120px] cursor-pointer hover:shadow-md transition-shadow group relative"
    >
      {editing ? (
        <div className="space-y-2" onClick={e => e.stopPropagation()}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') textareaRef.current?.focus() }}
            className="w-full font-semibold text-sm bg-transparent outline-none border-b border-yellow-300 pb-1"
          />
          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Escape') { setEditing(false) } }}
            className="w-full text-sm bg-transparent outline-none resize-none min-h-[80px]"
            placeholder="תוכן ההערה..."
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">ביטול</button>
            <button type="button" onClick={commit} className="text-xs text-green-700 font-semibold hover:underline">שמור</button>
          </div>
        </div>
      ) : (
        <>
          <h4 className="font-semibold text-sm text-gray-800 mb-1">{note.title}</h4>
          {note.description && <p className="text-sm text-gray-500 leading-relaxed">{note.description}</p>}
          <p className="text-xs text-gray-300 mt-3">
            {new Date(note.created_at).toLocaleDateString('he-IL')}
          </p>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(note.id) }}
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-red-500 transition-opacity"
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}

function NewNoteCard({ onCreate }: { onCreate: (title: string, desc: string) => void }) {
  const [active, setActive] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  function commit() {
    if (title.trim()) {
      onCreate(title.trim(), body)
      setTitle('')
      setBody('')
    }
    setActive(false)
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors w-full"
      >
        <Plus className="h-6 w-6" />
        <span className="text-sm">הערה חדשה</span>
      </button>
    )
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-2">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="כותרת..."
        className="w-full font-semibold text-sm bg-transparent outline-none border-b border-yellow-300 pb-1"
        onKeyDown={e => { if (e.key === 'Enter') document.getElementById('note-body')?.focus() }}
      />
      <textarea
        id="note-body"
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="תוכן..."
        className="w-full text-sm bg-transparent outline-none resize-none min-h-[60px]"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setActive(false)} className="text-xs text-gray-500 hover:text-gray-700">ביטול</button>
        <button type="button" onClick={commit} className="text-xs bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700">שמור</button>
      </div>
    </div>
  )
}

export function TabNotes({ tasks, onSaveNote, onCreateNote, onDelete }: Props) {
  const [search, setSearch] = useState('')

  const notes = tasks
    .filter(t => t.task_type === 'note')
    .filter(n => !search || n.title.includes(search) || (n.description ?? '').includes(search))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש בהערות..."
          className="w-full border border-gray-200 rounded-lg pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          dir="rtl"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NewNoteCard onCreate={onCreateNote} />
        {notes.map(n => (
          <NoteCard key={n.id} note={n} onSave={onSaveNote} onDelete={onDelete} />
        ))}
      </div>

      {tasks.filter(t => t.task_type === 'note').length === 0 && (
        <p className="text-center text-sm text-gray-400 py-8">אין הערות עדיין</p>
      )}
    </div>
  )
}
