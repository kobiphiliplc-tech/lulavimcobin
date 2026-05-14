'use client'

import { useEffect, useCallback, useState } from 'react'
import { useForm, useFieldArray, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, X } from 'lucide-react'
import { NON_REJECT_GRADES, LENGTH_TYPES, FRESHNESS_TYPES } from '@/lib/constants'
import type { Customer, SaleOrder, InventoryRow } from '@/lib/types'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nanToUndef(v: unknown) {
  return typeof v === 'number' && isNaN(v) ? undefined : v
}

const itemSchema = z.object({
  grade:            z.string().min(1, 'חובה'),
  length_type:      z.string().min(1, 'חובה'),
  freshness_type:   z.string().min(1, 'חובה'),
  quantity_ordered: z.preprocess(nanToUndef, z.number({ message: 'חובה' }).int().positive('> 0')),
  unit_price:       z.preprocess(nanToUndef, z.number().nonnegative().optional()),
  notes:            z.string().optional(),
})

const schema = z.object({
  customer_id: z.preprocess(nanToUndef, z.number({ message: 'חובה' })),
  order_date:  z.string().min(1, 'חובה'),
  notes:       z.string().optional(),
  items:       z.array(itemSchema).min(1, 'יש להוסיף לפחות פריט אחד'),
})

export type SaleOrderFormData = z.infer<typeof schema>

const selectCls = "w-full rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm h-9 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: SaleOrderFormData) => Promise<void>
  customers: Customer[]
  inventory: InventoryRow[]
  order?: SaleOrder | null
  onCustomerAdded?: (name: string, market: string) => Promise<Customer | null>
}

function emptyItem() {
  return { grade: 'לבן', length_type: 'רגיל', freshness_type: 'טרי', quantity_ordered: undefined as unknown as number, unit_price: undefined as unknown as number, notes: '' }
}

