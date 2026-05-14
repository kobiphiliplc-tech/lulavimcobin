'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/lib/context/SeasonContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SortingForm } from '@/components/miuinim/SortingForm'
import { WhatsAppShareDialog } from '@/components/miuinim/WhatsAppShare'
import { SortingTable } from '@/components/miuinim/SortingTable'
import {
  GRADES, LENGTH_TYPES, FRESHNESS_TYPES,
  GRADE_GROUP_TOP, GRADE_GROUP_MID, GRADE_GROUP_LOWER, GRADE_GROUP_REJECT,
} from '@/lib/constants'
import type { SortingEvent, Supplier, Field, ReceivingOrder, Grade } from '@/lib/types'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cacheRows, getCachedRows, upsertCachedRow, removeCachedRow, queueAction } from '@/lib/db/offline'

const PAGE_SIZE = 20

// ─── helpers ────────────────────────────────────────────────────────────────

function sumGroup(qtys: Array<{ grade: string; quantity: number }>, group: string[]) {
  return qtys.filter(q => group.includes(q.grade)).reduce((s, q) => s + q.quantity, 0)
}

function statusBadge(status: string) {
  if (status === 'משנת יוסף') return <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0">משנת יוסף</Badge>
  if (status === 'צהוב')       return <Badge className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0">צהוב</Badge>
  return <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">{status || 'בסיסי'}</Badge>
}

// ─── ProgressBar ────────────────────────────────────────────────────────────

