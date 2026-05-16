'use client'

import { useState, KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { TaskCard } from './TaskCard'
import type { Task, TeamMember } from '@/lib/types'

interface Props {
  tasks: Task[]
  members: TeamMember[]
  currentUserId?: string
  nextSeasonStart?: string | null
  onToggleStatus: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onInlineEdit: (id: string, title: string) => void
  onQuickAdd: (title: string, dueDate?: string) => void
  onChecklistItemToggle?: (task: Task, itemId: string) => void
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseQuickDate(text: string): { title: string; due_date?: string } {
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7)
  const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const t = text.trim()
  const ddmm = t.match(/ב-?(\d{1,2})\/(\d{1,2})/)
  if (ddmm) {
    const d = new Date(today.getFullYear(), Number(ddmm[2]) - 1, Number(ddmm[1]))
    return { title: t.replace(ddmm[0], '').trim(), due_date: toISO(d) }
  }
  if (t.includes('מחר')) return { title: t.replace('מחר', '').trim(), due_date: toISO(tomorrow) }
  if (t.includes('עוד שבוע')) return { title: t.replace('עוד שבוע', '').trim(), due_date: toISO(nextWeek) }
  const dow: Record<string, number> = { 'ראשון':0,'שני':1,'שלישי':2,'רביעי':3,'חמישי':4,'שישי':5,'שבת':6 }
  for (const [name, day] of Object.entries(dow)) {
    if (t.includes(`ב${name}`)) {
      const diff = (day - today.getDay() + 7) % 7 || 7
      const d = new Date(today); d.setDate(today.getDate() + diff)
      return { title: t.replace(`ב${name}`, '').trim(), due_date: toISO(d) }
    }
  }
  return { title: t }
}

function QuickAdd({ defaultDate, onAdd }: { defaultDate?: string; onAdd: (title: string, date?: string) => void }) {
  const [value, setValue] = useState('')
  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && value.trim()) {
      const { title, due_date } = parseQuickDate(value)
      onAdd(title, due_date ?? defaultDate)
      setValue('')
    }
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-gray-300 transition-colors">
      <Plus className="h-4 w-4 flex-shrink-0" />
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKey}
        placeholder='+ הוסף משימה... (Enter לשמור, "מחר", "בשני", "ב-20/5")'
        className="flex-1 outline-none bg-transparent placeholder:text-gray-300 text-gray-700"
      />
    </div>
  )
}

interface GroupProps {
  title: string
  badge: string
  tasks: Task[]
  members: TeamMember[]
  currentUserId?: string
  borderColor: 'red' | 'orange' | 'blue'
  defaultDate?: string
  onToggleStatus: (t: Task) => void
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onInlineEdit: (id: string, title: string) => void
  onQuickAdd: (title: string, date?: string) => void
  onChecklistItemToggle?: (task: Task, itemId: string) => void
}

function TaskGroup({ title, badge, tasks, members, currentUserId, borderColor, defaultDate, onToggleStatus, onEdit, onDelete, onInlineEdit, onQuickAdd, onChecklistItemToggle }: GroupProps) {
  if (tasks.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
        <span>{badge}</span>
        {title}
        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
      </h3>
      <div className="space-y-2">
        {tasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            members={members}
            currentUserId={currentUserId}
            borderColor={borderColor}
            onToggleStatus={onToggleStatus}
            onEdit={onEdit}
            onDelete={onDelete}
            onInlineEdit={onInlineEdit}
            onChecklistItemToggle={onChecklistItemToggle}
          />
        ))}
      </div>
      <QuickAdd defaultDate={defaultDate} onAdd={onQuickAdd} />
    </div>
  )
}

export function TabToday({ tasks, members, currentUserId, nextSeasonStart, onToggleStatus, onEdit, onDelete, onInlineEdit, onQuickAdd, onChecklistItemToggle }: Props) {
  const today = todayISO()
  const d7 = new Date(); d7.setDate(d7.getDate() + 7)
  const d7ISO = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`

  const allTasks = tasks.filter(t => t.task_type === 'task')

  function doneLast(a: Task, b: Task) {
    return (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0)
  }

  const overdue = allTasks
    .filter(t => t.due_date && t.due_date < today)
    .sort((a, b) => doneLast(a, b) || (a.due_date ?? '').localeCompare(b.due_date ?? ''))

  const todayTasks = allTasks
    .filter(t => t.due_date === today)
    .sort(doneLast)

  // Days remaining until next season
  const daysToNextSeason = nextSeasonStart
    ? Math.ceil((new Date(nextSeasonStart).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    : null

  const weekTasks = allTasks
    .filter(t => {
      if (!t.due_date) {
        if (t.reminder_days_before_season != null && daysToNextSeason != null) {
          return t.reminder_days_before_season === daysToNextSeason
        }
        return false
      }
      return t.due_date > today && t.due_date <= d7ISO
    })
    .sort(doneLast)

  const isEmpty = overdue.filter(t => t.status !== 'done').length === 0
    && todayTasks.filter(t => t.status !== 'done').length === 0
    && weekTasks.filter(t => t.status !== 'done').length === 0

  if (isEmpty) {
    return (
      <div className="space-y-4">
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-sm">אין משימות ממתינות — יופי!</p>
        </div>
        <QuickAdd defaultDate={today} onAdd={onQuickAdd} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TaskGroup
        title="פג תוקף"
        badge="🔴"
        tasks={overdue}
        members={members}
        currentUserId={currentUserId}
        borderColor="red"
        defaultDate={today}
        onToggleStatus={onToggleStatus}
        onEdit={onEdit}
        onDelete={onDelete}
        onInlineEdit={onInlineEdit}
        onQuickAdd={onQuickAdd}
        onChecklistItemToggle={onChecklistItemToggle}
      />
      <TaskGroup
        title="להיום"
        badge="🟡"
        tasks={todayTasks}
        members={members}
        currentUserId={currentUserId}
        borderColor="orange"
        defaultDate={today}
        onToggleStatus={onToggleStatus}
        onEdit={onEdit}
        onDelete={onDelete}
        onInlineEdit={onInlineEdit}
        onQuickAdd={onQuickAdd}
        onChecklistItemToggle={onChecklistItemToggle}
      />
      <TaskGroup
        title="השבוע הקרוב"
        badge="🔵"
        tasks={weekTasks}
        members={members}
        currentUserId={currentUserId}
        borderColor="blue"
        onToggleStatus={onToggleStatus}
        onEdit={onEdit}
        onDelete={onDelete}
        onInlineEdit={onInlineEdit}
        onQuickAdd={onQuickAdd}
        onChecklistItemToggle={onChecklistItemToggle}
      />
    </div>
  )
}
