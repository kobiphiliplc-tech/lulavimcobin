'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/lib/context/SeasonContext'
import { GRADES, LENGTH_TYPES, FRESHNESS_TYPES, getGradeColor, getGradeTextColor } from '@/lib/constants'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier { id: number; name: string }
interface Customer { id: number; name: string; currency: string }

interface PackagingOrder {
  id: number
  pack_number: number
  season: string
  pack_date: string
  supplier_id: number | null
  grade: string
  freshness_type: 'מוקדם' | 'טרי'
  length_type: 'רגיל' | 'ארוך' | 'קצר'
  pack_name: string
  pack_type: 'אמבטיה' | 'תפזורת' | 'ניילון'
  storage_location: string | null
  box_count: number | null
  units_per_box: number | null
  total_units: number | null
  pallet_no: string | null
  customer_id: number | null
  notes: string | null
  created_at: string
  supplier?: { name: string } | null
  customer?: { name: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PACK_NAMES = [
  'בריסקער הלברשטאם',
  'מהודר א"א בד"ץ',
  'מהודר א"א',
  'מהודר א׳',
  'כשר שמחת חג',
  'קורה שמחת חג',
  'קורה',
  'אחר',
]

const STORAGE_LOCATIONS = ['מקרר', 'ביא"ר', 'אבנר', 'ק"ס']
const PACK_TYPES = ['אמבטיה', 'תפזורת', 'ניילון'] as const
const CURRENCIES: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' }

const PAGE_SIZE = 20

// ─── Column Definitions ───────────────────────────────────────────────────────

interface ColDef {
  key: string
  label: string
  getValue: (o: PackagingOrder) => string | number | null | undefined
  sortable: boolean
  filterable: boolean
}

const COLS: ColDef[] = [
  { key: 'pack_number',     label: '#',          getValue: o => o.pack_number,           sortable: true, filterable: false },
  { key: 'pack_date',       label: 'תאריך',       getValue: o => o.pack_date,             sortable: true, filterable: false },
  { key: 'supplier',        label: 'מגדל',        getValue: o => o.supplier?.name ?? '',  sortable: true, filterable: true  },
  { key: 'grade',           label: 'רמת מיון',    getValue: o => o.grade,                 sortable: true, filterable: true  },
  { key: 'pack_name',       label: 'שם אריזה',    getValue: o => o.pack_name,             sortable: true, filterable: true  },
  { key: 'pack_type',       label: 'סוג',         getValue: o => o.pack_type,             sortable: true, filterable: true  },
  { key: 'freshness_type',  label: 'מ/ט',         getValue: o => o.freshness_type,        sortable: true, filterable: true  },
  { key: 'length_type',     label: 'אורך',        getValue: o => o.length_type,           sortable: true, filterable: true  },
  { key: 'box_count',       label: 'קרטונים',     getValue: o => o.box_count,             sortable: true, filterable: false },
  { key: 'units_per_box',   label: 'יח׳/קרטון',   getValue: o => o.units_per_box,         sortable: true, filterable: false },
  { key: 'total_units',     label: 'סה"כ',        getValue: o => o.total_units,           sortable: true, filterable: false },
  { key: 'storage_location',label: 'מיקום',       getValue: o => o.storage_location ?? '', sortable: true, filterable: true },
  { key: 'pallet_no',       label: 'משטח',        getValue: o => o.pallet_no ?? '',       sortable: true, filterable: false },
  { key: 'customer',        label: 'לקוח',        getValue: o => o.customer?.name ?? '',  sortable: true, filterable: true  },
]

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const nanToUndef = (v: unknown) => (typeof v === 'number' && isNaN(v) ? undefined : v)

const schema = z.object({
  pack_date:        z.string().min(1, 'חובה'),
  supplier_id:      z.preprocess(nanToUndef, z.number().int().positive().optional()),
  grade:            z.string().min(1, 'חובה'),
  freshness_type:   z.enum(['מוקדם', 'טרי']),
  length_type:      z.enum(['רגיל', 'ארוך', 'קצר']),
  pack_name:        z.string().min(1, 'חובה'),
  pack_type:        z.enum(['אמבטיה', 'תפזורת', 'ניילון']),
  storage_location: z.string().optional(),
  box_count:        z.preprocess(nanToUndef, z.number({ message: 'חובה' }).int().positive('חובה')),
  units_per_box:    z.preprocess(nanToUndef, z.number({ message: 'חובה' }).int().positive('חובה')),
  pallet_no:        z.string().optional(),
  customer_id:      z.preprocess(nanToUndef, z.number().int().positive().optional()),
  notes:            z.string().optional(),
})
type FormData = z.infer<typeof schema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('he-IL')
}

function GradeDot({ grade }: { grade: string }) {
  return (
    <span
      style={{
        width: 8, height: 8, borderRadius: '50%',
        background: getGradeColor(grade),
        flexShrink: 0, display: 'inline-block',
      }}
    />
  )
}

function GradeBadge({ grade }: { grade: string }) {
  const bg = getGradeColor(grade)
  const color = getGradeTextColor(grade)
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: bg, color,
    }}>
      {grade}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ArizotPage() {
  const supabase = createClient()
  const { activeSeason } = useSeason()

  const [orders, setOrders] = useState<PackagingOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PackagingOrder | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [suggestedPackNumber, setSuggestedPackNumber] = useState(1)
  const [saving, setSaving] = useState(false)
  const [assignTarget, setAssignTarget] = useState<PackagingOrder | null>(null)
  const [assignCustomerId, setAssignCustomerId] = useState<number | ''>('')
  const [sortCol, setSortCol]       = useState<string | null>(null)
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<{ key: string; x: number; y: number } | null>(null)
  const [filterSearch, setFilterSearch] = useState('')

  // ─── Form ──────────────────────────────────────────────────────────────────

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      pack_date: new Date().toISOString().slice(0, 10),
      freshness_type: 'מוקדם',
      length_type: 'רגיל',
      pack_type: 'תפזורת',
    },
  })

  const watchBoxCount    = watch('box_count')
  const watchUnitsPerBox = watch('units_per_box')
  const watchCustomerId  = watch('customer_id')
  const watchPackName    = watch('pack_name')
  const [customPackName, setCustomPackName] = useState('')
  const totalUnitsCalc = (Number(watchBoxCount) || 0) * (Number(watchUnitsPerBox) || 0)

  const selectedCustomer = customers.find(c => c.id === Number(watchCustomerId))

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: ordersData }, { data: suppliersData }, { data: customersData }] = await Promise.all([
      supabase
        .from('packaging_orders')
        .select('*, supplier:suppliers(name), customer:customers(name)')
        .eq('season', activeSeason)
        .order('pack_number', { ascending: false }),
      supabase.from('suppliers').select('id, name').order('name'),
      supabase.from('customers').select('id, name, currency').order('name'),
    ])
    setOrders((ordersData as PackagingOrder[]) ?? [])
    setSuppliers(suppliersData ?? [])
    setCustomers(customersData ?? [])

    const { data: maxData } = await supabase
      .from('packaging_orders')
      .select('pack_number')
      .eq('season', activeSeason)
      .order('pack_number', { ascending: false })
      .limit(1)
      .single()
    setSuggestedPackNumber(maxData ? (maxData.pack_number + 1) : 1)
    setLoading(false)
  }, [activeSeason]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [sortCol, sortDir, colFilters])

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function onSubmit(data: FormData) {
    setSaving(true)
    const resolvedPackName = data.pack_name === '__custom__' ? customPackName.trim() : data.pack_name
    if (!resolvedPackName) {
      toast.error('יש להזין שם אריזה')
      setSaving(false)
      return
    }

    const payload = {
      pack_date:        data.pack_date,
      supplier_id:      data.supplier_id || null,
      grade:            data.grade,
      freshness_type:   data.freshness_type,
      length_type:      data.length_type,
      pack_name:        resolvedPackName,
      pack_type:        data.pack_type,
      storage_location: data.storage_location || null,
      box_count:        data.box_count,
      units_per_box:    data.units_per_box,
      pallet_no:        data.pallet_no || null,
      customer_id:      data.customer_id || null,
      notes:            data.notes || null,
    }

    if (editing) {
      const { error } = await supabase
        .from('packaging_orders')
        .update(payload)
        .eq('id', editing.id)
      if (error) { toast.error('שגיאה בשמירה'); setSaving(false); return }
    } else {
      const { data: inserted, error } = await supabase
        .from('packaging_orders')
        .insert({ ...payload, season: activeSeason, pack_number: suggestedPackNumber })
        .select()
        .single()
      if (error || !inserted) { toast.error('שגיאה בשמירה'); setSaving(false); return }

      const totalUnits = data.box_count * data.units_per_box
      const { data: invRow } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('season', activeSeason)
        .eq('grade', data.grade)
        .eq('length_type', data.length_type)
        .eq('freshness_type', data.freshness_type)
        .order('quantity', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (invRow) {
        await supabase
          .from('inventory')
          .update({ quantity: Math.max(0, invRow.quantity - totalUnits) })
          .eq('id', invRow.id)

        await supabase.from('inventory_movements').insert({
          season:           activeSeason,
          movement_type:    'pack_out',
          grade_from:       data.grade,
          length_type:      data.length_type,
          freshness_type:   data.freshness_type,
          quantity:         totalUnits,
          reference_id:     inserted.id,
          reference_type:   'packaging_orders',
        })
      }
    }

    toast.success(editing ? 'האריזה עודכנה' : 'האריזה נשמרה בהצלחה')
    await fetchData()
    setShowForm(false)
    setEditing(null)
    reset()
    setSaving(false)
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  function openNew() {
    setEditing(null)
    reset({
      pack_date:      new Date().toISOString().slice(0, 10),
      freshness_type: 'מוקדם',
      length_type:    'רגיל',
      pack_type:      'תפזורת',
    })
    setCustomPackName('')
    setShowForm(true)
    setExpandedId(null)
  }

  function openEdit(order: PackagingOrder) {
    setEditing(order)
    const isCustom = !PACK_NAMES.includes(order.pack_name)
    reset({
      pack_date:        order.pack_date,
      supplier_id:      order.supplier_id ?? undefined,
      grade:            order.grade,
      freshness_type:   order.freshness_type,
      length_type:      order.length_type,
      pack_name:        isCustom ? '__custom__' : order.pack_name,
      pack_type:        order.pack_type,
      storage_location: order.storage_location ?? undefined,
      box_count:        order.box_count ?? undefined,
      units_per_box:    order.units_per_box ?? undefined,
      pallet_no:        order.pallet_no ?? undefined,
      customer_id:      order.customer_id ?? undefined,
      notes:            order.notes ?? undefined,
    })
    if (isCustom) setCustomPackName(order.pack_name)
    setShowForm(true)
    setExpandedId(null)
  }

  async function deleteOrder(id: number) {
    if (!confirm('למחוק את האריזה?')) return
    const { error } = await supabase.from('packaging_orders').delete().eq('id', id)
    if (error) { toast.error('שגיאה במחיקה'); return }
    toast.success('האריזה נמחקה')
    await fetchData()
    setExpandedId(null)
  }

  async function assignCustomer() {
    if (!assignTarget || !assignCustomerId) return
    const { error } = await supabase
      .from('packaging_orders')
      .update({ customer_id: assignCustomerId })
      .eq('id', assignTarget.id)
    if (error) { toast.error('שגיאה בשיוך'); return }
    toast.success('הלקוח שויך בהצלחה')
    setAssignTarget(null)
    setAssignCustomerId('')
    await fetchData()
  }

  // ─── Sort / Filter Helpers ─────────────────────────────────────────────────

  function toggleSort(key: string) {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
    setOpenFilter(null)
  }

  function toggleFilterValue(key: string, val: string) {
    setColFilters(prev => {
      const current = prev[key] ?? []
      const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val]
      if (next.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [key]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: next }
    })
  }

  function getUniqueVals(col: ColDef): string[] {
    const seen = new Set<string>()
    orders.forEach(o => {
      const v = col.getValue(o)
      if (v != null && v !== '') seen.add(String(v))
    })
    return Array.from(seen).sort()
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const totalUnits   = orders.reduce((s, o) => s + (o.total_units ?? 0), 0)
  const totalBoxes   = orders.reduce((s, o) => s + (o.box_count  ?? 0), 0)
  const noCustomer   = orders.filter(o => !o.customer_id).reduce((s, o) => s + (o.total_units ?? 0), 0)

  let displayOrders = orders.filter(o =>
    Object.entries(colFilters).every(([key, vals]) => {
      if (!vals.length) return true
      const col = COLS.find(c => c.key === key)
      if (!col) return true
      return vals.includes(String(col.getValue(o) ?? ''))
    })
  )
  if (sortCol) {
    const sortColDef = COLS.find(c => c.key === sortCol)
    if (sortColDef) {
      displayOrders = [...displayOrders].sort((a, b) => {
        const av = sortColDef.getValue(a)
        const bv = sortColDef.getValue(b)
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
  }

  const activeFilterCount = Object.values(colFilters).reduce((s, v) => s + v.length, 0)
  const totalPages = Math.max(1, Math.ceil(displayOrders.length / PAGE_SIZE))
  const pageOrders = displayOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="p-4 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">אריזות 📦</h1>
          <p className="text-xs text-gray-400 mt-0.5">עונה {activeSeason}</p>
        </div>
        <button
          onClick={openNew}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + אריזה חדשה
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary,#6b7280)', marginBottom: 2 }}>{'סה"כ ארוז'}</div>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{fmtNum(totalUnits)}</div>
          <div style={{ fontSize: 10, color: 'var(--color-text-secondary,#6b7280)' }}>יח׳</div>
        </div>
        <div style={{ background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary,#6b7280)', marginBottom: 2 }}>קרטונים</div>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{fmtNum(totalBoxes)}</div>
        </div>
        <div style={{ background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#d97706', marginBottom: 2 }}>ללא לקוח ⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: '#d97706' }}>{fmtNum(noCustomer)}</div>
          <div style={{ fontSize: 10, color: 'var(--color-text-secondary,#6b7280)' }}>יח׳</div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setViewMode('cards')}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${viewMode === 'cards' ? 'bg-green-50 border-green-200 text-green-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
        >
          כרטיסיות
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${viewMode === 'table' ? 'bg-green-50 border-green-200 text-green-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
        >
          טבלה
        </button>
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setColFilters({}); setSortCol(null) }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
          >
            נקה סינונים ({activeFilterCount})
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">טוען...</p>}

      {!loading && orders.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">אין אריזות בעונה זו</p>
      )}

      {/* ── Cards View ── */}
      {!loading && orders.length > 0 && viewMode === 'cards' && (
        <>
          {pageOrders.map(order => {
            const expanded = expandedId === order.id
            const supplierName = order.supplier?.name ?? ''
            const customerName = order.customer?.name ?? null
            return (
              <div
                key={order.id}
                style={{
                  background: 'var(--color-background-primary,#fff)',
                  border: '0.5px solid var(--color-border-tertiary,#e5e7eb)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 6,
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedId(expanded ? null : order.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', minWidth: 24 }}>#{order.pack_number}</span>
                  <GradeDot grade={order.grade} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{order.pack_name}</span>
                  <GradeBadge grade={order.grade} />
                  {supplierName && <span style={{ fontSize: 11, color: '#6b7280' }}>{supplierName}</span>}
                  <span style={{ fontSize: 12, color: '#6b7280', marginRight: 'auto' }}>{fmtDate(order.pack_date)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
                  <span>{order.box_count} × {order.units_per_box} יח׳</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{fmtNum(order.total_units)} יח׳</span>
                  <span>{order.freshness_type} · {order.length_type}</span>
                  <span>{order.pack_type}</span>
                  {customerName
                    ? <span style={{ color: '#16a34a' }}>{customerName}</span>
                    : <span style={{ color: '#d97706' }}>ללא לקוח ⚠️</span>
                  }
                </div>
                {expanded && (
                  <div
                    style={{ marginTop: 10, borderTop: '0.5px solid #e5e7eb', paddingTop: 10 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {[
                      ['מיקום אחסון', order.storage_location ?? '—'],
                      ['מס׳ משטח',    order.pallet_no ?? '—'],
                      ['לקוח',        customerName ?? 'לא שויך'],
                    ].map(([label, val], i, arr) => (
                      <div key={label} style={{
                        display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                        borderBottom: i < arr.length - 1 ? '0.5px solid #e5e7eb' : 'none', fontSize: 13,
                      }}>
                        <span style={{ color: '#6b7280' }}>{label}</span>
                        <span style={{ color: val === 'לא שויך' ? '#d97706' : undefined }}>{val}</span>
                      </div>
                    ))}
                    {order.notes && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{order.notes}</div>
                    )}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button
                        onClick={() => openEdit(order)}
                        style={{ flex: 1, padding: 6, fontSize: 12, border: '0.5px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#6b7280', cursor: 'pointer' }}
                      >
                        עריכה
                      </button>
                      <button
                        onClick={() => { setAssignTarget(order); setAssignCustomerId(order.customer_id ?? '') }}
                        style={{ flex: 1, padding: 6, fontSize: 12, border: '0.5px solid #16a34a', borderRadius: 6, background: '#f0fdf4', color: '#16a34a', cursor: 'pointer' }}
                      >
                        שייך ללקוח
                      </button>
                      <button
                        onClick={() => deleteOrder(order.id)}
                        style={{ flex: 1, padding: 6, fontSize: 12, border: '0.5px solid #fca5a5', borderRadius: 6, background: '#fff5f5', color: '#b91c1c', cursor: 'pointer' }}
                      >
                        מחיקה
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ── Table View ── */}
      {!loading && orders.length > 0 && viewMode === 'table' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {COLS.map(col => {
                  const isActive = sortCol === col.key
                  const hasFilter = (colFilters[col.key]?.length ?? 0) > 0
                  return (
                    <th key={col.key} style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: isActive ? '#16a34a' : '#6b7280', fontWeight: 500, whiteSpace: 'nowrap', userSelect: 'none' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {/* Sort trigger — entire label area */}
                        <span
                          onClick={() => toggleSort(col.key)}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                        >
                          {col.label}
                          <span style={{ fontSize: 10, lineHeight: 1, color: isActive ? '#16a34a' : '#d1d5db' }}>
                            {isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                          </span>
                        </span>
                        {/* Filter trigger */}
                        {col.filterable && (
                          <button type="button"
                            onClick={e => {
                              e.stopPropagation()
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              if (openFilter?.key !== col.key) setFilterSearch('')
                              setOpenFilter(f => f?.key === col.key ? null : { key: col.key, x: rect.left, y: rect.bottom + 4 })
                            }}
                            style={{ background: hasFilter ? '#dcfce7' : 'none', border: hasFilter ? '1px solid #86efac' : 'none', borderRadius: 4, cursor: 'pointer', padding: '0 3px', lineHeight: 1.4, color: hasFilter ? '#16a34a' : '#d1d5db', fontSize: 11 }}>
                            {hasFilter ? `▾ ${colFilters[col.key].length}` : '▾'}
                          </button>
                        )}
                      </div>
                    </th>
                  )
                })}
                <th style={{ padding: '7px 10px', borderBottom: '1px solid #e5e7eb' }} />
              </tr>
            </thead>
            <tbody>
              {pageOrders.map(order => (
                <tr key={order.id} style={{ background: order.customer_id ? undefined : '#fffbeb' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb', color: '#6b7280' }}>{order.pack_number}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb' }}>{fmtDate(order.pack_date)}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb' }}>{order.supplier?.name ?? '—'}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <GradeDot grade={order.grade} />
                      {order.grade}
                    </span>
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb', fontWeight: 500 }}>{order.pack_name}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb' }}>{order.pack_type}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb' }}>{order.freshness_type}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb' }}>{order.length_type}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb' }}>{order.box_count}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb' }}>{order.units_per_box}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb', fontWeight: 500 }}>{fmtNum(order.total_units)}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb' }}>{order.storage_location ?? '—'}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb', color: '#6b7280' }}>{order.pallet_no ?? '—'}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb', color: order.customer_id ? undefined : '#d97706' }}>
                    {order.customer?.name ?? 'ללא ⚠️'}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb' }}>
                    <button
                      onClick={() => openEdit(order)}
                      style={{ fontSize: 11, padding: '2px 8px', border: '0.5px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#6b7280', cursor: 'pointer' }}
                    >
                      עריכה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">→</button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">←</button>
        </div>
      )}

      {/* Filter Popup */}
      {openFilter && (() => {
        const col = COLS.find(c => c.key === openFilter.key)!
        const uniq = getUniqueVals(col)
        const visibleVals = filterSearch.trim()
          ? uniq.filter(v => v.toLowerCase().includes(filterSearch.trim().toLowerCase()))
          : uniq
        const active = colFilters[openFilter.key] ?? []
        const allVisibleSelected = visibleVals.length > 0 && visibleVals.every(v => active.includes(v))
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpenFilter(null)} />
            <div style={{
              position: 'fixed', zIndex: 50,
              left: openFilter.x, top: openFilter.y,
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              minWidth: 200,
            }}>
              {/* Title row */}
              <div style={{ padding: '7px 12px 6px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{col.label}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button"
                    onClick={() => {
                      setColFilters(prev => {
                        const current = prev[openFilter.key] ?? []
                        const toAdd = visibleVals.filter(v => !current.includes(v))
                        if (allVisibleSelected) {
                          const next = { ...prev, [openFilter.key]: current.filter(v => !visibleVals.includes(v)) }
                          if (!next[openFilter.key].length) delete next[openFilter.key]
                          return next
                        }
                        return { ...prev, [openFilter.key]: [...current, ...toAdd] }
                      })
                    }}
                    style={{ fontSize: 10, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {allVisibleSelected ? 'בטל הכל' : 'בחר הכל'}
                  </button>
                  {active.length > 0 && (
                    <button type="button"
                      onClick={() => setColFilters(p => { const next = { ...p }; delete next[openFilter.key]; return next })}
                      style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      נקה
                    </button>
                  )}
                </div>
              </div>
              {/* Search input */}
              <div style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="חיפוש..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', outline: 'none', boxSizing: 'border-box' }}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {/* Checkboxes */}
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {visibleVals.map(val => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}
                    className="hover:bg-gray-50">
                    <input type="checkbox" checked={active.includes(val)} onChange={() => toggleFilterValue(openFilter.key, val)} style={{ cursor: 'pointer' }} />
                    <span>{val || '(ריק)'}</span>
                  </label>
                ))}
                {visibleVals.length === 0 && (
                  <div style={{ padding: '8px 12px', fontSize: 12, color: '#9ca3af' }}>
                    {uniq.length === 0 ? 'אין ערכים' : 'לא נמצאו תוצאות'}
                  </div>
                )}
              </div>
            </div>
          </>
        )
      })()}

      {/* Form Drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowForm(false); setEditing(null) }} />
          <div className="relative mr-auto w-full max-w-xl bg-white h-full overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <h2 className="text-base font-semibold text-gray-800">
                {editing ? `עריכת אריזה #${editing.pack_number}` : 'אריזה חדשה'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-5">

              {/* סעיף 1 */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center">1</span>
                  <span className="text-sm font-semibold text-gray-700">פרטי אריזה</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">מס׳ אריזה</label>
                    <input readOnly value={editing ? editing.pack_number : suggestedPackNumber}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-green-50 text-green-700 font-semibold" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">תאריך</label>
                    <input type="date" {...register('pack_date')} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    {errors.pack_date && <p className="text-xs text-red-500 mt-0.5">{errors.pack_date.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">מגדל/ספק</label>
                    <Controller name="supplier_id" control={control} render={({ field }) => (
                      <select {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                        <option value="">— בחר —</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )} />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">רמת מיון</label>
                    <Controller name="grade" control={control} render={({ field }) => (
                      <select {...field} value={field.value ?? ''} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                        <option value="">— בחר —</option>
                        {GRADES.filter(g => !g.isReject).map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                      </select>
                    )} />
                    {errors.grade && <p className="text-xs text-red-500 mt-0.5">{errors.grade.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">טריות</label>
                    <Controller name="freshness_type" control={control} render={({ field }) => (
                      <select {...field} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                        {FRESHNESS_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    )} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">אורך</label>
                    <Controller name="length_type" control={control} render={({ field }) => (
                      <select {...field} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                        {LENGTH_TYPES.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    )} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">מיקום אריזה</label>
                    <Controller name="storage_location" control={control} render={({ field }) => (
                      <select {...field} value={field.value ?? ''} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                        <option value="">— בחר —</option>
                        {STORAGE_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    )} />
                  </div>
                </div>
              </section>

              {/* סעיף 2 */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center">2</span>
                  <span className="text-sm font-semibold text-gray-700">שם אריזה וסוג</span>
                </div>
                <div className="mb-2">
                  <label className="block text-xs text-gray-500 mb-1">שם אריזה</label>
                  <Controller name="pack_name" control={control} render={({ field }) => (
                    <select {...field} value={field.value ?? ''} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                      <option value="">— בחר —</option>
                      {PACK_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                      <option value="__custom__">אחר (הקלד חדש)</option>
                    </select>
                  )} />
                  {errors.pack_name && <p className="text-xs text-red-500 mt-0.5">{errors.pack_name.message}</p>}
                  {watchPackName === '__custom__' && (
                    <input type="text" placeholder="הזן שם אריזה חדש..." value={customPackName}
                      onChange={e => setCustomPackName(e.target.value)}
                      className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                  )}
                </div>
                <div className="mb-2">
                  <label className="block text-xs text-gray-500 mb-1">סוג</label>
                  <Controller name="pack_type" control={control} render={({ field }) => (
                    <div className="flex gap-2">
                      {PACK_TYPES.map(t => (
                        <button key={t} type="button" onClick={() => field.onChange(t)}
                          className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${field.value === t ? 'bg-green-600 border-green-600 text-white font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )} />
                </div>
              </section>

              {/* סעיף 3 */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center">3</span>
                  <span className="text-sm font-semibold text-gray-700">כמויות</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">קרטונים</label>
                    <input type="number" min={1} {...register('box_count', { valueAsNumber: true })} placeholder="0"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    {errors.box_count && <p className="text-xs text-red-500 mt-0.5">{errors.box_count.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">יח׳ בקרטון</label>
                    <input type="number" min={1} {...register('units_per_box', { valueAsNumber: true })} placeholder="0"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    {errors.units_per_box && <p className="text-xs text-red-500 mt-0.5">{errors.units_per_box.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{'סה"כ'} יח׳</label>
                    <div className="w-full text-sm border border-green-200 rounded-lg px-3 py-2 bg-green-50 text-green-700 font-semibold">
                      {totalUnitsCalc > 0 ? fmtNum(totalUnitsCalc) : '—'}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">מס׳ משטח <span className="text-gray-400">(אופציונלי)</span></label>
                  <input type="text" {...register('pallet_no')} placeholder="K-1, K-2..."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                </div>
              </section>

              {/* סעיף 4 */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold bg-gray-400 text-white rounded-full w-5 h-5 flex items-center justify-center">4</span>
                  <span className="text-sm font-semibold text-gray-700">שיוך ללקוח <span className="text-xs text-gray-400 font-normal">(אופציונלי)</span></span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">לקוח</label>
                    <Controller name="customer_id" control={control} render={({ field }) => (
                      <select {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                        <option value="">— ללא לקוח —</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">מטבע</label>
                    <div className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500">
                      {selectedCustomer ? `${CURRENCIES[selectedCustomer.currency] ?? ''} ${selectedCustomer.currency}` : '—'}
                    </div>
                  </div>
                </div>
              </section>

              {/* סעיף 5 */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold bg-gray-400 text-white rounded-full w-5 h-5 flex items-center justify-center">5</span>
                  <span className="text-sm font-semibold text-gray-700">הערות <span className="text-xs text-gray-400 font-normal">(אופציונלי)</span></span>
                </div>
                <textarea {...register('notes')} rows={3} placeholder="הערות נוספות..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none" />
              </section>

              <div className="flex gap-3 pt-1 pb-4">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">ביטול</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-60 transition-colors">
                  {saving ? 'שומר...' : 'שמור אריזה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Customer Dialog */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAssignTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">שיוך אריזה #{assignTarget.pack_number} ללקוח</h3>
            <select value={assignCustomerId} onChange={e => setAssignCustomerId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white mb-4">
              <option value="">— ללא לקוח —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setAssignTarget(null)}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">ביטול</button>
              <button onClick={assignCustomer}
                className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">שמור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
