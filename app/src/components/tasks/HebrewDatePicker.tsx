'use client'

import { useState } from 'react'
import Calendar from 'react-calendar'
import { HDate } from '@hebcal/core'
import 'react-calendar/dist/Calendar.css'

interface Props {
  value?: string        // ISO date YYYY-MM-DD
  onChange: (iso: string) => void
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function hebrewDay(date: Date): string {
  try {
    const hd = new HDate(date)
    return hd.renderGematriya()
  } catch {
    return ''
  }
}

export function HebrewDatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const selected = value ? new Date(value + 'T12:00:00') : undefined

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-right bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        {value
          ? `${new Date(value + 'T12:00:00').toLocaleDateString('he-IL')} — ${hebrewDay(new Date(value + 'T12:00:00'))}`
          : 'בחר תאריך...'}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2" dir="rtl">
          <Calendar
            locale="he-IL"
            value={selected}
            onChange={(val) => {
              if (val instanceof Date) {
                onChange(toISO(val))
                setOpen(false)
              }
            }}
            tileContent={({ date }) => (
              <span className="block text-[9px] text-gray-400 leading-none mt-0.5">
                {hebrewDay(date)}
              </span>
            )}
            navigationLabel={({ date }) =>
              date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
            }
            prevLabel="‹"
            nextLabel="›"
            prev2Label="«"
            next2Label="»"
            className="!border-0 !font-sans text-sm"
          />
        </div>
      )}
    </div>
  )
}
