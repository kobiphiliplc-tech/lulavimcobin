'use client'

import { useEffect, useState } from 'react'
import { useSyncStatus } from '@/components/providers/SyncProvider'
import { WifiOff, RefreshCw } from 'lucide-react'

export function OfflineStatusBanner() {
  const [online, setOnline] = useState(true)
  const { pendingCount, isSyncing } = useSyncStatus()

  useEffect(() => {
    setOnline(navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online && pendingCount === 0) return null

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-1.5 flex items-center justify-between text-xs" dir="rtl">
      <span className="text-yellow-800 font-medium flex items-center gap-1.5">
        {!online && (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            עובד ללא חיבור לאינטרנט
          </>
        )}
      </span>
      {pendingCount > 0 && (
        <span className="text-yellow-700 flex items-center gap-1">
          {isSyncing
            ? <><RefreshCw className="w-3 h-3 animate-spin" /> מסנכרן...</>
            : `${pendingCount} פעולות ממתינות לסנכרון`
          }
        </span>
      )}
    </div>
  )
}
