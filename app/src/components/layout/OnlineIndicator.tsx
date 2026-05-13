'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function OnlineIndicator() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return (
    <span className={cn(
      'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full',
      online ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600 animate-pulse'
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', online ? 'bg-green-500' : 'bg-red-500')} />
      {online ? 'מחובר' : 'לא מחובר — עובד offline'}
    </span>
  )
}
