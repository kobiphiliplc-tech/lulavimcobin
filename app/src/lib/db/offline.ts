import Dexie, { type Table } from 'dexie'

export interface OfflineAction {
  id?: number
  table: string
  operation: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  createdAt: number
  synced: boolean
}

class LulabDB extends Dexie {
  offlineActions!: Table<OfflineAction>

  constructor() {
    super('lulab-offline')
    this.version(1).stores({
      offlineActions: '++id, table, synced, createdAt',
    })
  }
}

export const db = new LulabDB()

export async function queueAction(action: Omit<OfflineAction, 'id' | 'createdAt' | 'synced'>) {
  await db.offlineActions.add({ ...action, createdAt: Date.now(), synced: false })
}

export async function getPendingActions() {
  return db.offlineActions.where('synced').equals(0).toArray()
}

export async function markSynced(id: number) {
  await db.offlineActions.update(id, { synced: true })
}
