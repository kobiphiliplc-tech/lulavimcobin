'use client'

import { useEffect, useRef } from 'react'
import { getPendingActions, markSynced } from '@/lib/db/offline'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const syncing = useRef(false)

  async function syncPending() {
    if (syncing.current || !navigator.onLine) return
    syncing.current = true

    const supabase = createClient()
    const actions  = await getPendingActions()
    if (!actions.length) { syncing.current = false; return }

    let syncedCount = 0
    for (const action of actions) {
      try {
        if (action.operation === 'insert') {
          await supabase.from(action.table).insert(action.payload)
        } else if (action.operation === 'update') {
          const { id, ...data } = action.payload as Record<string, unknown>
          await supabase.from(action.table).update(data).eq('id', id)
        } else if (action.operation === 'delete') {
          await supabase.from(action.table).delete().eq('id', action.payload.id)
        }
        await markSynced(action.id!)
        syncedCount++
      } catch {}
    }

    if (syncedCount > 0) {
      toast.success(`${syncedCount} פעולות סונכרנו לענן`)
    }
    syncing.current = false
  }

  useEffect(() => {
    window.addEventListener('online', syncPending)
    return () => window.removeEventListener('online', syncPending)
  }, [])

  return <>{children}</>
}
