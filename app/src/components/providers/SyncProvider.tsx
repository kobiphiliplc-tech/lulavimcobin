'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getPendingActions, markSynced, removeCachedRow, upsertCachedRow, type CacheTable } from '@/lib/db/offline'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface SyncCtx {
  pendingCount: number
  isSyncing: boolean
}

const SyncContext = createContext<SyncCtx>({ pendingCount: 0, isSyncing: false })

export function useSyncStatus() {
  return useContext(SyncContext)
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const syncing = useRef(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  async function refreshPendingCount() {
    const actions = await getPendingActions()
    setPendingCount(actions.length)
  }

  async function syncPending() {
    if (syncing.current || !navigator.onLine) return
    syncing.current = true
    setIsSyncing(true)

    const supabase = createClient()
    const actions = await getPendingActions()
    if (!actions.length) {
      syncing.current = false
      setIsSyncing(false)
      return
    }

    let syncedCount = 0
    let failedCount = 0

    for (const action of actions) {
      try {
        if (action.operation === 'insert') {
          const { _tempId, items, ...payload } = action.payload as Record<string, unknown>

          // Insert parent row
          const { data, error } = await supabase
            .from(action.table)
            .insert(payload)
            .select('id')
            .single()

          if (error) throw error

          // Replace temp row in cache with real ID
          if (data && _tempId != null) {
            const cacheTable = `cached_${action.table}` as CacheTable
            await removeCachedRow(cacheTable, _tempId as number)
            await upsertCachedRow(cacheTable, { ...payload, id: data.id })
          }

          // Insert child items (e.g. sorting_quantities, sale_order_items)
          if (Array.isArray(items) && data) {
            const childTable = action.table === 'sorting_events'
              ? 'sorting_quantities'
              : action.table === 'sale_orders'
                ? 'sale_order_items'
                : null
            if (childTable) {
              const childRows = (items as Record<string, unknown>[]).map(item => ({
                ...item,
                [`${action.table.replace(/s$/, '')}_id`]: data.id,
              }))
              // Use the correct FK column name
              const fkCol = childTable === 'sorting_quantities' ? 'sorting_event_id' : 'order_id'
              const linkedRows = childRows.map(r => ({ ...r, [fkCol]: data.id }))
              await supabase.from(childTable).insert(linkedRows)

              const childCacheTable = `cached_${childTable}` as CacheTable
              for (const row of linkedRows) {
                await upsertCachedRow(childCacheTable, row)
              }
            }
          }

        } else if (action.operation === 'update') {
          const { id, ...data } = action.payload as Record<string, unknown>
          const { error } = await supabase.from(action.table).update(data).eq('id', id)
          if (error) throw error

        } else if (action.operation === 'delete') {
          const { error } = await supabase.from(action.table).delete().eq('id', action.payload.id)
          if (error) throw error
        }

        await markSynced(action.id!)
        syncedCount++
      } catch (err) {
        failedCount++
        console.error('[SyncProvider] failed to sync action', action.id, err)
      }
    }

    if (syncedCount > 0) {
      toast.success(`${syncedCount} פעולות סונכרנו לענן`)
      window.dispatchEvent(new CustomEvent('lulab:synced'))
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} פעולות לא סונכרנו — ינסה שוב`)
    }

    await refreshPendingCount()
    syncing.current = false
    setIsSyncing(false)
  }

  useEffect(() => {
    refreshPendingCount()
    syncPending()
    window.addEventListener('online', syncPending)
    return () => window.removeEventListener('online', syncPending)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SyncContext.Provider value={{ pendingCount, isSyncing }}>
      {children}
    </SyncContext.Provider>
  )
}
