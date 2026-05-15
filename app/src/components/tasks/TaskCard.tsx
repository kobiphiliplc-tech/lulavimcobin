'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Circle, CheckCircle2, Clock, RotateCcw, Lock, ExternalLink, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task, TeamMember } from '@/lib/types'

interface Props {
  task: Task
  members: TeamMember[]
  currentUserId?: string
  onToggleStatus: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onInlineEdit?: (id: string, title: string) => void
  borderColor?: 'red' | 'orange' | 'blue' | 'none'
}

const ENTITY_COLORS: Record<string, string> = {
  customer:  'bg-blue-100 text-blue-700',
  supplier:  'bg-green-100 text-green-700',
  product:   'bg-orange-100 text-orange-700',
  payment:   'bg-purple-100 text-purple-700',
  general:   'bg-gray-100 text-gray-600',
  screen_record: 'bg-gray-100 text-gray-600',
}

const ENTITY_LABELS: Record<string, string> = {
  customer: 'לקוח',
  supplier: 'ספק',
  product:  'מוצר',
  payment:  'תשלום',
  general:  'כללי',
  screen_record: 'רשומה',
}

const BORDER_CLASSES: Record<string, string> = {
  red:    'border-r-4 border-r-red-500',
  orange: 'border-r-4 border-r-amber-400',
  blue:   'border-r-4 border-r-blue-400',
  none:   '',
}

export function TaskCard({ task, members, currentUserId, onToggleStatus, onEdit, onDelete, onInlineEdit, borderColor = 'none' }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const member = members.find(m => m.id === task.assigned_to_member_id)
  const initials = member?.name.split(' ').map(w => w[0]).join('').slice(0, 2) ?? ''
  const isDone = task.status === 'done'
  const isPrivate = task.is_private
  const isPrivateAndNotMine = isPrivate && task.created_by_user_id !== currentUserId

  if (isPrivateAndNotMine) return null

  function handleTitleClick() {
    setDraft(task.title)
    setEditing(true)
  }

  function commitEdit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== task.title && onInlineEdit) {
      onInlineEdit(task.id, trimmed)
    }
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 px-4 py-3 flex gap-3 items-start group hover:shadow-sm transition-shadow',
        BORDER_CLASSES[borderColor],
        isDone && 'opacity-60'
      )}
    >
      {/* Status toggle */}
      <button
        type="button"
        onClick={() => onToggleStatus(task)}
        className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors"
        title={isDone ? 'סמן כפתוח' : 'סמן כהושלם'}
      >
        {isDone
          ? <CheckCircle2 className="h-5 w-5 text-green-500" />
          : task.status === 'in_progress'
            ? <Clock className="h-5 w-5 text-blue-500" />
            : <Circle className="h-5 w-5" />
        }
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start gap-2">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm font-medium border-b border-green-500 outline-none bg-transparent"
            />
          ) : (
            <span
              onClick={handleTitleClick}
              className={cn(
                'flex-1 text-sm font-medium cursor-text hover:text-green-700 transition-colors',
                isDone && 'line-through text-gray-400'
              )}
            >
              {task.priority === 'urgent' && !isDone && (
                <AlertTriangle className="inline h-3.5 w-3.5 text-red-500 ml-1 mb-0.5" />
              )}
              {task.title}
            </span>
          )}

          {/* Avatar */}
          {member && (
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center" title={member.name}>
              {initials}
            </span>
          )}
        </div>

        {/* Chips row */}
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {task.linked_entity_type && task.linked_entity_type !== 'screen_record' && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', ENTITY_COLORS[task.linked_entity_type] ?? 'bg-gray-100 text-gray-600')}>
              {ENTITY_LABELS[task.linked_entity_type] ?? task.linked_entity_type}
              {task.linked_entity_name ? `: ${task.linked_entity_name}` : ''}
            </span>
          )}

          {task.linked_entity_type === 'screen_record' && task.linked_deep_link_path && (
            <Link
              href={task.linked_deep_link_path}
              className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1"
              title={task.linked_record_label ?? ''}
            >
              <ExternalLink className="h-3 w-3" />
              {task.linked_record_label ?? 'פתח רשומה'}
            </Link>
          )}

          {task.linked_entity_type === 'screen_record' && !task.linked_deep_link_path && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
              רשומה לא זמינה
            </span>
          )}

          {task.season_context === 'next' && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">עונה הבאה</span>
          )}

          {task.is_recurring && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-0.5">
              <RotateCcw className="h-3 w-3" />
              חוזרת
            </span>
          )}

          {task.is_private && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-0.5">
              <Lock className="h-3 w-3" />
            </span>
          )}
        </div>

        {/* Description preview */}
        {task.description && !isDone && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-1">{task.description}</p>
        )}
      </div>

      {/* Date + actions */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1 text-xs text-gray-400">
        {task.due_date && (
          <span>{new Date(task.due_date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
        )}
        {task.due_time && <span>{task.due_time}</span>}

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={() => onEdit(task)} className="text-gray-400 hover:text-blue-600 text-xs">עריכה</button>
          <button type="button" onClick={() => onDelete(task.id)} className="text-gray-400 hover:text-red-500 text-xs">מחק</button>
        </div>
      </div>
    </div>
  )
}
