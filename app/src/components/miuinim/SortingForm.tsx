'use client'

import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { GRADES, LENGTH_TYPES, FRESHNESS_TYPES, GRADE_GROUP_TOP, GRADE_GROUP_MID, GRADE_GROUP_LOWER } from '@/lib/constants'
import type { SortingEvent, Supplier, Field, ReceivingOrder, Grade } from '@/lib/types'
import { useMemo, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Plus, X } from 'lucide-react'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const selectCls = "w-full rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm h-8 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"

const schema = z.object({
  sort_serial:    z.coerce.number().min(1, 'חובה'),
  sorted_date:    z.string().min(1, 'חובה'),
  field_id:       z.coerce.number().optional(),
  field_name:     z.string().optional(),
  length_type:    z.enum(['ארוך', 'רגיל', 'קצר']),
  freshness_type: z.enum(['מוקדם', 'טרי']),
  supplier_id:    z.coerce.number().optional(),
  status_type:    z.string().default('בסיסי'),
  warehouse_code: z.string().optional(),
  notes:          z.string().optional(),
  quantities:     z.array(z.object({ grade: z.string(), quantity: z.number().min(0) })),
})

type FormData = z.infer<typeof schema>

// ─── Fallback grades from constants ─────────────────────────────────────────
const FALLBACK_GRADES: Grade[] = GRADES.map((g, i) => ({
  id: -(i + 1),
  name: g.name,
  color: g.color,
  text_color: g.textColor,
  group_name: (GRADE_GROUP_TOP.includes(g.name) ? 'high' :
               GRADE_GROUP_MID.includes(g.name) ? 'mid' :
               GRADE_GROUP_LOWER.includes(g.name) ? 'low' : 'reject') as Grade['group_name'],
  sort_order: i,
}))

// ─── GradeRow ────────────────────────────────────────────────────────────────