function ProgressBar({ qtys }: { qtys: Array<{ grade: string; quantity: number }> }) {
  const top    = sumGroup(qtys, GRADE_GROUP_TOP)
  const mid    = sumGroup(qtys, GRADE_GROUP_MID)
  const lower  = sumGroup(qtys, GRADE_GROUP_LOWER)
  const reject = sumGroup(qtys, GRADE_GROUP_REJECT)
  const total  = top + mid + lower + reject
  if (!total) return null
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`
  return (
    <div className="flex h-2 w-full overflow-hidden">
      {top    > 0 && <div style={{ width: pct(top)    }} className="bg-green-500" />}
      {mid    > 0 && <div style={{ width: pct(mid)    }} className="bg-orange-400" />}
      {lower  > 0 && <div style={{ width: pct(lower)  }} className="bg-gray-300" />}
      {reject > 0 && <div style={{ width: pct(reject) }} className="bg-red-400" />}
    </div>
  )
}

// ─── SortingCard ────────────────────────────────────────────────────────────

interface CardProps {
  event: SortingEvent
  suppliers: Supplier[]
  fields: Field[]
  expanded: boolean
  selected: boolean
  selectionMode: boolean
  onToggle: () => void
  onSelect: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function SortingCard({
  event, suppliers, fields,
  expanded, selected, selectionMode, onToggle, onSelect, onEdit, onDuplicate, onDelete,
}: CardProps) {
  const qtys  = event.sorting_quantities ?? []
  const total = qtys.reduce((s, q) => s + q.quantity, 0)

  const wsPct        = total ? Math.round((sumGroup(qtys, GRADE_GROUP_TOP) / total) * 100) : 0
  const fieldName    = fields.find(f => f.id === event.field_id)?.name ?? event.field_name ?? '—'
  const supplierName = suppliers.find(s => s.id === event.supplier_id)?.name ?? '—'
  const dateStr      = event.sorted_date
    ? new Date(event.sorted_date + 'T00:00:00').toLocaleDateString('he-IL')
    : '—'

  return (
    <div className={cn("border rounded-lg bg-white shadow-sm overflow-hidden", selected && "ring-2 ring-blue-400 border-blue-300")} dir="rtl">

      {/* ── main row ── */}
      <div className="flex items-stretch cursor-pointer select-none hover:bg-gray-50 transition-colors" onClick={onToggle}>
        {/* CHECKBOX — visible only in selection mode */}
        {selectionMode && (
          <div className="flex items-center px-2 flex-shrink-0" onClick={e => { e.stopPropagation(); onSelect() }}>
            <input type="checkbox" className="h-4 w-4 rounded" checked={selected}
              onChange={onSelect} onClick={e => e.stopPropagation()} />
          </div>
        )}

        {/* serial + warehouse code */}
        <div className="flex flex-col items-center justify-center px-2 py-2.5 min-w-[52px] flex-shrink-0 text-center">
          <span className="font-mono font-bold text-base leading-none text-gray-900">{event.sort_serial}</span>
          {event.warehouse_code ? (
            <span className="text-[10px] text-gray-400 mt-1">מח׳ {event.warehouse_code}</span>
          ) : (
            <span className="text-[10px] text-gray-300 mt-1">—</span>
          )}
        </div>

        <div className="w-px bg-gray-200 my-2 flex-shrink-0" />

        {/* center info */}
        <div className="flex-1 flex flex-col justify-center px-3 py-2.5 min-w-0 gap-0.5">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="font-semibold text-sm text-gray-900 truncate">{fieldName}</span>
            {statusBadge(event.status_type)}
            <span className="text-xs text-gray-400 flex-shrink-0">{event.length_type}·{event.freshness_type}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 min-w-0">
            <span className="flex-shrink-0">{dateStr}</span>
            <span className="text-gray-300 flex-shrink-0">·</span>
            <span className="truncate min-w-[3rem]">{supplierName}</span>
            <span className="text-gray-300 flex-shrink-0">·</span>
            <span className="font-medium text-gray-700 flex-shrink-0">{total.toLocaleString()} יח׳</span>
          </div>
        </div>

        <div className="w-px bg-gray-200 my-2 flex-shrink-0" />

        {/* % top */}
        <div className="flex flex-col items-center justify-center px-3 py-2.5 min-w-[56px] flex-shrink-0">
          <span className={cn('text-xl font-bold leading-none', wsPct >= 40 ? 'text-green-600' : 'text-gray-500')}>
            {wsPct}%
          </span>
          <span className="text-[10px] text-gray-400 mt-1">לבן+ירוק+כסף</span>
        </div>
      </div>

      <ProgressBar qtys={qtys} />

      {/* ── expanded ── */}
      {expanded && (
        <div className="border-t px-3 py-2.5 bg-gray-50 space-y-2.5">
          {/* grade badges */}
          <div className="flex flex-wrap gap-1.5">
            {GRADES.map(g => {
              const qty = qtys.find(q => q.grade === g.name)?.quantity ?? 0
              return (
                <span key={g.name}
                  className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-opacity',
                    qty === 0 ? 'opacity-25' : 'opacity-100'
                  )}
                  style={{ background: g.color, color: g.textColor }}
                >
                  {g.name}<span className="font-bold">{qty.toLocaleString()}</span>
                </span>
              )
            })}
          </div>

          {event.notes && <p className="text-xs text-gray-500">{event.notes}</p>}

          {/* action buttons */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={e => { e.stopPropagation(); onEdit() }}>
              <Pencil className="h-3 w-3" /> עריכה
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={e => { e.stopPropagation(); onDuplicate() }}>
              <Copy className="h-3 w-3" /> שכפול
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-500 hover:text-red-700"
              onClick={e => { e.stopPropagation(); onDelete() }}>
              <Trash2 className="h-3 w-3" /> מחיקה
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PivotView ──────────────────────────────────────────────────────────────

function PivotView({ events, fields }: { events: SortingEvent[]; fields: Field[] }) {
  const [range, setRange] = useState<'week' | 'month' | 'season'>('season')

  const filtered = useMemo(() => {
    if (range === 'season') return events
    const now = new Date()
    const cutoff = new Date(now)
    if (range === 'week')  cutoff.setDate(now.getDate() - 7)
    if (range === 'month') cutoff.setMonth(now.getMonth() - 1)
    return events.filter(e => new Date(e.sorted_date + 'T00:00:00') >= cutoff)
  }, [events, range])

  const sorted = useMemo(() => [...filtered].sort((a, b) => a.sort_serial - b.sort_serial), [filtered])
  const allGrades = [...GRADE_GROUP_TOP, ...GRADE_GROUP_MID, ...GRADE_GROUP_LOWER]

  function getQty(event: SortingEvent, grade: string) {
    return event.sorting_quantities?.find(q => q.grade === grade)?.quantity ?? 0
  }
  function colTotal(grade: string) {
    return sorted.reduce((s, e) => s + getQty(e, grade), 0)
  }
  function eventTotal(event: SortingEvent) {
    return (event.sorting_quantities ?? []).reduce((s, q) => s + q.quantity, 0)
  }
  function grandTotal() {
    return sorted.reduce((s, e) => s + eventTotal(e), 0)
  }
  function rejectTotal(event: SortingEvent) {
    return sumGroup(event.sorting_quantities ?? [], GRADE_GROUP_REJECT)
  }
  function colRejectTotal() {
    return sorted.reduce((s, e) => s + rejectTotal(e), 0)
  }

  const cellCls    = "border px-2 py-1 text-center tabular-nums"
  const headCls    = "border px-2 py-1 bg-gray-100 font-semibold text-gray-700 whitespace-nowrap"
  const stickyR    = "sticky right-0 bg-white border px-2 py-1 font-semibold text-right whitespace-nowrap z-10"
  const stickyRHead = "sticky right-0 bg-gray-100 border px-2 py-1 font-semibold text-right whitespace-nowrap z-10"

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">טווח:</span>
        <Select value={range} onValueChange={v => setRange(v as typeof range)}>
          <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-white text-gray-900">
            <SelectItem value="week">שבוע אחרון</SelectItem>
            <SelectItem value="month">חודש אחרון</SelectItem>
            <SelectItem value="season">כל העונה</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400">{sorted.length} מיונים</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">אין נתונים לטווח הנבחר</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="text-xs border-collapse min-w-max w-full" dir="rtl">
            <thead>
              <tr>
                <th className={stickyRHead}>רמה \ מיון</th>
                {sorted.map(e => {
                  const fn = fields.find(f => f.id === e.field_id)?.name ?? e.field_name ?? ''
                  return (
                    <th key={e.id} className={headCls}>
                      <div className="font-mono">#{e.sort_serial}</div>
                      <div className="font-normal text-gray-500 text-[10px] max-w-[80px] truncate">{fn}</div>
                    </th>
                  )
                })}
                <th className={`${headCls} bg-blue-50 text-blue-800`}>סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {allGrades.map((grade, gi) => {
                const isTopLast = gi === GRADE_GROUP_TOP.length - 1
                const isMidLast = gi === GRADE_GROUP_TOP.length + GRADE_GROUP_MID.length - 1
                const g = GRADES.find(x => x.name === grade)!
                const total = colTotal(grade)
                return (
                  <tr key={grade} className={isTopLast || isMidLast ? 'border-b-2 border-gray-300' : ''}>
                    <td className={stickyR}>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ background: g.color, border: '1px solid #ccc' }} />
                        {grade}
                      </span>
                    </td>
                    {sorted.map(e => {
                      const qty = getQty(e, grade)
                      return <td key={e.id} className={cellCls}>{qty || '—'}</td>
                    })}
                    <td className={`${cellCls} font-bold bg-blue-50`}>{total || '—'}</td>
                  </tr>
                )
              })}

              <tr className="bg-red-50 border-t-2 border-red-200">
                <td className={`${stickyR} bg-red-50 text-red-700`}>פסולת (עובש+ענף)</td>
                {sorted.map(e => {
                  const qty = rejectTotal(e)
                  return <td key={e.id} className={`${cellCls} text-red-600`}>{qty || '—'}</td>
                })}
                <td className={`${cellCls} font-bold bg-red-100 text-red-700`}>{colRejectTotal() || '—'}</td>
              </tr>

              <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                <td className={`${stickyR} bg-gray-100`}>סה״כ</td>
                {sorted.map(e => (
                  <td key={e.id} className={`${cellCls} font-bold`}>{eventTotal(e) || '—'}</td>
                ))}
                <td className={`${cellCls} font-bold bg-blue-100`}>{grandTotal() || '—'}</td>
              </tr>

              <tr className="bg-green-50 text-green-800">
                <td className={`${stickyR} bg-green-50 text-green-700 text-[10px]`}>% לבן+ירוק+כסף</td>
                {sorted.map(e => {
                  const t = eventTotal(e)
                  const top = sumGroup(e.sorting_quantities ?? [], GRADE_GROUP_TOP)
                  return <td key={e.id} className={`${cellCls} text-[10px]`}>{t ? `${Math.round(top/t*100)}%` : '—'}</td>
                })}
                <td className={`${cellCls} text-[10px] font-bold bg-green-100`}>
                  {grandTotal() ? `${Math.round(sorted.reduce((s,e) => s+sumGroup(e.sorting_quantities??[],GRADE_GROUP_TOP),0)/grandTotal()*100)}%` : '—'}
                </td>
              </tr>

              <tr className="bg-orange-50 text-orange-800">
                <td className={`${stickyR} bg-orange-50 text-orange-700 text-[10px]`}>% כסף2+כתום</td>
                {sorted.map(e => {
                  const t = eventTotal(e)
                  const mid = sumGroup(e.sorting_quantities ?? [], GRADE_GROUP_MID)
                  return <td key={e.id} className={`${cellCls} text-[10px]`}>{t ? `${Math.round(mid/t*100)}%` : '—'}</td>
                })}
                <td className={`${cellCls} text-[10px] font-bold bg-orange-100`}>
                  {grandTotal() ? `${Math.round(sorted.reduce((s,e) => s+sumGroup(e.sorting_quantities??[],GRADE_GROUP_MID),0)/grandTotal()*100)}%` : '—'}
                </td>
              </tr>

              <tr className="bg-gray-50 text-gray-600">
                <td className={`${stickyR} bg-gray-50 text-gray-600 text-[10px]`}>% כשר (ללא פסולת)</td>
                {sorted.map(e => {
                  const t = eventTotal(e)
                  const nonR = t - rejectTotal(e)
                  return <td key={e.id} className={`${cellCls} text-[10px]`}>{t ? `${Math.round(nonR/t*100)}%` : '—'}</td>
                })}
                <td className={`${cellCls} text-[10px] font-bold bg-gray-200`}>
                  {grandTotal() ? `${Math.round((grandTotal()-colRejectTotal())/grandTotal()*100)}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type KabalaPrompt = {
  field_id?: number
  supplier_id?: number
  freshness_type?: string
  length_type?: string
  warehouse_code: string
  total_quantity: number
}

export default function MiuinimPage() {
  const supabase = createClient()
  const { activeSeason } = useSeason()
  const router = useRouter()

  const [events,          setEvents]          = useState<SortingEvent[]>([])
  const [suppliers,       setSuppliers]       = useState<Supplier[]>([])
  const [fields,          setFields]          = useState<Field[]>([])
  const [receivingOrders, setReceivingOrders] = useState<ReceivingOrder[]>([])
  const [gradesList,      setGradesList]      = useState<Grade[]>([])
  const [loading,         setLoading]         = useState(true)
  const [isFromCache,     setIsFromCache]     = useState(false)
  const [dialogOpen,      setDialogOpen]      = useState(false)
  const [editing,         setEditing]         = useState<SortingEvent | undefined>()
  const [nextSerial,      setNextSerial]      = useState<number | undefined>()

  const [pendingKabalaPrompt, setPendingKabalaPrompt] = useState<KabalaPrompt | null>(null)

  const [globalFilter,    setGlobalFilter]    = useState('')
  const [filterSupplier,  setFilterSupplier]  = useState('all')
  const [filterLength,    setFilterLength]    = useState('all')
  const [filterFreshness, setFilterFreshness] = useState('all')
  const [page,            setPage]            = useState(0)
  const [activeTab,       setActiveTab]       = useState<'list' | 'table' | 'pivot' | 'missing'>('list')
  const [expandedIds,     setExpandedIds]     = useState<Set<number>>(new Set())
  const [selectedIds,     setSelectedIds]     = useState<Set<number>>(new Set())
  const [selectionMode,   setSelectionMode]   = useState(false)
  const [waShareOpen,     setWaShareOpen]     = useState(false)

  const loadFromCache = useCallback(async () => {
    if (!activeSeason) return
    const [cachedEvents, cachedSuppliers, cachedFields, cachedOrders] = await Promise.all([
      getCachedRows('cached_sorting_events', activeSeason),
      getCachedRows('cached_suppliers'),
      getCachedRows('cached_fields'),
      getCachedRows('cached_receiving_orders', activeSeason),
    ])
    if (cachedEvents.length > 0) {
      setEvents(cachedEvents as unknown as SortingEvent[])
      setIsFromCache(true)
      setLoading(false)
    }
    if (cachedSuppliers.length > 0) setSuppliers(cachedSuppliers as unknown as Supplier[])
    if (cachedFields.length > 0)    setFields(cachedFields as unknown as Field[])
    if (cachedOrders.length > 0)    setReceivingOrders(cachedOrders as unknown as ReceivingOrder[])
  }, [activeSeason])

  const fetchAll = useCallback(async () => {
    if (!activeSeason) return
    if (!navigator.onLine) { setLoading(false); return }
    setLoading(true)
    const [evRes, supRes, fldRes, ordRes, gradeRes] = await Promise.all([
      supabase.from('sorting_events')
        .select('*, sorting_quantities(*)')
        .eq('season', activeSeason)
        .order('sort_serial', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('fields').select('*').order('name'),
      supabase.from('receiving_orders')
        .select('id, serial_no, supplier_id, field_id, total_quantity, returns_quantity, received_date, freshness_type, warehouse_code, status, fields(name)')
        .eq('season', activeSeason)
        .order('received_date', { ascending: false }),
      supabase.from('grades').select('*').order('sort_order'),
    ])

    if (evRes.error)  console.error('[miuinim] events:', evRes.error)
    if (supRes.error) console.error('[miuinim] suppliers:', supRes.error)
    if (fldRes.error) console.error('[miuinim] fields:', fldRes.error)
    if (ordRes.error) console.error('[miuinim] orders:', ordRes.error)

    if (evRes.data) {
      setEvents(evRes.data as SortingEvent[])
      setIsFromCache(false)
      await cacheRows('cached_sorting_events', evRes.data as unknown as Record<string, unknown>[], activeSeason)
    }
    if (supRes.data) {
      setSuppliers(supRes.data)
      await cacheRows('cached_suppliers', supRes.data as Record<string, unknown>[])
    }
    if (fldRes.data) {
      setFields(fldRes.data)
      await cacheRows('cached_fields', fldRes.data as Record<string, unknown>[])
    }
    if (ordRes.data) {
      setReceivingOrders(ordRes.data as unknown as ReceivingOrder[])
      await cacheRows('cached_receiving_orders', ordRes.data as unknown as Record<string, unknown>[], activeSeason)
    }
    if (gradeRes.data && gradeRes.data.length > 0) setGradesList(gradeRes.data as Grade[])

    setLoading(false)
  }, [supabase, activeSeason])

  useEffect(() => {
    loadFromCache().then(() => fetchAll())
  }, [loadFromCache, fetchAll])

  useEffect(() => {
    const onSync = () => fetchAll()
    window.addEventListener('lulab:synced', onSync)
    return () => window.removeEventListener('lulab:synced', onSync)
  }, [fetchAll])

  useEffect(() => { setPage(0) }, [globalFilter, filterSupplier, filterLength, filterFreshness])

  function seasonBase() {
    return parseInt(activeSeason.slice(-2), 10) * 1000
  }

  function computeNextSerial(remoteMax?: number) {
    const localMax = events.length > 0 ? Math.max(...events.map(e => e.sort_serial)) : 0
    const base = seasonBase() + 1
    return Math.max(localMax + 1, remoteMax ? remoteMax + 1 : 0, base)
  }

  async function openNew() {
    setEditing(undefined)
    if (navigator.onLine) {
      const { data } = await supabase
        .from('sorting_events').select('sort_serial').order('sort_serial', { ascending: false }).limit(1).maybeSingle()
      setNextSerial(computeNextSerial(data?.sort_serial))
    } else {
      setNextSerial(computeNextSerial())
    }
    setDialogOpen(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function openDuplicate(_event: SortingEvent) {
    setEditing(undefined)
    if (navigator.onLine) {
      const { data } = await supabase
        .from('sorting_events').select('sort_serial').order('sort_serial', { ascending: false }).limit(1).maybeSingle()
      setNextSerial(computeNextSerial(data?.sort_serial))
    } else {
      setNextSerial(computeNextSerial())
    }
    setDialogOpen(true)
  }

  async function handleSubmit(
    data: Parameters<React.ComponentProps<typeof SortingForm>['onSubmit']>[0]
  ) {
    const { quantities, ...eventData } = data
    const payload = { ...eventData, season: activeSeason }

    // ── OFFLINE PATH ─────────────────────────────────────────────────────────
    if (!navigator.onLine) {
      if (editing && editing.id !== 0) {
        // Edit offline: queue update + quantities replace
        await queueAction({ table: 'sorting_events', operation: 'update', payload: { id: editing.id, ...payload } })
        const updatedQtys = quantities.filter(q => q.quantity > 0).map(q => ({ ...q, sorting_event_id: editing.id }))
        const updatedEvent: SortingEvent = { ...editing, ...payload, sorting_quantities: updatedQtys }
        await upsertCachedRow('cached_sorting_events', updatedEvent as unknown as Record<string, unknown>)
        setEvents(prev => prev.map(e => e.id === editing.id ? updatedEvent : e))
        toast.info('עדכון נשמר מקומית — יסונכרן כשיחזור החיבור')
      } else {
        // New event offline: use temp ID
        const tempId = -Date.now()
        const filteredQtys = quantities.filter(q => q.quantity > 0)
        const newEvent: SortingEvent = {
          ...payload,
          id: tempId,
          sort_serial: nextSerial ?? computeNextSerial(),
          sorting_quantities: filteredQtys.map(q => ({ ...q, sorting_event_id: tempId, id: -(Date.now() + Math.random()) })),
        } as unknown as SortingEvent
        await queueAction({
          table: 'sorting_events',
          operation: 'insert',
          payload: { ...payload, _tempId: tempId, items: filteredQtys },
        })
        await upsertCachedRow('cached_sorting_events', newEvent as unknown as Record<string, unknown>)
        setEvents(prev => [newEvent, ...prev])
        toast.info('מיון נשמר מקומית — יסונכרן כשיחזור החיבור')
      }
      setDialogOpen(false)
      setEditing(undefined)
      return
    }

    // ── ONLINE PATH ───────────────────────────────────────────────────────────
    let eventId: number

    if (editing && editing.id !== 0) {
      eventId = editing.id
      const { error } = await supabase.from('sorting_events').update(payload).eq('id', eventId)
      if (error) { toast.error('שגיאה בעדכון: ' + error.message); return }
      await supabase.from('sorting_quantities').delete().eq('sorting_event_id', eventId)
      const rows = quantities.filter(q => q.quantity > 0).map(q => ({ ...q, sorting_event_id: eventId }))
      if (rows.length) await supabase.from('sorting_quantities').insert(rows)
      await updateInventory(editing.length_type, editing.freshness_type, editing.sorting_quantities ?? [], quantities, data.length_type, data.freshness_type)
      toast.success('מיון עודכן בהצלחה')
    } else {
      const { data: inserted, error } = await supabase.from('sorting_events').insert(payload).select().single()
      if (error || !inserted) { toast.error('שגיאה בשמירה: ' + error?.message); return }
      eventId = inserted.id
      const rows = quantities.filter(q => q.quantity > 0).map(q => ({ ...q, sorting_event_id: eventId }))
      if (rows.length) await supabase.from('sorting_quantities').insert(rows)
      for (const q of quantities) {
        if (q.quantity > 0) await upsertInventory(q.grade, data.length_type, data.freshness_type, q.quantity)
      }
      await supabase.from('inventory_movements').insert({
        season: activeSeason,
        movement_type: 'מיון',
        length_type: data.length_type,
        freshness_type: data.freshness_type,
        quantity: quantities.reduce((s, q) => s + q.quantity, 0),
        reference_id: eventId,
        reference_type: 'sorting_event',
      })
      toast.success('מיון נשמר ומלאי עודכן')

      // offer to create a receiving order if none exists for this warehouse_code
      const wc = data.warehouse_code
      if (wc) {
        const hasLinked = receivingOrders.some(o => o.warehouse_code === wc)
        if (!hasLinked) {
          const totalSorted = quantities.reduce((s, q) => s + q.quantity, 0)
          setPendingKabalaPrompt({
            field_id: data.field_id,
            supplier_id: data.supplier_id,
            freshness_type: data.freshness_type,
            length_type: data.length_type,
            warehouse_code: wc,
            total_quantity: totalSorted,
          })
        }
      }
    }

    setDialogOpen(false)
    setEditing(undefined)
    fetchAll()
  }

  async function upsertInventory(grade: string, length: string, freshness: string, delta: number) {
    const { data: existing } = await supabase
      .from('inventory').select('id, quantity')
      .eq('season', activeSeason).eq('grade', grade)
      .eq('length_type', length).eq('freshness_type', freshness)
      .maybeSingle()
    if (existing) {
      await supabase.from('inventory')
        .update({ quantity: existing.quantity + delta, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase.from('inventory').insert({ season: activeSeason, grade, length_type: length, freshness_type: freshness, quantity: delta })
    }
  }

  async function updateInventory(
    oldLength: string, oldFreshness: string,
    oldQtys: Array<{ grade: string; quantity: number }>,
    newQtys: Array<{ grade: string; quantity: number }>,
    newLength: string, newFreshness: string
  ) {
    for (const oq of oldQtys) if (oq.quantity > 0) await upsertInventory(oq.grade, oldLength, oldFreshness, -oq.quantity)
    for (const nq of newQtys) if (nq.quantity > 0) await upsertInventory(nq.grade, newLength, newFreshness, nq.quantity)
  }

  async function handleDelete(event: SortingEvent) {
    if (!confirm(`למחוק מיון מס׳ ${event.sort_serial}?`)) return

    // Optimistic remove from local state + cache immediately
    setEvents(prev => prev.filter(e => e.id !== event.id))
    await removeCachedRow('cached_sorting_events', event.id)

    if (!navigator.onLine) {
      await queueAction({ table: 'sorting_events', operation: 'delete', payload: { id: event.id } })
      toast.info('מחיקה נשמרה מקומית — תסונכרן כשיחזור החיבור')
      return
    }

    for (const q of event.sorting_quantities ?? []) {
      if (q.quantity > 0) await upsertInventory(q.grade, event.length_type, event.freshness_type, -q.quantity)
    }
    await supabase.from('sorting_events').delete().eq('id', event.id)
    toast.success('מיון נמחק')
    fetchAll()
  }

  async function handleFieldAdded(name: string, supplierId?: number): Promise<Field | null> {
    const { data, error } = await supabase
      .from('fields')
      .insert({ name, supplier_id: supplierId ?? null })
      .select()
      .single()
    if (error || !data) { toast.error('שגיאה בהוספת חלקה: ' + error?.message); return null }
    setFields(prev => [...prev, data as Field].sort((a, b) => a.name.localeCompare(b.name, 'he')))
    toast.success(`חלקה "${name}" נוספה`)
    return data as Field
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`למחוק ${selectedIds.size} מיונים? פעולה זו תחזיר את הכמויות למלאי.`)) return
    const toDelete = events.filter(e => selectedIds.has(e.id))
    for (const event of toDelete) {
      for (const q of event.sorting_quantities ?? []) {
        if (q.quantity > 0) await upsertInventory(q.grade, event.length_type, event.freshness_type, -q.quantity)
      }
      await supabase.from('sorting_events').delete().eq('id', event.id)
    }
    toast.success(`${selectedIds.size} מיונים נמחקו`)
    setSelectedIds(new Set())
    fetchAll()
  }

  function toggleSelectId(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) } return n })
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (filterLength    !== 'all' && e.length_type    !== filterLength)    return false
      if (filterFreshness !== 'all' && e.freshness_type !== filterFreshness) return false
      if (filterSupplier  !== 'all' && String(e.supplier_id) !== filterSupplier) return false
      if (globalFilter) {
        const q  = globalFilter.toLowerCase()
        const fn = fields.find(f => f.id === e.field_id)?.name ?? e.field_name ?? ''
        const sn = suppliers.find(s => s.id === e.supplier_id)?.name ?? ''
        if (!String(e.sort_serial).includes(q) && !fn.toLowerCase().includes(q) && !sn.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [events, filterLength, filterFreshness, filterSupplier, globalFilter, fields, suppliers])

  const totalPages  = Math.ceil(filteredEvents.length / PAGE_SIZE)
  const pagedEvents = filteredEvents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const allQtys  = filteredEvents.flatMap(e => e.sorting_quantities ?? [])
  const sumTop   = sumGroup(allQtys, GRADE_GROUP_TOP)
  const sumMid   = sumGroup(allQtys, GRADE_GROUP_MID)
  const sumLower = sumGroup(allQtys, GRADE_GROUP_LOWER)

  // sortings that have a warehouse_code but no matching receiving order
  const missingSortings = useMemo(() =>
    events.filter(e =>
      e.warehouse_code &&
      !receivingOrders.some(o => o.warehouse_code === e.warehouse_code)
    ),
  [events, receivingOrders])

  async function handleAddKabala(event: SortingEvent) {
    const { data: lastOrd } = await supabase
      .from('receiving_orders')
      .select('serial_no')
      .order('serial_no', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSerial = lastOrd ? String(parseInt(lastOrd.serial_no, 10) + 1) : '9001'
    const total = (event.sorting_quantities ?? []).reduce((s, q) => s + q.quantity, 0)
    const { error } = await supabase.from('receiving_orders').insert({
      season:           activeSeason,
      serial_no:        nextSerial,
      received_date:    event.sorted_date,
      supplier_id:      event.supplier_id ?? null,
      field_id:         event.field_id    ?? null,
      freshness_type:   event.freshness_type,
      length_type:      event.length_type,
      warehouse_code:   event.warehouse_code,
      total_quantity:   total,
      returns_quantity: 0,
      category:         'לולבים למיון',
      status:           'pending',
    })
    if (error) { toast.error('שגיאה ביצירת קבלה: ' + error.message); return }
    toast.success(`קבלה ${nextSerial} נוצרה`)
    fetchAll()
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">מיונים</h1>
            {isFromCache && (
              <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                נתונים שמורים
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">עונה: {activeSeason}</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700" onClick={openNew}>
          <Plus className="h-4 w-4 ml-1" /> מיון חדש
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'list' | 'table' | 'pivot' | 'missing')}>
        <TabsList className="mb-2">
          <TabsTrigger value="list">כרטיסי מיון</TabsTrigger>
          <TabsTrigger value="table">טבלה</TabsTrigger>
          <TabsTrigger value="pivot">טבלת ציר</TabsTrigger>
          <TabsTrigger value="missing" className="gap-1">
            שיוכים חסרים
            {missingSortings.length > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0 leading-4">
                {missingSortings.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── LIST TAB ── */}
        <TabsContent value="list" className="space-y-3 mt-0">

          {!loading && (sumTop + sumMid + sumLower) > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-3 pb-2 px-3">
                  <p className="text-[10px] text-green-600 font-medium">לבן + ירוק + כסף</p>
                  <p className="text-xl font-bold text-green-700">{sumTop.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-3 pb-2 px-3">
                  <p className="text-[10px] text-orange-600 font-medium">כסף2 + כתום</p>
                  <p className="text-xl font-bold text-orange-700">{sumMid.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="border-gray-200 bg-gray-50">
                <CardContent className="pt-3 pb-2 px-3">
                  <p className="text-[10px] text-gray-500 font-medium">כשר + שחור</p>
                  <p className="text-xl font-bold text-gray-700">{sumLower.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder="חיפוש..." value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} className="w-36 h-8 text-sm" />
            <Select value={filterSupplier} onValueChange={v => setFilterSupplier(v ?? 'all')}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <span className="truncate">
                  {filterSupplier === 'all' ? 'כל הספקים' : (suppliers.find(s => String(s.id) === filterSupplier)?.name ?? 'כל הספקים')}
                </span>
              </SelectTrigger>
              <SelectContent className="bg-white text-gray-900">
                <SelectItem value="all">כל הספקים</SelectItem>
                {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterLength} onValueChange={v => setFilterLength(v ?? 'all')}>
              <SelectTrigger className="w-28 h-8 text-sm">
                <span>{filterLength === 'all' ? 'כל האורכים' : filterLength}</span>
              </SelectTrigger>
              <SelectContent className="bg-white text-gray-900">
                <SelectItem value="all">כל האורכים</SelectItem>
                {LENGTH_TYPES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterFreshness} onValueChange={v => setFilterFreshness(v ?? 'all')}>
              <SelectTrigger className="w-28 h-8 text-sm">
                <span>{filterFreshness === 'all' ? 'מוקדם + טרי' : filterFreshness}</span>
              </SelectTrigger>
              <SelectContent className="bg-white text-gray-900">
                <SelectItem value="all">מוקדם + טרי</SelectItem>
                {FRESHNESS_TYPES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filterSupplier !== 'all' || filterLength !== 'all' || filterFreshness !== 'all' || globalFilter) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-400"
                onClick={() => { setFilterSupplier('all'); setFilterLength('all'); setFilterFreshness('all'); setGlobalFilter('') }}>
                נקה
              </Button>
            )}
            <div className="mr-auto flex items-center gap-2">
              <button
                className={cn(
                  'flex items-center gap-1.5 text-xs px-2.5 h-8 rounded-lg border transition-colors',
                  selectionMode
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
                )}
                onClick={() => { setSelectionMode(v => !v); setSelectedIds(new Set()) }}
              >
                <Pencil className="h-3 w-3" />
                {selectionMode ? 'יציאה' : 'בחר'}
              </button>
              {selectionMode && selectedIds.size > 0 && (
                <>
                  <span className="text-xs text-blue-700 font-medium">{selectedIds.size} נבחרו</span>
                  <Button size="sm" className="h-8 text-xs bg-red-500 hover:bg-red-600 text-white border-0" onClick={handleBulkDelete}>מחק</Button>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : pagedEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm border rounded-lg bg-white">
              {filteredEvents.length === 0 && !globalFilter && filterSupplier === 'all' && filterLength === 'all' && filterFreshness === 'all'
                ? `אין מיונים בעונה ${activeSeason} — לחץ על "מיון חדש"`
                : 'לא נמצאו תוצאות לפילטרים הנבחרים'}
            </div>
          ) : (
            <div className="space-y-2">
              {pagedEvents.map(event => (
                <SortingCard
                  key={event.id}
                  event={event}
                  suppliers={suppliers}
                  fields={fields}
                  expanded={expandedIds.has(event.id)}
                  selected={selectedIds.has(event.id)}
                  selectionMode={selectionMode}
                  onToggle={() => setExpandedIds(prev => {
                    const next = new Set(prev); if (next.has(event.id)) { next.delete(event.id) } else { next.add(event.id) } return next
                  })}
                  onSelect={() => toggleSelectId(event.id)}
                  onEdit={() => { setEditing(event); setDialogOpen(true) }}
                  onDuplicate={() => openDuplicate(event)}
                  onDelete={() => handleDelete(event)}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-500">{filteredEvents.length} תוצאות · עמוד {page + 1} מתוך {totalPages}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>הקודם</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>הבא</Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TABLE TAB ── */}
        <TabsContent value="table" className="mt-0">
          <SortingTable
            events={filteredEvents}
            suppliers={suppliers}
            fields={fields}
            receivingOrders={receivingOrders}
            grades={gradesList}
          />
        </TabsContent>

        {/* ── PIVOT TAB ── */}
        <TabsContent value="pivot" className="mt-0">
          <PivotView events={filteredEvents} fields={fields} />
        </TabsContent>

        {/* ── MISSING LINKS TAB ── */}
        <TabsContent value="missing" className="mt-0 space-y-2">
          {missingSortings.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 border rounded-lg bg-white">
              כל המיונים משויכים לקבלת סחורה
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400">{missingSortings.length} מיונים ללא קבלת סחורה תואמת</p>
              {missingSortings.map(event => {
                const fieldName    = fields.find(f => f.id === event.field_id)?.name ?? event.field_name ?? '—'
                const supplierName = suppliers.find(s => s.id === event.supplier_id)?.name ?? '—'
                const total        = (event.sorting_quantities ?? []).reduce((s, q) => s + q.quantity, 0)
                const dateStr      = event.sorted_date
                  ? new Date(event.sorted_date + 'T00:00:00').toLocaleDateString('he-IL')
                  : '—'
                return (
                  <div key={event.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-white" dir="rtl">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-gray-900">#{event.sort_serial}</span>
                        <span className="font-medium text-sm truncate">{fieldName}</span>
                        <span className="text-xs text-gray-400">{event.freshness_type} · {event.length_type}</span>
                        <span className="text-[10px] text-gray-300 bg-gray-100 px-1.5 rounded font-mono">מח׳ {event.warehouse_code}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>{dateStr}</span>
                        <span className="text-gray-300">·</span>
                        <span>{supplierName}</span>
                        <span className="text-gray-300">·</span>
                        <span className="font-medium text-gray-700">{total.toLocaleString()} יח׳</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="flex-shrink-0 h-7 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => handleAddKabala(event)}
                    >
                      הוסף קבלה
                    </Button>
                  </div>
                )
              })}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Kabala prompt dialog */}
      <Dialog open={!!pendingKabalaPrompt} onOpenChange={open => { if (!open) setPendingKabalaPrompt(null) }}>
        <DialogContent className="max-w-sm bg-white text-gray-900" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base">מיון נשמר בהצלחה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-gray-600">
              לא נמצאה קבלת סחורה עם קוד מחסן{' '}
              <span className="font-mono font-bold text-gray-900">{pendingKabalaPrompt?.warehouse_code}</span>.
              <br />האם להוסיף קבלה תואמת עכשיו?
            </p>
            <div className="flex gap-2">
              <Button
                className="bg-green-600 hover:bg-green-700 flex-1"
                onClick={() => {
                  if (!pendingKabalaPrompt) return
                  const p = pendingKabalaPrompt
                  const params = new URLSearchParams({ new: '1', warehouse_code: p.warehouse_code, qty: String(p.total_quantity) })
                  if (p.field_id)    params.set('field_id',    String(p.field_id))
                  if (p.supplier_id) params.set('supplier_id', String(p.supplier_id))
                  if (p.freshness_type) params.set('freshness_type', p.freshness_type)
                  if (p.length_type)    params.set('length_type',    p.length_type)
                  setPendingKabalaPrompt(null)
                  router.push('/kabala?' + params.toString())
                }}
              >
                הוסף קבלה
              </Button>
              <Button variant="outline" onClick={() => setPendingKabalaPrompt(null)}>דלג</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditing(undefined); setNextSerial(undefined) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-gray-900" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editing && editing.id !== 0 ? `עריכת מיון #${editing.sort_serial}` : `מיון חדש — עונה ${activeSeason}`}
            </DialogTitle>
          </DialogHeader>
          <SortingForm
            key={editing && editing.id !== 0 ? `edit-${editing.id}` : `new-${nextSerial}`}
            event={editing && editing.id !== 0 ? editing : undefined}
            suppliers={suppliers}
            fields={fields}
            receivingOrders={receivingOrders}
            usedWarehouseCodes={events.map(e => e.warehouse_code).filter((c): c is string => !!c)}
            suggestedSerial={!editing || editing.id === 0 ? nextSerial : undefined}
            grades={gradesList.length > 0 ? gradesList : undefined}
            onSubmit={handleSubmit}
            onFieldAdded={handleFieldAdded}
            onCancel={() => { setDialogOpen(false); setEditing(undefined); setNextSerial(undefined) }}
          />
        </DialogContent>
      </Dialog>

      {/* WhatsApp share dialog */}
      <WhatsAppShareDialog
        open={waShareOpen}
        onClose={() => setWaShareOpen(false)}
        events={events}
        suppliers={suppliers}
        fields={fields}
        grades={gradesList}
      />

      {/* WhatsApp FAB */}
      <button
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        style={{ background: '#25D366' }}
        onClick={() => setWaShareOpen(true)}
        title="שליחת מיון בוואטסאפ"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>
    </div>
  )
}
