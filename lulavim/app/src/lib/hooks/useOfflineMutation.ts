'use client'

import { useState } from 'react'
import { queueAction, type OfflineAction } from '@/lib/db/offline'
import { toast } from 'sonner'

interface MutationConfig {
  supabaseOp: () => Promise<{ data: unknown; error: unknown }>
  offlineAction: Omit<OfflineAction, 'id' | 'createdAt' | 'synced'>
  optimisticUpdate?: () => Promise<void>
  rollback?: () => Promise<void>
  successMessage?: string
  errorMessage?: string
}

interface UseOfflineMutationResult {
  mutate: (config: MutationConfig) => Promise<unknown>
  pending: boolean
}

export function useOfflineMutation(): UseOfflineMutationResult {
  const [pending, setPending] = useState(false)

  async function mutate(config: MutationConfig): Promise<unknown> {
    setPending(true)
    try {
      if (!navigator.onLine) {
        // Offline path: queue action first, then optimistic update
        await queueAction(config.offlineAction)
        if (config.optimisticUpdate) await config.optimisticUpdate()
        toast.info('נשמר מקומית — יסונכרן כשיחזור החיבור')
        return null
      }

      // Online path: optimistic update, then Supabase
      if (config.optimisticUpdate) await config.optimisticUpdate()
      const { data, error } = await config.supabaseOp()
      if (error) {
        if (config.rollback) await config.rollback()
        toast.error(config.errorMessage ?? 'שגיאה בשמירה')
        return null
      }
      if (config.successMessage) toast.success(config.successMessage)
      return data
    } catch {
      if (config.rollback) await config.rollback()
      toast.error(config.errorMessage ?? 'שגיאה בשמירה')
      return null
    } finally {
      setPending(false)
    }
  }

  return { mutate, pending }
}
