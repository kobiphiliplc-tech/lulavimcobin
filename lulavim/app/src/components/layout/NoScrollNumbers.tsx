'use client'
import { useEffect } from 'react'

export default function NoScrollNumbers() {
  useEffect(() => {
    function handler(e: WheelEvent) {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number') {
        el.blur()
      }
    }
    document.addEventListener('wheel', handler, { passive: true })
    return () => document.removeEventListener('wheel', handler)
  }, [])
  return null
}
