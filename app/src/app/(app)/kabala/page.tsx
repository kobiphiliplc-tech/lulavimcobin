'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/lib/context/SeasonContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, CheckCircle2, X } from 'lucide-react'
import type { ReceivingOrder, Supplier, Field, FieldForecast, FreshnessType } from '@/lib/types'
import { LENGTH_TYPES } from '@/lib/constants'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dedupeByName<T extends { name: string }>(arr: T[]): T[] {
  const seen = new Set<string>()
  return arr.filter(x => !seen.has(x.name) && seen.add(x.name))
}

const selectCls = "w-full rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm h-8 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 disabled:opacity-50"

// NaN (from empty number inputs with valueAsNumber:true) → undefined/default
function nanToUndef(v: unknown) {
  return typeof v === 'number' && isNaN(v) ? undefined : v
}
function nanToZero(v: unknown) {
  return typeof v === 'number' && isNaN(v) ? 0 : v
}

const schema = z.object({
  order_type:       z.string().default('לולבים למיון'),
  serial_no:        z.string().min(1, 'חובה'),
  received_date:    z.string().min(1, 'חובה'),
  supplier_id:      z.number().optional(),
  field_id:         z.number().optional(),
  field_plot:       z.string().optional(),
  length_type:      z.enum(['ארוך', 'רגיל', 'קצר']).default('רגיל'),
  harvest_date:     z.string().optional(),
  total_quantity:   z.preprocess(nanToUndef, z.number().optional()),
  returns_quantity: z.preprocess(nanToZero, z.number().default(0)),
  category:         z.string().default('לולבים למיון'),
  price_per_unit:   z.preprocess(nanToUndef, z.number().optional()),
  order_currency:   z.string().default('ILS'),
  vat_included:     z.boolean().default(false),
  notes:            z.string().optional(),
  pallet_count:     z.preprocess(nanToUndef, z.number().optional()),
})
type FormData = z.infer<typeof schema>

type SortingEventSummary = {
  id: number
  receiving_serial: string | null
  warehouse_code: string | null
  sorting_quantities: { quantity: number }[] | null
}

// ─── ForecastView ────────────────────────────────────────────────────────────