export function SaleOrderForm({ open, onClose, onSave, customers, inventory, order, onCustomerAdded }: Props) {
  const [addingCustomer,     setAddingCustomer]     = useState(false)
  const [newCustomerName,    setNewCustomerName]    = useState('')
  const [newCustomerMarket,  setNewCustomerMarket]  = useState('ישראל')
  const [addingCustomerBusy, setAddingCustomerBusy] = useState(false)

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<SaleOrderFormData>({
    resolver: zodResolver(schema) as Resolver<SaleOrderFormData>,
    defaultValues: { order_date: todayISO(), items: [emptyItem()] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const items     = watch('items')
  const customerId = watch('customer_id')
  const selectedCustomer = customers.find(c => c.id === Number(customerId))

  useEffect(() => {
    if (order) {
      reset({
        customer_id: order.customer_id,
        order_date:  order.order_date,
        notes:       order.notes ?? '',
        items: (order.sale_order_items ?? []).map(i => ({
          grade:            i.grade,
          length_type:      i.length_type,
          freshness_type:   i.freshness_type,
          quantity_ordered: i.quantity_ordered,
          unit_price:       i.unit_price ?? ('' as unknown as number),
          notes:            i.notes ?? '',
        })),
      })
    } else {
      reset({ order_date: todayISO(), items: [emptyItem()] })
    }
  }, [order, open, reset])

  const getAvailableQty = useCallback((grade: string, length: string, freshness: string) => {
    const row = inventory.find(r => r.grade === grade && r.length_type === length && r.freshness_type === freshness)
    return row?.quantity ?? 0
  }, [inventory])

  const totalAmount = items?.reduce((sum, item) => {
    const qty = Number(item.quantity_ordered) || 0
    const price = Number(item.unit_price) || 0
    return sum + qty * price
  }, 0) ?? 0

  const currencySymbol = selectedCustomer?.currency === 'USD' ? '$' : selectedCustomer?.currency === 'EUR' ? '€' : '₪'

  async function handleAddCustomer() {
    const name = newCustomerName.trim()
    if (!name || !onCustomerAdded) return
    setAddingCustomerBusy(true)
    const customer = await onCustomerAdded(name, newCustomerMarket)
    setAddingCustomerBusy(false)
    if (customer) {
      setValue('customer_id', customer.id)
      setAddingCustomer(false)
      setNewCustomerName('')
      setNewCustomerMarket('ישראל')
    }
  }

  const onSubmit = async (data: SaleOrderFormData) => {
    await onSave(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[700px] max-h-[90vh] overflow-y-auto overflow-x-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle>{order ? 'עריכת הזמנה' : 'הזמנה חדשה'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Header */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>לקוח *</Label>
              <Controller control={control} name="customer_id"
                render={({ field }) => (
                  <select className={selectCls} value={field.value ?? ''}
                    onChange={e => {
                      if (e.target.value === '__new__') { setAddingCustomer(true); return }
                      field.onChange(e.target.value ? Number(e.target.value) : undefined)
                    }}>
                    <option value="">בחר לקוח...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.market === 'חו"ל' ? '🌍' : ''}</option>
                    ))}
                    {onCustomerAdded && <option value="__new__">+ הוסף לקוח חדש</option>}
                  </select>
                )}
              />
              {errors.customer_id && <p className="text-xs text-destructive">{errors.customer_id.message}</p>}
              {addingCustomer && (
                <div className="flex flex-col gap-1.5 mt-1 p-2 border border-green-200 rounded-lg bg-green-50">
                  <input
                    autoFocus
                    type="text"
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomer() } if (e.key === 'Escape') { setAddingCustomer(false); setNewCustomerName('') } }}
                    placeholder="שם לקוח חדש..."
                    className="h-8 rounded-lg border border-green-400 px-2 text-sm outline-none focus:ring-2 focus:ring-green-500/20 bg-white"
                  />
                  <div className="flex gap-1.5">
                    <select value={newCustomerMarket} onChange={e => setNewCustomerMarket(e.target.value)}
                      className="flex-1 h-8 rounded-lg border border-green-300 px-2 text-sm bg-white">
                      <option value="ישראל">ישראל</option>
                      <option value='חו"ל'>חו&quot;ל</option>
                    </select>
                    <button type="button" onClick={handleAddCustomer} disabled={addingCustomerBusy || !newCustomerName.trim()}
                      className="flex-shrink-0 h-8 px-3 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-green-700">
                      {addingCustomerBusy ? '...' : 'שמור'}
                    </button>
                    <button type="button" onClick={() => { setAddingCustomer(false); setNewCustomerName('') }}
                      className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>תאריך הזמנה *</Label>
              <Input type="date" {...register('order_date')} />
              {errors.order_date && <p className="text-xs text-destructive">{errors.order_date.message}</p>}
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>פריטים</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append(emptyItem())}>
                <Plus className="w-3 h-3 ml-1" /> הוסף שורה
              </Button>
            </div>

            {errors.items?.root && (
              <p className="text-xs text-destructive">{errors.items.root.message}</p>
            )}

            <div className="space-y-2">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_80px_75px_68px_68px_2fr_28px] gap-2 text-xs text-muted-foreground px-1">
                <span>גדר</span><span>אורך</span><span>טריות</span><span>כמות</span><span>מחיר</span><span>הערה</span><span></span>
              </div>

              {fields.map((field, idx) => {
                const g  = items?.[idx]?.grade          ?? 'לבן'
                const lt = items?.[idx]?.length_type    ?? 'רגיל'
                const ft = items?.[idx]?.freshness_type ?? 'טרי'
                const available = getAvailableQty(g, lt, ft)
                const rowTotal = (Number(items?.[idx]?.quantity_ordered) || 0) * (Number(items?.[idx]?.unit_price) || 0)

                return (
                  <div key={field.id} className="space-y-1">
                    <div className="grid grid-cols-[2fr_80px_75px_68px_68px_2fr_28px] gap-2 items-center">
                      <select {...register(`items.${idx}.grade`)} className={selectCls}>
                        {NON_REJECT_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>

                      <select {...register(`items.${idx}.length_type`)} className={selectCls}>
                        {LENGTH_TYPES.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>

                      <select {...register(`items.${idx}.freshness_type`)} className={selectCls}>
                        {FRESHNESS_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>

                      <Input
                        type="number"
                        min={1}
                        {...register(`items.${idx}.quantity_ordered`, { valueAsNumber: true })}
                        placeholder="כמות"
                        dir="ltr"
                        className="text-center"
                      />

                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`items.${idx}.unit_price`, { valueAsNumber: true })}
                        placeholder="מחיר"
                        dir="ltr"
                        className="text-center"
                      />

                      <Input {...register(`items.${idx}.notes`)} placeholder="הערה..." />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Available stock + row total */}
                    <div className="grid grid-cols-[2fr_80px_75px_68px_68px_2fr_28px] gap-2 px-1">
                      <span className={`text-xs col-span-3 ${available === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        מלאי זמין: {available.toLocaleString('he-IL')}
                      </span>
                      {rowTotal > 0 && (
                        <span className="text-xs text-muted-foreground col-span-2 text-left">
                          = {currencySymbol}{rowTotal.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>

                    {errors.items?.[idx] && (
                      <p className="text-xs text-destructive px-1">
                        {Object.values(errors.items[idx] ?? {}).map((e) => (e as { message?: string })?.message).filter(Boolean).join(' | ')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes + total */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>הערות</Label>
              <Textarea {...register('notes')} rows={2} placeholder="הערות להזמנה..." />
            </div>
            <div className="flex items-end justify-end">
              {totalAmount > 0 && (
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">סה&quot;כ</p>
                  <p className="text-2xl font-bold">
                    {currencySymbol}{totalAmount.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'שומר...' : order ? 'עדכן' : 'צור הזמנה'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
