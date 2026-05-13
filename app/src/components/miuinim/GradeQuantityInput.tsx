'use client'

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  onChange: (val: number) => void
  gradeColor: string
  gradeTextColor: string
  gradeName: string
  isReject?: boolean
  tabIndex?: number
  onEnter?: () => void
}

function evalExpression(input: string): number | null {
  const cleaned = input.replace(/\s/g, '')
  if (!cleaned) return 0
  // allow only digits, +, -, *, /
  if (!/^[\d+\-*/().]+$/.test(cleaned)) return null
  try {
    // eslint-disable-next-line no-eval
    const result = Function(`"use strict"; return (${cleaned})`)()
    if (typeof result === 'number' && isFinite(result) && result >= 0) {
      return Math.round(result)
    }
  } catch {}
  return null
}

export function GradeQuantityInput({
  value, onChange, gradeColor, gradeTextColor, gradeName, isReject, tabIndex, onEnter,
}: Props) {
  const [inputVal, setInputVal] = useState(value > 0 ? String(value) : '')
  const [hasExpr, setHasExpr]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = useCallback((raw: string) => {
    const result = evalExpression(raw)
    if (result !== null) {
      onChange(result)
      setInputVal(result > 0 ? String(result) : '')
    } else {
      setInputVal(value > 0 ? String(value) : '')
    }
    setHasExpr(false)
  }, [value, onChange])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setInputVal(v)
    setHasExpr(/[+\-*/]/.test(v))
    // immediate update if pure number
    if (/^\d+$/.test(v)) {
      onChange(parseInt(v, 10))
    }
  }

  function handleBlur() {
    commit(inputVal)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      commit(inputVal)
      onEnter?.()
      e.preventDefault()
    }
    if (e.key === 'Tab') {
      commit(inputVal)
    }
  }

  // sync external value when form resets
  function handleFocus() {
    if (!inputVal && value > 0) setInputVal(String(value))
    inputRef.current?.select()
  }

  const displayVal = inputVal || (value > 0 ? String(value) : '')

  return (
    <div className="flex flex-col gap-1">
      {/* רמה */}
      <div
        className="text-xs font-bold px-2 py-1 rounded text-center leading-tight"
        style={{ background: gradeColor, color: gradeTextColor }}
      >
        {gradeName}
        {isReject && <span className="opacity-70 text-[10px] block">פסול</span>}
      </div>

      {/* שדה */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          tabIndex={tabIndex}
          value={displayVal}
          placeholder="0"
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full text-center text-sm font-semibold rounded border px-1 py-2',
            'focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400',
            'transition-colors',
            value > 0 ? 'bg-white border-gray-300' : 'bg-gray-50 border-gray-200 text-gray-400',
            hasExpr && 'border-blue-400 bg-blue-50 text-blue-700',
          )}
        />
        {hasExpr && (
          <span className="absolute -bottom-4 right-0 left-0 text-center text-[10px] text-blue-500">
            = {evalExpression(inputVal) ?? '?'}
          </span>
        )}
      </div>
    </div>
  )
}
