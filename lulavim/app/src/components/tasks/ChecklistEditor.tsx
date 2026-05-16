'use client'

import { useRef } from 'react'
import type { ChecklistItem } from '@/lib/types'
import { newItem } from '@/lib/checklist'

interface Props {
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}

export function ChecklistEditor({ items, onChange }: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  function toggleChecked(index: number) {
    const toggled = items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    )
    onChange([...toggled.filter(i => !i.checked), ...toggled.filter(i => i.checked)])
  }

  function updateText(index: number, text: string) {
    const next = items.map((item, i) =>
      i === index ? { ...item, text } : item
    )
    onChange(next)
  }

  function addItemAfter(index: number) {
    const item = newItem()
    const next = [...items.slice(0, index + 1), item, ...items.slice(index + 1)]
    onChange(next)
    // focus the new item on next render
    setTimeout(() => inputRefs.current[index + 1]?.focus(), 0)
  }

  function removeItem(index: number) {
    if (items.length === 1) return
    const next = items.filter((_, i) => i !== index)
    onChange(next)
    setTimeout(() => {
      const focusIndex = Math.max(0, index - 1)
      inputRefs.current[focusIndex]?.focus()
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItemAfter(index)
    } else if (e.key === 'Backspace' && items[index].text === '') {
      e.preventDefault()
      removeItem(index)
    }
  }

  return (
    <div className="border border-gray-200 rounded-md bg-white mt-0">
      <ul dir="rtl" className="divide-y divide-gray-100">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center gap-2 px-3 py-1.5">
            {/* Checkbox */}
            <button
              type="button"
              onClick={() => toggleChecked(index)}
              aria-checked={item.checked}
              role="checkbox"
              className={`flex-shrink-0 w-4 h-4 rounded border transition-colors ${
                item.checked
                  ? 'bg-green-600 border-green-600 flex items-center justify-center'
                  : 'border-gray-300 hover:border-green-500'
              }`}
            >
              {item.checked && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Text input */}
            <input
              ref={el => { inputRefs.current[index] = el }}
              type="text"
              value={item.text}
              onChange={e => updateText(index, e.target.value)}
              onKeyDown={e => handleKeyDown(e, index)}
              aria-label="פריט רשימה"
              placeholder="פריט..."
              dir="rtl"
              className={`flex-1 text-sm bg-transparent outline-none min-w-0 ${
                item.checked ? 'line-through text-gray-400' : 'text-gray-700'
              }`}
            />

            {/* Delete button */}
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors text-base leading-none"
                tabIndex={-1}
                aria-label="מחק פריט"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Add item button */}
      <button
        type="button"
        onClick={() => addItemAfter(items.length - 1)}
        className="w-full text-right px-3 py-1.5 text-xs text-gray-400 hover:text-green-600 hover:bg-gray-50 transition-colors rounded-b-md"
        dir="rtl"
      >
        + הוסף פריט
      </button>
    </div>
  )
}
