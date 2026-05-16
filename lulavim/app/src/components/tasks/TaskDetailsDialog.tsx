'use client'

import Link from 'next/link'
import { Circle, CheckCircle2, Clock, RotateCcw, Lock, ExternalLink, AlertTriangle, FileText, StickyNote, Calendar, Bell } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Task, TeamMember } from '@/lib/types'
import { isChecklist, parseChecklist } from '@/lib/checklist'

interface Props {
  task: Task
  members: TeamMember[]
  open: boolean
  onClose: () => void
  onEdit: () => void
  onChecklistItemToggle?: (itemId: string) => void
}

const ENTITY_COLORS: Record<string, string> = {
  customer:     'bg-blue-100 text-blue-700',
  supplier:     'bg-green-100 text-green-700',
  product:      'bg-orange-100 text-orange-700',
  payment:      'bg-purple-100 text-purple-700',
  general:      'bg-gray-100 text-gray-600',
  screen_record:'bg-gray-100 text-gray-600',
}

const ENTITY_LABELS: Record<string, string> = {
  customer: 'לקוח',
  supplier: 'ספק',
  product:  'מוצר',
  payment:  'תשלום',
  general:  'כללי',
}

const STATUS_MAP = {
  open:        { label: 'פתוח',       icon: <Circle className="h-4 w-4 text-gray-400" /> },
  in_progress: { label: 'בביצוע',    icon: <Clock className="h-4 w-4 text-blue-500" /> },
  done:        { label: 'הושלם',      icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
}

const SEASON_LABELS: Record<string, string> = {
  current:  'עונה נוכחית',
  next:     'עונה הבאה',
  timeless: 'ללא עונה',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-28 flex-shrink-0 text-gray-400 pt-0.5">{label}</span>
      <div className="flex-1 text-gray-800">{children}</div>
    </div>
  )
}

export function TaskDetailsDialog({ task, members, open, onClose, onEdit, onChecklistItemToggle }: Props) {
  const member = members.find(m => m.id === task.assigned_to_member_id)
  const initials = member?.name.split(' ').map(w => w[0]).join('').slice(0, 2) ?? ''
  const status = STATUS_MAP[task.status]

  const checklist = isChecklist(task.description) ? parseChecklist(task.description) : null

  const formattedDate = task.due_date
    ? new Date(task.due_date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const formattedCreated = new Date(task.created_at).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-start gap-2 leading-snug pr-1">
            {task.priority === 'urgent' && (
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <span className={cn(task.status === 'done' && 'line-through text-gray-400')}>
              {task.title}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Status & Priority */}
          <Row label="סטטוס">
            <span className="flex items-center gap-1.5">
              {status.icon}
              {status.label}
            </span>
          </Row>

          {task.priority === 'urgent' && (
            <Row label="עדיפות">
              <span className="text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                דחוף
              </span>
            </Row>
          )}

          {/* Task type */}
          <Row label="סוג">
            <span className="flex items-center gap-1.5 text-gray-600">
              {task.task_type === 'note'
                ? <><StickyNote className="h-3.5 w-3.5" /> פתק</>
                : <><FileText className="h-3.5 w-3.5" /> משימה</>
              }
            </span>
          </Row>

          {/* Due date */}
          {formattedDate && (
            <Row label="תאריך יעד">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                {formattedDate}
                {task.due_time && <span className="text-gray-500">בשעה {task.due_time}</span>}
              </span>
            </Row>
          )}

          {task.reminder_days_before_season != null && (
            <Row label="תזכורת">
              <span className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-gray-400" />
                {task.reminder_days_before_season} ימים לפני עונה
              </span>
            </Row>
          )}

          {/* Season context */}
          <Row label="הקשר עונה">
            <span className="text-gray-600">{SEASON_LABELS[task.season_context]}</span>
          </Row>

          {/* Assigned member */}
          {member && (
            <Row label="שיוך">
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {initials}
                </span>
                {member.name}
              </span>
            </Row>
          )}

          {/* Entity link */}
          {task.linked_entity_type && task.linked_entity_type !== 'screen_record' && (
            <Row label="קישור">
              <span className={cn('text-xs px-2 py-1 rounded-full', ENTITY_COLORS[task.linked_entity_type] ?? 'bg-gray-100 text-gray-600')}>
                {ENTITY_LABELS[task.linked_entity_type] ?? task.linked_entity_type}
                {task.linked_entity_name ? `: ${task.linked_entity_name}` : ''}
              </span>
            </Row>
          )}

          {task.linked_entity_type === 'screen_record' && (
            <Row label="רשומה">
              {task.linked_deep_link_path
                ? (
                  <Link
                    href={task.linked_deep_link_path}
                    onClick={onClose}
                    className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {task.linked_record_label ?? 'פתח רשומה'}
                  </Link>
                )
                : <span className="text-gray-400 text-sm">רשומה לא זמינה</span>
              }
            </Row>
          )}

          {/* Recurring */}
          {task.is_recurring && (
            <Row label="חזרה">
              <span className="flex items-center gap-1.5 text-gray-600">
                <RotateCcw className="h-3.5 w-3.5" />
                משימה חוזרת
                {task.recurring_expires_year && <span className="text-gray-400">(עד {task.recurring_expires_year})</span>}
              </span>
            </Row>
          )}

          {/* Private */}
          {task.is_private && (
            <Row label="פרטיות">
              <span className="flex items-center gap-1.5 text-gray-600">
                <Lock className="h-3.5 w-3.5" />
                פרטי (גלוי רק לי)
              </span>
            </Row>
          )}

          {/* Description */}
          {task.description && (
            <div className="pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">תיאור</p>
              {checklist ? (
                <div className="space-y-1.5">
                  {checklist.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChecklistItemToggle?.(item.id)}
                      className={cn(
                        'flex items-start gap-2 text-sm w-full text-right',
                        onChecklistItemToggle ? 'cursor-pointer hover:opacity-75 transition-opacity' : 'cursor-default'
                      )}
                    >
                      <span className={cn(
                        'mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center',
                        item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300'
                      )}>
                        {item.checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </span>
                      <span className={cn('leading-snug', item.checked && 'line-through text-gray-400')}>
                        {item.text}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{task.description}</p>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400">נוצרה: {formattedCreated}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
          <Button variant="outline" size="sm" onClick={onClose}>סגור</Button>
          <Button size="sm" onClick={() => { onClose(); onEdit() }}>עריכה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