function ForecastView({
  fields, suppliers, orders, forecasts, onSaveForecast,
}: {
  fields: Field[]
  suppliers: Supplier[]
  orders: ReceivingOrder[]
  forecasts: FieldForecast[]
  onSaveForecast: (fieldId: number, earlyExp: number, freshExp: number) => Promise<void>
}) {
  const [localForecasts, setLocalForecasts] = useState<Record<number, { early: number; fresh: number }>>({})

  useEffect(() => {
    const map: Record<number, { early: number; fresh: number }> = {}
    forecasts.forEach(f => { map[f.field_id] = { early: f.expected_early, fresh: f.expected_fresh } })
    setLocalForecasts(map)
  }, [forecasts])

  function getReceived(fieldId: number, freshness: FreshnessType) {
    return orders
      .filter(o => o.field_id === fieldId && o.freshness_type === freshness && (o.order_type ?? 'לולבים למיון') !== 'אחר')
      .reduce((s, o) => s + Math.max(0, (o.total_quantity ?? 0) - o.returns_quantity), 0)
  }

  function updateLocal(fieldId: number, key: 'early' | 'fresh', val: number) {
    setLocalForecasts(prev => ({
      ...prev,
      [fieldId]: { ...(prev[fieldId] ?? { early: 0, fresh: 0 }), [key]: val },
    }))
  }

  async function handleBlur(fieldId: number) {
    const f = localForecasts[fieldId] ?? { early: 0, fresh: 0 }
    await onSaveForecast(fieldId, f.early, f.fresh)
  }

  const totals = useMemo(() => {
    const earlyExp  = fields.reduce((s, f) => s + (localForecasts[f.id]?.early ?? 0), 0)
    const freshExp  = fields.reduce((s, f) => s + (localForecasts[f.id]?.fresh ?? 0), 0)
    const earlyRecv = fields.reduce((s, f) => s + getReceived(f.id, 'מוקדם'), 0)
    const freshRecv = fields.reduce((s, f) => s + getReceived(f.id, 'טרי'), 0)
    const diff = (earlyExp + freshExp) - (earlyRecv + freshRecv)
    return { earlyExp, freshExp, earlyRecv, freshRecv, diff }
  }, [fields, localForecasts, orders]) // eslint-disable-line react-hooks/exhaustive-deps

  if (fields.length === 0) {
    return <p className="text-center py-12 text-gray-400">אין שדות מוגדרים במערכת</p>
  }

  return (
    <div className="rounded-lg border bg-white overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-right p-2 font-medium">חלקה</th>
            <th className="text-right p-2 font-medium">ספק</th>
            <th className="text-center p-2 font-medium">צפי מוקדם</th>
            <th className="text-center p-2 font-medium">התקבל מוקדם</th>
            <th className="text-center p-2 font-medium">צפי טרי</th>
            <th className="text-center p-2 font-medium">התקבל טרי</th>
            <th className="text-center p-2 font-medium">הפרש</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(field => {
            const supplier  = suppliers.find(s => s.id === field.supplier_id)
            const earlyExp  = localForecasts[field.id]?.early ?? 0
            const freshExp  = localForecasts[field.id]?.fresh ?? 0
            const earlyRecv = getReceived(field.id, 'מוקדם')
            const freshRecv = getReceived(field.id, 'טרי')
            const diff      = (earlyExp + freshExp) - (earlyRecv + freshRecv)
            return (
              <tr key={field.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-medium">{field.name}</td>
                <td className="p-2 text-gray-500 text-xs">{supplier?.name ?? '—'}</td>
                <td className="p-1 text-center">
                  <input
                    type="number" min="0"
                    className="w-20 text-center border rounded px-1 py-0.5 text-sm"
                    value={earlyExp}
                    onChange={e => updateLocal(field.id, 'early', Number(e.target.value) || 0)}
                    onBlur={() => handleBlur(field.id)}
                  />
                </td>
                <td className="p-2 text-center text-gray-700">{earlyRecv > 0 ? earlyRecv.toLocaleString() : '—'}</td>
                <td className="p-1 text-center">
                  <input
                    type="number" min="0"
                    className="w-20 text-center border rounded px-1 py-0.5 text-sm"
                    value={freshExp}
                    onChange={e => updateLocal(field.id, 'fresh', Number(e.target.value) || 0)}
                    onBlur={() => handleBlur(field.id)}
                  />
                </td>
                <td className="p-2 text-center text-gray-700">{freshRecv > 0 ? freshRecv.toLocaleString() : '—'}</td>
                <td className={cn('p-2 text-center font-medium',
                  diff < 0 ? 'text-red-600' : diff > 0 ? 'text-gray-500' : 'text-green-600'
                )}>
                  {diff === 0 ? '—' : diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold border-t-2">
            <td className="p-2" colSpan={2}>סה״כ</td>
            <td className="p-2 text-center">{totals.earlyExp.toLocaleString()}</td>
            <td className="p-2 text-center">{totals.earlyRecv.toLocaleString()}</td>
            <td className="p-2 text-center">{totals.freshExp.toLocaleString()}</td>
            <td className="p-2 text-center">{totals.freshRecv.toLocaleString()}</td>
            <td className={cn('p-2 text-center', totals.diff < 0 ? 'text-red-600' : 'text-gray-600')}>
              {totals.diff === 0 ? '—' : totals.diff > 0 ? `+${totals.diff.toLocaleString()}` : totals.diff.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function KabalaPage() {
  const supabase = createClient()
  const { activeSeason } = useSeason()

  const [orders,         setOrders]         = useState<ReceivingOrder[]>([])
  const [suppliers,      setSuppliers]      = useState<Supplier[]>([])
  const [fields,         setFields]         = useState<Field[]>([])
  const [sortingEvents,  setSortingEvents]  = useState<SortingEventSummary[]>([])
  const [forecasts,      setForecasts]      = useState<FieldForecast[]>([])
  const [vatRate,        setVatRate]        = useState(18)
  const [freshnessDate,  setFreshnessDate]  = useState<string | null>(null)
  const [suggestedSerial,setSuggestedSerial]= useState<number>(9001)
  const [loading,        setLoading]        = useState(true)
  const [globalFilter,   setGlobalFilter]   = useState('')
  const [sorting,        setSorting]        = useState<SortingState>([{ id: 'received_date', desc: true }])
  const [dialogOpen,     setDialogOpen]     = useState(false)
  const [editing,        setEditing]        = useState<ReceivingOrder | undefined>()
  const [activeTab,      setActiveTab]      = useState<'list' | 'forecast'>('list')
  const [deleteConfirm,  setDeleteConfirm]  = useState<ReceivingOrder | null>(null)

  // inline add supplier
  const [addingSupplier,     setAddingSupplier]     = useState(false)
  const [newSupplierName,    setNewSupplierName]    = useState('')
  const [addingSupplierBusy, setAddingSupplierBusy] = useState(false)

  // inline add field
  const [addingField,     setAddingField]     = useState(false)
  const [newFieldName,    setNewFieldName]    = useState('')
  const [addingFieldBusy, setAddingFieldBusy] = useState(false)

  const { register, handleSubmit, control, reset, watch, setValue,
    formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      order_type: 'לולבים למיון', length_type: 'רגיל',
      returns_quantity: 0, vat_included: false, category: 'לולבים למיון',
    },
  })

  // Reactive watches
  const orderType        = watch('order_type')
  const harvestDate      = watch('harvest_date')
  const pricePerUnit     = Number(watch('price_per_unit') ?? 0)
  const orderCurrency    = watch('order_currency') ?? 'ILS'
  const vatIncluded      = watch('vat_included')
  const totalQty         = Number(watch('total_quantity') ?? 0)
  const returnsQty       = Number(watch('returns_quantity') ?? 0)
  const netQty           = Math.max(0, totalQty - returnsQty)
  const isLulav          = orderType !== 'אחר'
  const isILS            = orderCurrency === 'ILS'
  const currencySymbol   = ({ ILS: '₪', USD: '$', EUR: '€', GBP: '£' } as Record<string, string>)[orderCurrency] ?? orderCurrency

  // Auto-computed freshness
  const computedFreshness: FreshnessType = useMemo(() => {
    if (!harvestDate || !freshnessDate) return 'טרי'
    return harvestDate >= freshnessDate ? 'טרי' : 'מוקדם'
  }, [harvestDate, freshnessDate])

  const filteredFields = fields


  // VAT calculations
  const priceExVat  = vatIncluded ? pricePerUnit / (1 + vatRate / 100) : pricePerUnit
  const priceIncVat = vatIncluded ? pricePerUnit : pricePerUnit * (1 + vatRate / 100)
  const totalExVat  = priceExVat  * netQty
  const totalIncVat = priceIncVat * netQty
  const vatAmount   = totalIncVat - totalExVat

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [ordRes, supRes, fldRes, evRes, fcRes, stRes] = await Promise.all([
      supabase.from('receiving_orders')
        .select('*, suppliers(name), fields(name)')
        .eq('season', activeSeason)
        .order('received_date', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('fields').select('*').order('name'),
      supabase.from('sorting_events')
        .select('id, receiving_serial, warehouse_code, sorting_quantities(quantity)')
        .eq('season', activeSeason),
      supabase.from('field_forecasts').select('*').eq('season', activeSeason),
      supabase.from('settings').select('key, value')
        .in('key', [`vat_rate_${activeSeason}`, `freshness_date_${activeSeason}`]),
    ])

    const ords = (ordRes.data ?? []) as ReceivingOrder[]
    setOrders(ords)
    if (supRes.data)  setSuppliers(dedupeByName(supRes.data))
    if (fldRes.data)  setFields(dedupeByName(fldRes.data))
    if (!evRes.error) setSortingEvents(evRes.data as SortingEventSummary[])
    if (!fcRes.error) setForecasts(fcRes.data as FieldForecast[])

    stRes.data?.forEach(row => {
      if (row.key === `vat_rate_${activeSeason}`)      setVatRate(Number(row.value) || 18)
      if (row.key === `freshness_date_${activeSeason}`) setFreshnessDate(row.value)
    })

    const maxSerial = ords.reduce((max, o) => {
      const n = parseInt(o.serial_no, 10)
      return isNaN(n) ? max : Math.max(max, n)
    }, 0)
    setSuggestedSerial(maxSerial + 1)
    setLoading(false)
  }, [supabase, activeSeason])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Pre-fill from URL params (e.g. coming from miuinim "הוסף קבלה" prompt)
  useEffect(() => {
    if (loading) return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('new') !== '1') return
    setEditing(undefined)
    reset({
      order_type: 'לולבים למיון',
      length_type: (sp.get('length_type') as 'ארוך' | 'רגיל' | 'קצר' | null) ?? 'רגיל',
      returns_quantity: 0,
      vat_included: false,
      category: 'לולבים למיון',
      received_date: todayISO(),
      serial_no: sp.get('warehouse_code') ?? String(suggestedSerial),
      field_id:       sp.get('field_id')    ? Number(sp.get('field_id'))    : undefined,
      supplier_id:    sp.get('supplier_id') ? Number(sp.get('supplier_id')) : undefined,
      total_quantity: sp.get('qty')         ? Number(sp.get('qty'))         : undefined,
    })
    setDialogOpen(true)
    // Remove params from URL without reload so refreshing doesn't re-open the dialog
    window.history.replaceState({}, '', window.location.pathname)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  async function handleAddSupplier() {
    const name = newSupplierName.trim()
    if (!name) return
    setAddingSupplierBusy(true)
    const { data, error } = await supabase
      .from('suppliers')
      .upsert({ name }, { onConflict: 'name', ignoreDuplicates: false })
      .select()
      .single()
    setAddingSupplierBusy(false)
    if (error || !data) { toast.error('שגיאה בהוספת ספק: ' + error?.message); return }
    const supplier = data as Supplier
    setSuppliers(prev => {
      if (prev.some(s => s.id === supplier.id)) return prev
      return [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name, 'he'))
    })
    setValue('supplier_id', supplier.id)
    setAddingSupplier(false)
    setNewSupplierName('')
    toast.success(`ספק "${name}" נוסף`)
  }

  async function handleAddField() {
    const name = newFieldName.trim()
    if (!name) return
    setAddingFieldBusy(true)
    const supplierId = watch('supplier_id')
    const { data, error } = await supabase.from('fields').insert({ name, supplier_id: supplierId ?? null }).select().single()
    setAddingFieldBusy(false)
    if (error || !data) { toast.error('שגיאה בהוספת חלקה: ' + error?.message); return }
    const newField = data as Field
    setFields(prev => [...prev, newField].sort((a, b) => a.name.localeCompare(b.name, 'he')))
    setValue('field_id', newField.id)
    setAddingField(false)
    setNewFieldName('')
    toast.success(`חלקה "${name}" נוספה`)
  }

  function getSortingStatus(order: ReceivingOrder, net: number) {
    const matched = sortingEvents.filter(e =>
      e.warehouse_code === order.serial_no || e.receiving_serial === order.serial_no
    )
    const sortedTotal = matched.reduce((s, e) => s + (e.sorting_quantities ?? []).reduce((a, q) => a + q.quantity, 0), 0)
    if (matched.length === 0) return { label: 'לא מויין', cls: 'bg-gray-100 text-gray-600' }
    if (order.status === 'sorted' || (net > 0 && sortedTotal >= net)) {
      return { label: `מויין מלא — ${sortedTotal.toLocaleString()}`, cls: 'bg-green-100 text-green-800' }
    }
    return { label: `מויין חלקי — ${sortedTotal.toLocaleString()}/${net.toLocaleString()}`, cls: 'bg-yellow-100 text-yellow-800' }
  }

  function openNew() {
    setEditing(undefined)
    reset({
      order_type: 'לולבים למיון', length_type: 'רגיל', returns_quantity: 0,
      vat_included: false, category: 'לולבים למיון',
      received_date: todayISO(),
      serial_no: String(suggestedSerial),
    })
    setDialogOpen(true)
  }

  function openEdit(order: ReceivingOrder) {
    setEditing(order)
    reset({
      order_type:       order.order_type ?? 'לולבים למיון',
      serial_no:        order.serial_no ?? '',
      received_date:    order.received_date ?? '',
      supplier_id:      order.supplier_id ?? undefined,
      field_id:         order.field_id ?? undefined,
      field_plot:       order.field_plot ?? '',
      length_type:      (['ארוך','רגיל','קצר'].includes(order.length_type) ? order.length_type : 'רגיל') as 'ארוך'|'רגיל'|'קצר',
      harvest_date:     order.harvest_date ?? '',
      total_quantity:   order.total_quantity ?? undefined,
      returns_quantity: order.returns_quantity ?? 0,
      category:         order.category ?? 'לולבים למיון',
      price_per_unit:   order.price_per_unit ?? undefined,
      order_currency:   order.order_currency ?? 'ILS',
      vat_included:     false,
      notes:            order.notes ?? '',
      pallet_count:     order.pallet_count ?? undefined,
    })
    setDialogOpen(true)
  }

  async function onSubmit(data: FormData) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { vat_included: _vat, ...dbData } = data
    const freshness_type: FreshnessType = (dbData.harvest_date && freshnessDate)
      ? (dbData.harvest_date >= freshnessDate ? 'טרי' : 'מוקדם')
      : 'טרי'
    const net = Math.max(0, (dbData.total_quantity ?? 0) - (dbData.returns_quantity ?? 0))
    const currency = dbData.order_currency ?? 'ILS'
    const total_price = currency === 'ILS'
      ? (priceIncVat * net || null)
      : ((dbData.price_per_unit ?? 0) * net || null)
    const payload = { ...dbData, freshness_type, total_price, order_currency: currency,
      supplier_id: dbData.supplier_id ?? null,
      field_id:    dbData.field_id    ?? null,
    }

    const trySave = async (p: typeof payload) => editing
      ? supabase.from('receiving_orders').update(p).eq('id', editing.id)
      : supabase.from('receiving_orders').insert({ ...p, season: activeSeason })

    let { error } = await trySave(payload)
    // Retry: progressively strip new columns that may not exist yet in the DB
    if (error?.message) {
      const newCols = ['order_currency', 'order_type'] as const
      const stripped = { ...payload } as Record<string, unknown>
      for (let i = 0; i < newCols.length && error?.message; i++) {
        delete stripped[newCols[i]]
        ;({ error } = await trySave(stripped as typeof payload))
      }
    }
    if (error) { toast.error((editing ? 'שגיאה בעדכון: ' : 'שגיאה בשמירה: ') + error.message); return }
    toast.success(editing ? 'קבלה עודכנה' : 'קבלה נשמרה')
    setDialogOpen(false)
    fetchAll()
  }

  async function handleDelete(order: ReceivingOrder) {
    setDeleteConfirm(order)
  }

  async function doDelete(order: ReceivingOrder) {
    setDeleteConfirm(null)
    const { error } = await supabase.from('receiving_orders').delete().eq('id', order.id)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    toast.success('קבלה נמחקה')
    fetchAll()
  }

  async function markAsSorted(orderId: number) {
    const { error } = await supabase.from('receiving_orders').update({ status: 'sorted' }).eq('id', orderId)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    toast.success('סומן כמויין מלא')
    setDialogOpen(false)
    fetchAll()
  }

  async function saveForecast(fieldId: number, earlyExp: number, freshExp: number) {
    await supabase.from('field_forecasts').upsert(
      { field_id: fieldId, season: activeSeason, expected_early: earlyExp, expected_fresh: freshExp },
      { onConflict: 'field_id,season' }
    )
  }

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columns: ColumnDef<ReceivingOrder>[] = [
    {
      accessorKey: 'serial_no', header: 'מס׳ קבלה',
      cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'warehouse_code', header: 'מח׳',
      cell: ({ getValue }) => {
        const v = getValue<string | null>()
        return v ? <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{v}</span> : <span className="text-gray-300">—</span>
      },
    },
    {
      accessorKey: 'received_date', header: 'תאריך',
      cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString('he-IL'),
    },
    {
      accessorKey: 'suppliers.name', header: 'ספק',
      cell: ({ row }) => {
        const sid = row.original.supplier_id
        const name = row.original.suppliers?.name
        if (!name) return '—'
        return <Link href={`/suppliers?id=${sid}`} className="text-green-700 hover:underline">{name}</Link>
      },
    },
    { accessorKey: 'fields.name',    header: 'שדה',   cell: ({ row }) => row.original.fields?.name ?? '—' },
    { accessorKey: 'length_type',    header: 'אורך' },
    { accessorKey: 'freshness_type', header: 'טריות' },
    { accessorKey: 'total_quantity', header: 'כמות',  cell: ({ getValue }) => getValue<number>()?.toLocaleString() ?? '—' },
    { accessorKey: 'returns_quantity', header: 'חזרות', cell: ({ getValue }) => (getValue<number>() || 0).toLocaleString() },
    {
      id: 'net_qty', header: 'סה״כ',
      cell: ({ row }) => {
        const net = Math.max(0, (row.original.total_quantity ?? 0) - row.original.returns_quantity)
        return <span className="font-medium">{net.toLocaleString()}</span>
      },
    },
    {
      accessorKey: 'category', header: 'קטגוריה',
      cell: ({ getValue }) => <span className="text-xs">{getValue<string>() ?? '—'}</span>,
    },
    {
      id: 'sorting_status', header: 'סטטוס מיון',
      cell: ({ row }) => {
        const net = Math.max(0, (row.original.total_quantity ?? 0) - row.original.returns_quantity)
        const st  = getSortingStatus(row.original, net)
        return <span className={cn('text-xs px-2 py-0.5 rounded-full whitespace-nowrap', st.cls)}>{st.label}</span>
      },
    },
    {
      id: 'total_price_vat', header: 'סה״כ מחיר',
      cell: ({ row }) => {
        const tp   = row.original.total_price
        const curr = row.original.order_currency ?? 'ILS'
        const sym  = ({ ILS: '₪', USD: '$', EUR: '€', GBP: '£' } as Record<string, string>)[curr] ?? curr
        return tp ? `${sym}${tp.toLocaleString('he-IL', { maximumFractionDigits: 0 })}` : '—'
      },
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(row.original)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: orders, columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // Sorting status for the editing order (shown in form)
  const editingNetQty = editing ? Math.max(0, (editing.total_quantity ?? 0) - editing.returns_quantity) : 0
  const editingSortingStatus = editing ? getSortingStatus(editing, editingNetQty) : null

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">קבלת סחורה</h1>
          <p className="text-xs text-gray-400 mt-0.5">עונה: {activeSeason}</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700" onClick={openNew}>
          <Plus className="h-4 w-4 ml-1" /> קבלה חדשה
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'list' | 'forecast')}>
        <TabsList>
          <TabsTrigger value="list">קבלות</TabsTrigger>
          <TabsTrigger value="forecast">צפי לפי חלקה</TabsTrigger>
        </TabsList>

        {/* ── List Tab ── */}
        <TabsContent value="list">
          <div className="space-y-4">
            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'pending',  label: 'ממתין למיון', bg: 'bg-yellow-50 border-yellow-200' },
                { key: 'sorted',   label: 'מויין',       bg: 'bg-green-50  border-green-200'  },
                { key: 'partial',  label: 'חלקי',        bg: 'bg-blue-50   border-blue-200'   },
                { key: 'returned', label: 'הוחזר',       bg: 'bg-red-50    border-red-200'    },
              ].map(({ key, label, bg }) => (
                <Card key={key} className={cn('text-center py-3 border', bg)}>
                  <CardContent className="p-0">
                    <p className="text-2xl font-bold">{orders.filter(o => o.status === key).length}</p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Input
              placeholder="חיפוש לפי מס׳ קבלה, ספק, שדה..."
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />

            <div className="rounded-lg border bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map(hg => (
                    <TableRow key={hg.id}>
                      {hg.headers.map(h => (
                        <TableHead key={h.id} className="text-right cursor-pointer whitespace-nowrap"
                          onClick={h.column.getToggleSortingHandler()}>
                          <span className="flex items-center gap-1">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {h.column.getIsSorted() === 'asc'  && <ChevronUp   className="h-3 w-3" />}
                            {h.column.getIsSorted() === 'desc' && <ChevronDown className="h-3 w-3" />}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {columns.map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                      </TableRow>
                    ))
                  ) : table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="text-center py-12 text-gray-400">
                        {globalFilter ? 'לא נמצאו תוצאות' : `אין קבלות בעונה ${activeSeason} — לחץ על "קבלה חדשה"`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map(row => {
                      const o = row.original
                      const isMissingData = !o.field_id || !o.total_price || o.total_price === 0
                      return (
                        <TableRow key={row.id} className={cn('hover:bg-gray-50', isMissingData && 'bg-yellow-50 hover:bg-yellow-100')}>
                          {row.getVisibleCells().map(cell => (
                            <TableCell key={cell.id} className="text-right py-2 whitespace-nowrap">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Forecast Tab ── */}
        <TabsContent value="forecast">
          <ForecastView
            fields={fields} suppliers={suppliers} orders={orders}
            forecasts={forecasts}
            onSaveForecast={saveForecast}
          />
        </TabsContent>
      </Tabs>

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-gray-900" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? `עריכת קבלה ${editing.serial_no}` : 'קבלה חדשה'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">

            {/* 1. סוג קבלה */}
            <div className="flex gap-4 items-center p-3 bg-gray-50 rounded-lg flex-wrap">
              <span className="text-sm font-medium text-gray-600 ml-2">סוג קבלה:</span>
              {[
                { val: 'לולבים למיון',   label: 'לולבים למיון' },
                { val: 'לולבים ממוינים', label: 'לולבים ממוינים' },
                { val: 'אחר',            label: 'אחר (ציוד)' },
              ].map(({ val, label }) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" value={val} {...register('order_type')} className="accent-green-600" />
                  {label}
                </label>
              ))}
            </div>

            {/* 2. זיהוי */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">מס׳ קבלה</Label>
                <Input {...register('serial_no')} placeholder={String(suggestedSerial)} className="h-8 text-sm" />
                {errors.serial_no && <p className="text-xs text-red-500">{errors.serial_no.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">תאריך</Label>
                <Controller control={control} name="received_date" render={({ field }) => (
                  <Input type="date" value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} className="h-8 text-sm" />
                )} />
                {errors.received_date && <p className="text-xs text-red-500">{errors.received_date.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ספק</Label>
                <Controller control={control} name="supplier_id" render={({ field }) => (
                  <select className={selectCls} value={field.value ?? ''}
                    onChange={e => {
                      if (e.target.value === '__new__') { setAddingSupplier(true); return }
                      field.onChange(e.target.value ? Number(e.target.value) : undefined)
                    }}>
                    <option value="">— בחר ספק —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    <option value="__new__">+ הוסף ספק חדש</option>
                  </select>
                )} />
              </div>
            </div>
            {/* inline add rows — full width below the grid */}
            {addingSupplier && (
              <div className="flex gap-2 mt-1 min-w-0 overflow-hidden">
                <input
                  autoFocus
                  type="text"
                  value={newSupplierName}
                  onChange={e => setNewSupplierName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSupplier() } if (e.key === 'Escape') { setAddingSupplier(false); setNewSupplierName('') } }}
                  placeholder="שם ספק חדש..."
                  className="min-w-0 flex-1 h-8 rounded-lg border border-green-400 px-2 text-sm outline-none focus:ring-2 focus:ring-green-500/20 bg-white"
                />
                <button type="button" onClick={handleAddSupplier} disabled={addingSupplierBusy || !newSupplierName.trim()}
                  className="flex-shrink-0 h-8 px-3 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-green-700">
                  {addingSupplierBusy ? '...' : 'שמור'}
                </button>
                <button type="button" onClick={() => { setAddingSupplier(false); setNewSupplierName('') }}
                  className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* 3. פרטי סחורה */}
            {isLulav && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">פרטי סחורה</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">שדה</Label>
                    <Controller control={control} name="field_id" render={({ field }) => (
                      <select className={selectCls} value={field.value ?? ''}
                        onChange={e => {
                          if (e.target.value === '__new__') { setAddingField(true); return }
                          field.onChange(e.target.value ? Number(e.target.value) : undefined)
                        }}>
                        <option value="">— בחר שדה —</option>
                        {filteredFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        <option value="__new__">+ הוסף חלקה חדשה</option>
                      </select>
                    )} />
                    {addingField && (
                      <div className="flex gap-1.5 mt-1">
                        <input
                          autoFocus
                          type="text"
                          value={newFieldName}
                          onChange={e => setNewFieldName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddField() } if (e.key === 'Escape') { setAddingField(false); setNewFieldName('') } }}
                          placeholder="שם חלקה חדשה..."
                          className="flex-1 h-8 rounded-lg border border-green-400 px-2 text-sm outline-none focus:ring-2 focus:ring-green-500/20 bg-white"
                        />
                        <button type="button" onClick={handleAddField} disabled={addingFieldBusy || !newFieldName.trim()}
                          className="flex-shrink-0 h-8 px-2 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-green-700">
                          {addingFieldBusy ? '...' : 'שמור'}
                        </button>
                        <button type="button" onClick={() => { setAddingField(false); setNewFieldName('') }}
                          className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600">
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">אורך</Label>
                    <Controller control={control} name="length_type" render={({ field }) => (
                      <select className={selectCls} value={field.value} onChange={e => field.onChange(e.target.value)}>
                        {LENGTH_TYPES.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    )} />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1.5">
                      תאריך קטיף
                      {harvestDate && (
                        <span className={cn('px-1.5 py-0 rounded-full font-medium text-[10px]',
                          computedFreshness === 'טרי' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        )}>
                          {computedFreshness}
                        </span>
                      )}
                    </Label>
                    <Controller control={control} name="harvest_date" render={({ field }) => (
                      <Input type="date" value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} className="h-8 text-sm" />
                    )} />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">כמות</Label>
                    <Input type="number" {...register('total_quantity', { valueAsNumber: true })} className="h-8 text-sm" />
                    {errors.total_quantity && <p className="text-xs text-red-500">{errors.total_quantity.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">חזרות</Label>
                    <Input type="number" {...register('returns_quantity', { valueAsNumber: true })} className="h-8 text-sm" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">סה״כ נטו</Label>
                    <div className="h-8 flex items-center px-3 bg-gray-50 rounded-lg border text-sm font-semibold text-green-700">
                      {netQty.toLocaleString()}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">משטח</Label>
                    <Input type="number" {...register('pallet_count', { valueAsNumber: true })} placeholder="—" className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            )}

            {/* כמות — always visible when not לולבים */}
            {!isLulav && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">כמות</Label>
                  <Input type="number" {...register('total_quantity', { valueAsNumber: true })} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">חזרות</Label>
                  <Input type="number" {...register('returns_quantity', { valueAsNumber: true })} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">סה״כ נטו</Label>
                  <div className="h-8 flex items-center px-3 bg-gray-50 rounded-lg border text-sm font-semibold text-green-700">
                    {netQty.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* 4. תמחור */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">תמחור</p>

              {/* Currency selector */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                {[
                  { val: 'ILS', label: '₪ שקל' },
                  { val: 'USD', label: '$ דולר' },
                  { val: 'EUR', label: '€ אירו' },
                  { val: 'GBP', label: '£ פאונד' },
                ].map(({ val, label }) => (
                  <button key={val} type="button"
                    className={cn('px-3 py-1 text-sm rounded-md transition-colors',
                      orderCurrency === val
                        ? 'bg-white shadow text-gray-900 font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                    onClick={() => { setValue('order_currency', val); setValue('vat_included', false) }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* VAT toggle — only for ILS */}
              {isILS && (
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                  {[
                    { val: false, label: 'מחיר ללא מע״מ' },
                    { val: true,  label: 'מחיר כולל מע״מ' },
                  ].map(({ val, label }) => (
                    <button key={String(val)} type="button"
                      className={cn('px-3 py-1 text-sm rounded-md transition-colors',
                        vatIncluded === val
                          ? 'bg-white shadow text-gray-900 font-medium'
                          : 'text-gray-500 hover:text-gray-700'
                      )}
                      onClick={() => setValue('vat_included', val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div className="max-w-[180px] space-y-1">
                <Label className="text-xs">מחיר ליחידה ({currencySymbol})</Label>
                <Input type="number" step="0.01" {...register('price_per_unit', { valueAsNumber: true })} />
                {errors.price_per_unit && <p className="text-xs text-red-500">{errors.price_per_unit.message}</p>}
              </div>

              {pricePerUnit > 0 && netQty > 0 && (
                <div className="rounded-lg bg-gray-50 border p-3 space-y-1.5 text-sm max-w-xs">
                  {isILS ? (
                    <>
                      <div className="flex justify-between text-gray-500">
                        <span>סה״כ ללא מע״מ</span>
                        <span>₪{totalExVat.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>מע״מ ({vatRate}%)</span>
                        <span>₪{vatAmount.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between font-bold text-green-700 border-t pt-1.5">
                        <span>סה״כ כולל מע״מ</span>
                        <span>₪{totalIncVat.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between font-bold text-green-700">
                      <span>סה״כ</span>
                      <span>{currencySymbol}{(pricePerUnit * netQty).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 5. סטטוס מיון — edit mode only, לולבים only */}
            {editing && isLulav && editingSortingStatus && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">סטטוס מיון</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={cn('text-sm px-3 py-1 rounded-full', editingSortingStatus.cls)}>
                    {editingSortingStatus.label}
                  </span>
                  {editing.status !== 'sorted' && (
                    <Button type="button" size="sm" variant="outline"
                      className="text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => markAsSorted(editing.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                      סמן כמויין מלא ✓
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 6. הערות */}
            <div className="space-y-1">
              <Label className="text-xs">הערות</Label>
              <Textarea {...register('notes')} rows={2} placeholder="הערות נוספות..." />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                {isSubmitting ? 'שומר...' : editing ? 'עדכן' : 'שמור'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="מחיקת קבלה"
        message={deleteConfirm ? `למחוק קבלה ${deleteConfirm.serial_no}?` : ''}
        onConfirm={() => deleteConfirm && doDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
