'use client'

import { useRef, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { HDate, HebrewCalendar } from '@hebcal/core'
import type { Task } from '@/lib/types'

interface Props {
  tasks: Task[]
  seasonStart?: string | null
  seasonEnd?: string | null
  onTaskClick: (task: Task) => void
  onDateClick: (date: string) => void
}

function hebrewDay(date: Date): string {
  try {
    return new HDate(date).renderGematriya()
  } catch {
    return ''
  }
}

function getHolidays(date: Date): string[] {
  try {
    const hd = new HDate(date)
    const events = HebrewCalendar.getHolidaysOnDate(hd, false) ?? []
    return events.map(e => e.render('he'))
  } catch {
    return []
  }
}

export function TabCalendar({ tasks, seasonStart, seasonEnd, onTaskClick, onDateClick }: Props) {
  const calendarRef = useRef<InstanceType<typeof FullCalendar>>(null)

  const events = useMemo(() => tasks
    .filter(t => t.task_type === 'task' && t.due_date)
    .map(t => ({
      id: t.id,
      title: t.title,
      date: t.due_date,
      backgroundColor: t.status === 'done' ? '#9ca3af' : t.priority === 'urgent' ? '#ef4444' : '#3b82f6',
      borderColor: 'transparent',
      textColor: '#fff',
      extendedProps: { task: t },
    })), [tasks])

  return (
    <div className="tasks-calendar" dir="ltr">
      <style>{`
        .tasks-calendar .fc { font-family: inherit; }
        .tasks-calendar .fc-toolbar-title { font-size: 1rem; font-weight: 600; }
        .tasks-calendar .fc-day-today { background: rgba(134,239,172,0.1) !important; }
        .tasks-calendar .fc-event { border-radius: 4px; font-size: 0.75rem; padding: 1px 4px; cursor: pointer; }
        .tasks-calendar .fc-daygrid-day-number { font-size: 0.8rem; }
        .tasks-calendar .fc-col-header-cell { font-size: 0.75rem; text-transform: none; }
      `}</style>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        locale="he"
        direction="rtl"
        height="auto"
        headerToolbar={{
          start: 'prev,next today',
          center: 'title',
          end: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
        }}
        buttonText={{
          today: 'היום',
          month: 'חודש',
          week: 'שבוע',
          day: 'יום',
          list: 'רשימה',
        }}
        events={events}

        dayCellContent={({ date, dayNumberText }) => {
          const hday = hebrewDay(date)
          const holidays = getHolidays(date)
          return (
            <div className="flex flex-col items-end gap-0.5 w-full">
              <span className="text-sm">{dayNumberText}</span>
              {hday && <span className="text-[9px] text-gray-400 leading-none">{hday}</span>}
              {holidays.map(h => (
                <span key={h} className="text-[8px] text-amber-600 leading-none truncate max-w-full">{h}</span>
              ))}
            </div>
          )
        }}

        dayCellClassNames={({ date }) => {
          const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          if (seasonStart && seasonEnd && iso >= seasonStart && iso <= seasonEnd) {
            return ['!bg-green-50']
          }
          return []
        }}

        eventClick={({ event }) => {
          const task = event.extendedProps.task as Task
          onTaskClick(task)
        }}

        dateClick={({ dateStr }) => {
          onDateClick(dateStr)
        }}

        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        firstDay={0}
      />
    </div>
  )
}
