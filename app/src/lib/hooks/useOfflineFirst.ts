'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { type CacheTable, cacheRows, getCachedRows } from '@/lib/db/offline'

interface UseOfflineFirstOptions<T> {
  cacheTable: CacheTable
  season?: string
  fetchFromSupabase: () => Promise<T[]>
  transformForCache?: (rows: T[]) => Record<string, unknown>[]
  transformFromCache?: (rows: Record<string, unknown>[]) => T[]
}

interface UseOfflineFirstResult<T> {
  data: T[]
  loading: boolean
  isFromCache: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useOfflineFirst<T>({
  cacheTable,
  season,
  fetchFromSupabase,
  transformForCache,
  transformFromCache,
}: UseOfflineFirstOptions<T>): UseOfflineFirstResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasCacheData = useRef(false)

  // Effect 1: load from IndexedDB cache immediately (sub-ms, no network)
  useEffect(() => {
    getCachedRows(cacheTable, season).then(rows => {
      if (rows.length > 0) {
        const typed = transformFromCache ? transformFromCache(rows) : (rows as unknown as T[])
        setData(typed)
        setIsFromCache(true)
        setLoading(false)
        hasCacheData.current = true
      }
    }).catch(() => {
      // cache read failure is non-fatal
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheTable, season])

  const fetchAndCache = useCallback(async () => {
    if (!navigator.onLine) {
      setLoading(false)
      return
    }
    try {
      const rows = await fetchFromSupabase()
      setData(rows)
      setIsFromCache(false)
      setError(null)
      const toCache = transformForCache ? transformForCache(rows) : (rows as unknown as Record<string, unknown>[])
      await cacheRows(cacheTable, toCache, season)
    } catch {
      // network failed — cache data remains visible if present
      if (!hasCacheData.current) {
        setError('לא ניתן לטעון נתונים — אין חיבור לאינטרנט')
      }
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheTable, season])

  // Effect 2: fetch fresh data from Supabase (updates over cache silently)
  useEffect(() => {
    fetchAndCache()
  }, [fetchAndCache])

  const refresh = useCallback(async () => {
    await fetchAndCache()
  }, [fetchAndCache])

  return { data, loading, isFromCache, error, refresh }
}