function GradeRow({
  grade, value, pct, tabIndex, onChange, onEnter, dimmed,
}: {
  grade: { name: string; color: string; textColor: string }
  value: number
  pct: number
  tabIndex: number
  onChange: (v: number) => void
  onEnter: () => void
  dimmed?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2 py-1', dimmed && 'opacity-50')}>
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: grade.color, border: '1px solid rgba(0,0,0,0.12)' }}
      />
      <span className="w-14 text-sm text-right flex-shrink-0 font-medium text-gray-700">{grade.name}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${Math.min(pct, 100)}%`, background: grade.color }}
        />
      </div>
      <span className="w-9 text-left text-xs text-gray-400 tabular-nums flex-shrink-0">
        {pct > 0 ? `${Math.round(pct)}%` : ''}
      </span>
      <input
        type="number"
        min="0"
        tabIndex={tabIndex}
        value={value || ''}
        placeholder="0"
        onChange={e => onChange(Number(e.target.value) || 0)}
        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onEnter())}
        className="w-16 text-center text-sm border-0 border-b border-gray-300 focus:border-green-500 outline-none bg-transparent tabular-nums py-0.5 flex-shrink-0"
      />
    </div>
  )
}

// ─── Main Form ───────────────────────────────────────────────────────────────

interface Props {
  event?: SortingEvent
  suppliers: Supplier[]
  fields: Field[]
  receivingOrders?: ReceivingOrder[]
  usedWarehouseCodes?: string[]
  suggestedSerial?: number
  grades?: Grade[]
  onSubmit: (data: FormData) => Promise<void>
  onCancel: () => void
  onFieldAdded?: (name: string, supplierId?: number) => Promise<Field | null>
  onSupplierAdded?: (name: string) => Promise<Supplier | null>
}

export function SortingForm({
  event, suppliers, fields, receivingOrders = [],
  usedWarehouseCodes = [],
  suggestedSerial, grades: gradesProp, onSubmit, onCancel, onFieldAdded, onSupplierAdded,
}: Props) {
  const gradeList   = gradesProp ?? FALLBACK_GRADES
  const GROUP_RANK: Record<string, number> = { high: 0, mid: 1, low: 2, reject: 3 }
  const sortedGrades = [...gradeList].sort((a, b) =>
    (GROUP_RANK[a.group_name] ?? 9) - (GROUP_RANK[b.group_name] ?? 9) || a.sort_order - b.sort_order
  )
  const mainGrades  = sortedGrades.filter(g => g.group_name !== 'reject')
  const rejectGrades = sortedGrades.filter(g => g.group_name === 'reject')

  const defaultQtys = gradeList.map(g => ({
    grade: g.name,
    quantity: event?.sorting_quantities?.find(q => q.grade === g.name)?.quantity ?? 0,
  }))

  const { register, handleSubmit, control, watch, setValue, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      sort_serial:    event?.sort_serial ?? suggestedSerial,
      sorted_date:    event?.sorted_date ?? todayISO(),
      field_id:       event?.field_id ?? undefined,
      field_name:     event?.field_name ?? '',
      length_type:    event?.length_type ?? 'רגיל',
      freshness_type: event?.freshness_type ?? 'טרי',
      supplier_id:    event?.supplier_id ?? undefined,
      status_type:    event?.status_type ?? 'בסיסי',
      warehouse_code: event?.warehouse_code ?? '',
      notes:          event?.notes ?? '',
      quantities:     defaultQtys,
    },
  })

  const quantities         = watch('quantities')
  const selectedSupId      = watch('supplier_id')
  const selectedFldId      = watch('field_id')
  const selectedFreshness  = watch('freshness_type')
  const warehouseCode      = watch('warehouse_code')

  // add-field inline state
  const [addingField,    setAddingField]    = useState(false)
  const [newFieldName,   setNewFieldName]   = useState('')
  const [addingFieldBusy, setAddingFieldBusy] = useState(false)

  // add-supplier inline state
  const [addingSupplier,    setAddingSupplier]    = useState(false)
  const [newSupplierName,   setNewSupplierName]   = useState('')
  const [addingSupplierBusy, setAddingSupplierBusy] = useState(false)

  async function handleAddSupplier() {
    const name = newSupplierName.trim()
    if (!name || !onSupplierAdded) return
    setAddingSupplierBusy(true)
    const supplier = await onSupplierAdded(name)
    setAddingSupplierBusy(false)
    if (supplier) {
      setValue('supplier_id', supplier.id)
      setAddingSupplier(false)
      setNewSupplierName('')
    }
  }

  // all fields sorted: supplier's own fields first, then the rest
  const filteredFields = useMemo(() => {
    if (!selectedSupId) return fields
    const mine   = fields.filter(f => f.supplier_id === selectedSupId)
    const others = fields.filter(f => f.supplier_id !== selectedSupId)
    return [...mine, ...others]
  }, [fields, selectedSupId])

  async function handleAddField() {
    const name = newFieldName.trim()
    if (!name || !onFieldAdded) return
    setAddingFieldBusy(true)
    const field = await onFieldAdded(name, selectedSupId)
    setAddingFieldBusy(false)
    if (field) {
      setValue('field_id', field.id)
      setAddingField(false)
      setNewFieldName('')
    }
  }

  // auto-suggest warehouse_code when field or freshness changes (new events only)
  useEffect(() => {
    if (event) return // editing — never override
    if (!selectedFldId) {
      setValue('warehouse_code', '')
      return
    }
    const open = receivingOrders.filter(o =>
      o.field_id === selectedFldId &&
      o.freshness_type === selectedFreshness &&
      o.warehouse_code &&
      o.status !== 'sorted'
    )
    if (open.length > 0) {
      setValue('warehouse_code', open[0].warehouse_code!)
    } else {
      const maxFromOrders = receivingOrders.reduce((m, o) => {
        const n = parseInt(o.warehouse_code ?? '', 10)
        return isNaN(n) ? m : Math.max(m, n)
      }, 0)
      const maxFromEvents = usedWarehouseCodes.reduce((m, c) => {
        const n = parseInt(c, 10)
        return isNaN(n) ? m : Math.max(m, n)
      }, 0)
      setValue('warehouse_code', String(Math.max(maxFromOrders, maxFromEvents) + 1))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFldId, selectedFreshness])

  // badge + conflict check: receiving orders sharing this warehouse code
  const warehouseInfo = useMemo(() => {
    if (!warehouseCode) return null
    const matching = receivingOrders.filter(o => o.warehouse_code === warehouseCode)
    if (matching.length === 0) return null
    const totalQty = matching.reduce((s, o) => s + Math.max(0, (o.total_quantity ?? 0) - o.returns_quantity), 0)
    const conflict = !!selectedFldId && matching.some(o => o.field_id !== selectedFldId)
    return { count: matching.length, totalQty, conflict }
  }, [warehouseCode, receivingOrders, selectedFldId])

  // real-time stats
  const { total, topPct, midPct, lowerPct, netTotal, topPctNet, midPctNet, lowerPctNet } = useMemo(() => {
    const getQ = (name: string) => Number(quantities.find(q => q.grade === name)?.quantity || 0)
    const total  = quantities.reduce((s, q) => s + (Number(q.quantity) || 0), 0)
    const grpSum = (group: Grade['group_name']) => gradeList.filter(g => g.group_name === group).reduce((s, g) => s + getQ(g.name), 0)
    const top    = grpSum('high')
    const mid    = grpSum('mid')
    const lower  = grpSum('low')
    const reject = grpSum('reject')
    const base   = total || 1
    const netTotal = total - reject
    const netBase  = netTotal || 1
    return {
      total,
      topPct:   Math.round((top   / base) * 100),
      midPct:   Math.round((mid   / base) * 100),
      lowerPct: Math.round((lower / base) * 100),
      netTotal,
      topPctNet:   Math.round((top   / netBase) * 100),
      midPctNet:   Math.round((mid   / netBase) * 100),
      lowerPctNet: Math.round((lower / netBase) * 100),
    }
  }, [quantities])

  function getQty(gradeName: string) {
    return Number(quantities.find(q => q.grade === gradeName)?.quantity || 0)
  }
  function setQty(gradeName: string, val: number) {
    const idx = quantities.findIndex(q => q.grade === gradeName)
    if (idx !== -1) setValue(`quantities.${idx}.quantity`, val, { shouldDirty: true })
  }
  function focusNext(currentTabIndex: number) {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[tabindex]')
    const arr = Array.from(inputs).filter(el => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex)
    const cur = arr.findIndex(el => el.tabIndex === currentTabIndex)
    arr[cur + 1]?.focus()
  }

  const sectionCls  = "border border-gray-200 rounded-xl p-4 space-y-3"
  const sectionTitle = "text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3"

  return (
    <form onSubmit={handleSubmit(d => onSubmit(d))} className="space-y-4" dir="rtl">

      {/* ── Section 1: פרטי מיון ── */}
      <div className={sectionCls}>
        {/* section header + מס׳ מיון inline */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">1 · פרטי מיון</p>
          <Controller control={control} name="sort_serial" render={({ field }) => (
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 whitespace-nowrap">מס׳ מיון</label>
              <Input
                type="number"
                value={field.value > 0 ? field.value : ''}
                onChange={e => field.onChange(e.target.valueAsNumber)}
                className="h-7 w-20 text-sm text-center font-mono"
              />
            </div>
          )} />
        </div>

        {/* Row 1: תאריך | ספק | שדה/חלקה */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">תאריך *</label>
            <Controller control={control} name="sorted_date" render={({ field }) => (
              <Input type="date" value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} className="h-8 text-sm" />
            )} />
          </div>

          <div className="space-y-1 min-w-0 overflow-hidden">
            <label className="text-xs text-gray-500 whitespace-nowrap">ספק</label>
            <Controller control={control} name="supplier_id" render={({ field }) => (
              <select className={selectCls} value={field.value ?? ''}
                onChange={e => {
                  if (e.target.value === '__new__') { setAddingSupplier(true); return }
                  field.onChange(e.target.value ? Number(e.target.value) : undefined)
                  setValue('field_id', undefined)
                }}>
                <option value="">— בחר ספק —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                {onSupplierAdded && <option value="__new__">+ הוסף ספק חדש</option>}
              </select>
            )} />
            {addingSupplier && (
              <div className="flex gap-1 mt-1 w-full">
                <input
                  autoFocus
                  type="text"
                  value={newSupplierName}
                  onChange={e => setNewSupplierName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSupplier() } if (e.key === 'Escape') { setAddingSupplier(false); setNewSupplierName('') } }}
                  placeholder="שם ספק..."
                  className="flex-1 min-w-0 h-8 rounded-lg border border-green-400 px-2 text-sm outline-none focus:ring-2 focus:ring-green-500/20 bg-white"
                />
                <button type="button" onClick={handleAddSupplier} disabled={addingSupplierBusy || !newSupplierName.trim()}
                  className="flex-shrink-0 h-8 px-1.5 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-green-700">
                  {addingSupplierBusy ? '...' : 'שמור'}
                </button>
                <button type="button" onClick={() => { setAddingSupplier(false); setNewSupplierName('') }}
                  className="flex-shrink-0 h-8 w-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">שדה / חלקה</label>
            <Controller control={control} name="field_id" render={({ field }) => (
              <select className={selectCls} value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">— בחר שדה —</option>
                {selectedSupId && filteredFields.some(f => f.supplier_id === selectedSupId) && (
                  <optgroup label="חלקות הספק">
                    {filteredFields.filter(f => f.supplier_id === selectedSupId).map(f =>
                      <option key={f.id} value={f.id}>{f.name}</option>
                    )}
                  </optgroup>
                )}
                {selectedSupId && filteredFields.some(f => f.supplier_id !== selectedSupId) ? (
                  <optgroup label="שאר החלקות">
                    {filteredFields.filter(f => f.supplier_id !== selectedSupId).map(f =>
                      <option key={f.id} value={f.id}>{f.name}</option>
                    )}
                  </optgroup>
                ) : !selectedSupId && filteredFields.map(f =>
                  <option key={f.id} value={f.id}>{f.name}</option>
                )}
              </select>
            )} />
          </div>
        </div>

        {/* Add-field row — full width, appears below the grid */}
        {onFieldAdded && (
          addingField ? (
            <div className="flex gap-2 mt-2">
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
                className="flex-shrink-0 h-8 px-3 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-green-700">
                {addingFieldBusy ? '...' : 'שמור'}
              </button>
              <button type="button" onClick={() => { setAddingField(false); setNewFieldName('') }}
                className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingField(true)}
              className="mt-1.5 text-[11px] text-green-600 hover:text-green-700 flex items-center gap-0.5 font-medium">
              <Plus className="h-3 w-3" /> הוסף חלקה חדשה
            </button>
          )
        )}

        {/* Row 2: אורך | טריות | סטטוס | קוד מחסן */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          <div className="space-y-1 min-w-0">
            <label className="text-xs text-gray-500 whitespace-nowrap block">אורך</label>
            <Controller control={control} name="length_type" render={({ field }) => (
              <select className={selectCls} value={field.value} onChange={e => field.onChange(e.target.value)}>
                {LENGTH_TYPES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )} />
          </div>

          <div className="space-y-1 min-w-0">
            <label className="text-xs text-gray-500 whitespace-nowrap block">טריות</label>
            <Controller control={control} name="freshness_type" render={({ field }) => (
              <select className={selectCls} value={field.value} onChange={e => field.onChange(e.target.value)}>
                {FRESHNESS_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            )} />
          </div>

          <div className="space-y-1 min-w-0">
            <label className="text-xs text-gray-500 whitespace-nowrap block">סטטוס</label>
            <Controller control={control} name="status_type" render={({ field }) => (
              <select className={selectCls} value={field.value} onChange={e => field.onChange(e.target.value)}>
                <option value="בסיסי">בסיסי</option>
                <option value="צהוב">צהוב</option>
                <option value="משנת יוסף">משנת יוסף</option>
              </select>
            )} />
          </div>

          <div className="space-y-1 min-w-0">
            <label className="text-xs text-gray-500 whitespace-nowrap block">קוד מחסן</label>
            <Input
              type="number"
              min="1"
              {...register('warehouse_code')}
              placeholder="—"
              className="h-8 text-sm text-center font-mono"
            />
            {warehouseInfo && (
              <p className="text-[10px] text-blue-600 font-medium mt-0.5 whitespace-nowrap">
                {warehouseInfo.count} קב׳ · {warehouseInfo.totalQty.toLocaleString()} יח׳
              </p>
            )}
            {warehouseInfo?.conflict && (
              <p className="text-[10px] text-orange-600 font-bold mt-0.5">⚠ קוד שייך לחלקה אחרת</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 2: כמויות לפי רמה ── */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className={cn(sectionTitle, 'mb-0')}>כמויות לפי רמה</p>
          {total > 0 && (
            <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <span>
                  <span className="font-semibold text-green-700">{topPct}%</span>
                  <span className="text-gray-400 mr-1">רמה גבוהה</span>
                </span>
                <span className="text-gray-200">|</span>
                <span>
                  <span className="font-semibold text-orange-600">{midPct}%</span>
                  <span className="text-gray-400 mr-1">ביניים</span>
                </span>
                <span className="text-gray-200">|</span>
                <span>
                  <span className="font-semibold text-blue-600">{lowerPct}%</span>
                  <span className="text-gray-400 mr-1">נמוכה</span>
                </span>
                <span className="text-gray-200">|</span>
                <span className="font-bold text-gray-700">סה״כ {total.toLocaleString()}</span>
              </div>
              {netTotal !== total && netTotal > 0 && (
                <div className="flex items-center gap-3 flex-wrap justify-end text-gray-400">
                  <span>
                    <span className="font-semibold text-green-600">{topPctNet}%</span>
                    <span className="mr-1">רמה גבוהה</span>
                  </span>
                  <span className="text-gray-200">|</span>
                  <span>
                    <span className="font-semibold text-orange-500">{midPctNet}%</span>
                    <span className="mr-1">ביניים</span>
                  </span>
                  <span className="text-gray-200">|</span>
                  <span>
                    <span className="font-semibold text-blue-500">{lowerPctNet}%</span>
                    <span className="mr-1">נמוכה</span>
                  </span>
                  <span className="text-gray-200">|</span>
                  <span className="font-bold">ללא בלאי {netTotal.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          {mainGrades.map((grade, idx) => {
            const qty = getQty(grade.name)
            const pct = total > 0 ? (qty / total) * 100 : 0
            return (
              <GradeRow
                key={grade.name}
                grade={{ name: grade.name, color: grade.color, textColor: grade.text_color }}
                value={qty}
                pct={pct}
                tabIndex={idx + 1}
                onChange={v => setQty(grade.name, v)}
                onEnter={() => focusNext(idx + 1)}
              />
            )
          })}

          <div className="border-t border-dashed border-gray-200 my-2" />

          {rejectGrades.map((grade, idx) => {
            const qty  = getQty(grade.name)
            const pct  = total > 0 ? (qty / total) * 100 : 0
            const ti   = mainGrades.length + idx + 1
            return (
              <GradeRow
                key={grade.name}
                grade={{ name: grade.name, color: grade.color, textColor: grade.text_color }}
                value={qty}
                pct={pct}
                tabIndex={ti}
                onChange={v => setQty(grade.name, v)}
                onEnter={() => focusNext(ti)}
                dimmed
              />
            )
          })}
        </div>
      </div>

      {/* ── Section 3: הערות ── */}
      <div className={sectionCls}>
        <p className={cn(sectionTitle, 'mb-2')}>3 · הערות</p>
        <Textarea
          {...register('notes')}
          placeholder="הערות נוספות (אופציונלי)..."
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {/* ── Buttons ── */}
      <div className="flex items-center justify-between pt-1">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700 px-6 min-w-[120px]"
        >
          {isSubmitting ? 'שומר...' : event ? 'עדכן מיון' : 'שמור מיון'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </form>
  )
}
