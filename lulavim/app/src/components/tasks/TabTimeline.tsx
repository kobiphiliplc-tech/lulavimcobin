'use client'

import { useMemo, useRef } from 'react'
import type { Task } from '@/lib/types'

interface Props {
  tasks: Task[]
  seasonStart?: string | null
  seasonEnd?: string | null
  onTaskClick: (task: Task) => void
}

function daysBetween(a: string, b: string): number {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  done: 'bg-gray-400',
}

const PRIORITY_RING: Record<string, string> = {
  urgent: 'ring-2 ring-red-500',
  normal: '',
}

export function TabTimeline({ tasks, seasonStart, seasonEnd, onTaskClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const today = todayISO()

  const hasSeasonDates = seasonStart && seasonEnd

  const seasonTasks = useMemo(() =>
    tasks.filter(t => t.task_type === 'task' && t.season_context !== 'next' && t.due_date),
    [tasks]
  )

  const nextTasks = useMemo(() =>
    tasks.filter(t => t.task_type === 'task' && t.season_context === 'next'),
    [tasks]
  )

  const reminderTasks = useMemo(() =>
    tasks.filter(t => t.task_type === 'task' && t.reminder_days_before_season != null && !t.due_date && t.status !== 'done'),
    [tasks]
  )

  if (!hasSeasonDates) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          <strong>טיפ:</strong> כדי לראות את ציר הזמן, הגדר תאריכי פתיחה וסגירה לעונה הנוכחית בהגדרות.
        </div>
        {seasonTasks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-600">משימות עם תאריך</h3>
            {seasonTasks.map(t => (
              <button key={t.id} onClick={() => onTaskClick(t)} className="w-full text-right bg-white border border-gray-200 rounded-lg px-4 py-3 hover:shadow-sm">
                <p className="text-sm font-medium">{t.title}</p>
                {t.due_date && <p className="text-xs text-gray-400 mt-0.5">{new Date(t.due_date + 'T12:00:00').toLocaleDateString('he-IL')}</p>}
              </button>
            ))}
          </div>
        )}
        {nextTasks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-indigo-600">תכנון עונה הבאה</h3>
            {nextTasks.map(t => (
              <button key={t.id} onClick={() => onTaskClick(t)} className="w-full text-right bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 hover:shadow-sm">
                <p className="text-sm font-medium">{t.title}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const totalDays = daysBetween(seasonStart!, seasonEnd!)
  const todayOffset = Math.max(0, Math.min(1, daysBetween(seasonStart!, today) / totalDays))

  function taskPosition(dueDate: string): number {
    const offset = daysBetween(seasonStart!, dueDate) / totalDays
    return Math.max(0, Math.min(1, offset))
  }

  return (
    <div className="space-y-8" dir="rtl">
      {reminderTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
            <span>⏰</span> תזכורות לפני פתיחת עונה
          </h3>
          {reminderTasks.map(t => (
            <button key={t.id} onClick={() => onTaskClick(t)} className="w-full text-right bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm hover:shadow-sm flex items-center gap-3">
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                {t.reminder_days_before_season} ימים לפני
              </span>
              <span className="font-medium">{t.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>{new Date(seasonStart! + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
          <span className="font-medium text-green-600">ציר העונה {seasonStart!.slice(0, 4)}</span>
          <span>{new Date(seasonEnd! + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
        </div>

        <div ref={containerRef} className="relative h-2 bg-gray-200 rounded-full mb-8">
          {/* Today marker */}
          {today >= seasonStart! && today <= seasonEnd! && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white shadow z-10"
              style={{ right: `${(1 - todayOffset) * 100}%` }}
              title="היום"
            />
          )}

          {/* Task dots */}
          {seasonTasks.map(t => {
            if (!t.due_date) return null
            const pos = taskPosition(t.due_date)
            return (
              <button
                key={t.id}
                onClick={() => onTaskClick(t)}
                title={t.title}
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-sm transition-transform hover:scale-125 z-20 ${STATUS_COLORS[t.status]} ${PRIORITY_RING[t.priority]}`}
                style={{ right: `${(1 - pos) * 100}%` }}
              />
            )
          })}
        </div>

        {/* Task list below timeline */}
        <div className="space-y-2">
          {seasonTasks
            .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
            .map(t => (
              <button key={t.id} onClick={() => onTaskClick(t)} className="w-full text-right bg-white border border-gray-200 rounded-lg px-4 py-3 hover:shadow-sm flex items-start gap-3">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${STATUS_COLORS[t.status]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.due_date && (
                    <p className="text-xs text-gray-400">{new Date(t.due_date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                  )}
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Next season section */}
      {nextTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-indigo-700 border-r-4 border-indigo-400 pr-3">
            📋 תכנון עונה הבאה
          </h3>
          {nextTasks.map(t => (
            <button key={t.id} onClick={() => onTaskClick(t)} className="w-full text-right bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 hover:shadow-sm text-sm">
              <p className="font-medium text-indigo-800">{t.title}</p>
              {t.description && <p className="text-xs text-indigo-400 mt-0.5 line-clamp-1">{t.description}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
