import Dexie, { type Table } from 'dexie'

export interface OfflineAction {
  id?: number
  table: string
  operation: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  createdAt: number
  synced: boolean
}

export type CacheTable =
  | 'cached_sale_orders'
  | 'cached_sale_order_items'
  | 'cached_customers'
  | 'cached_customer_payments'
  | 'cached_inventory'
  | 'cached_sorting_events'
  | 'cached_sorting_quantities'
  | 'cached_receiving_orders'
  | 'cached_suppliers'
  | 'cached_fields'

class LulabDB extends Dexie {
  offlineActions!: Table<OfflineAction>
  cached_sale_orders!: Table<Record<string, unknown>>
  cached_sale_order_items!: Table<Record<string, unknown>>
  cached_customers!: Table<Record<string, unknown>>
  cached_customer_payments!: Table<Record<string, unknown>>
  cached_inventory!: Table<Record<string, unknown>>
  cached_sorting_events!: Table<Record<string, unknown>>
  cached_sorting_quantities!: Table<Record<string, unknown>>
  cached_receiving_orders!: Table<Record<string, unknown>>
  cached_suppliers!: Table<Record<string, unknown>>
  cached_fields!: Table<Record<string, unknown>>

  constructor() {
    super('lulab-offline')
    this.version(1).stores({
      offlineActions: '++id, table, synced, createdAt',
    })
    this.version(2).stores({
      offlineActions: '++id, table, synced, createdAt',
      cached_sale_orders: '&id, season, customer_id, status',
      cached_sale_order_items: '&id, order_id',
      cached_customers: '&id',
      cached_customer_payments: '&id, season, customer_id, order_id',
      cached_inventory: '&id, season, grade, length_type, freshness_type',
      cached_sorting_events: '&id, season',
      cached_sorting_quantities: '&id, sorting_event_id',
      cached_receiving_orders: '&id, season',
      cached_suppliers: '&id',
      cached_fields: '&id, supplier_id',
    })
  }
}

export const db = new LulabDB()

// ─── Pending Actions ──────────────────────────────────────────────────────────

export async function queueAction(action: Omit<OfflineAction, 'id' | 'createdAt' | 'synced'>) {
  await db.offlineActions.add({ ...action, createdAt: Date.now(), synced: false })
}

export async function getPendingActions() {
  return db.offlineActions.where('synced').equals(0).toArray()
}

export async function markSynced(id: number) {
  await db.offlineActions.update(id, { synced: true })
}

// ─── Cache Operations ─────────────────────────────────────────────────────────

export async function cacheRows(
  table: CacheTable,
  rows: Record<string, unknown>[],
  season?: string
): Promise<void> {
  const t = db.table(table)
  if (season) {
    await t.where('season').equals(season).delete()
  } else {
    await t.clear()
  }
  const stamped = rows.map(r => ({ ...r, _cached_at: Date.now() }))
  await t.bulkPut(stamped)
}

export async function getCachedRows(
  table: CacheTable,
  season?: string
): Promise<Record<string, unknown>[]> {
  const t = db.table(table)
  if (season) {
    return t.where('season').equals(season).toArray()
  }
  return t.toArray()
}

export async function upsertCachedRow(
  table: CacheTable,
  row: Record<string, unknown>
): Promise<void> {
  await db.table(table).put({ ...row, _cached_at: Date.now() })
}

export async function removeCachedRow(
  table: CacheTable,
  id: number | string
): Promise<void> {
  await db.table(table).delete(id)
}
