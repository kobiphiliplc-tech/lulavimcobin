'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/lib/context/SeasonContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import type { Supplier, ReceivingOrder, SupplierPayment, Field } from '@/lib/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' }
const CURRENCY_NAMES:   Record<string, string> = { ILS: 'שקל', USD: 'דולר', EUR: 'אירו', GBP: 'פאונד' }

function sym(currency: string) { return CURRENCY_SYMBOLS[currency] ?? currency }

function fmt(amount: number, currency = 'ILS') {
  return sym(currency) + Math.abs(amount).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nanToUndef(v: unknown) {
  return typeof v === 'number' && isNaN(v) ? undefined : v
}

const selectCls = "w-full rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm h-8 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 disabled:opacity-50"

// ─── Schemas ──────────────────────────────────────────────────────────────────

const paySchema = z.object({
  payment_date:   z.string().min(1, 'חובה'),
  method:         z.enum(['העברה בנקאית', 'שיק', 'מזומן', 'מטבע חוץ']),
  amount:         z.preprocess(nanToUndef, z.number({ message: 'חובה' }).positive('חייב להיות חיובי')),
  currency:       z.string().default('ILS'),
  check_number:   z.string().optional(),
  check_due_date: z.string().optional(),
  notes:          z.string().optional(),
})
type PayFormData = z.infer<typeof paySchema>

const supSchema = z.object({
  name:          z.string().min(1, 'חובה'),
  contact_phone: z.string().optional(),
  notes:         z.string().optional(),
})
type SupFormData = z.infer<typeof supSchema>

// ─── Per-currency summary ─────────────────────────────────────────────────────

type CurrencyLine = {
  currency: string
  purchases: number
  paidCash: number
  pendingChecksTotal: number
  debt: number
  remaining: number
}

type SupplierSummary = {
  supplier: Supplier
  orders: ReceivingOrder[]
  payments: SupplierPayment[]
  pendingCheckPayments: SupplierPayment[]
  lines: CurrencyLine[]
  settled: boolean
  primaryDebt: number
  primaryCurrency: string
}

function buildSummary(
  supplier: Supplier,
  orders: ReceivingOrder[],
  payments: SupplierPayment[],
  today: string,
): SupplierSummary {
  const supOrders   = orders.filter(o => o.supplier_id === supplier.id)
  const supPayments = payments.filter(p => p.supplier_id === supplier.id)

  const pendingCheckPayments = supPayments.filter(
    p => p.method === 'שיק' && p.check_due_date && p.check_due_date > today
  )
  const cashPayments = supPayments.filter(
    p => !(p.method === 'שיק' && p.check_due_date && p.check_due_date > today)
  )

  const purchasesMap: Record<string, number> = {}
  const paidMap:      Record<string, number> = {}
  const pendingMap:   Record<string, number> = {}

  supOrders.forEach(o => {
    const c = ((o as unknown) as Record<string, unknown>).order_currency as string ?? 'ILS'
    purchasesMap[c] = (purchasesMap[c] ?? 0) + (o.total_price ?? 0)
  })
  cashPayments.forEach(p => {
    const c = p.currency ?? 'ILS'
    paidMap[c] = (paidMap[c] ?? 0) + p.amount
  })
  pendingCheckPayments.forEach(p => {
    const c = p.currency ?? 'ILS'
    pendingMap[c] = (pendingMap[c] ?? 0) + p.amount
  })

  const allCurrencies = Array.from(new Set([
    ...Object.keys(purchasesMap),
    ...Object.keys(paidMap),
    ...Object.keys(pendingMap),
  ]))

  if (allCurrencies.length === 0) allCurrencies.push('ILS')

  const ilsFirst = ['ILS', ...allCurrencies.filter(c => c !== 'ILS')]

  const lines: CurrencyLine[] = ilsFirst
    .filter(c => allCurrencies.includes(c))
    .map(c => {
      const purchases     = purchasesMap[c] ?? 0
      const paidCash      = paidMap[c]      ?? 0
      const pendingChecks = pendingMap[c]   ?? 0
      const debt          = purchases - paidCash
      const remaining     = debt - pendingChecks
      return { currency: c, purchases, paidCash, pendingChecksTotal: pendingChecks, debt, remaining }
    })

  const settled = lines.every(l => l.remaining < 0.01)

  const ilsLine = lines.find(l => l.currency === 'ILS')
  const primaryDebt = ilsLine ? Math.max(0, ilsLine.remaining) : 0
  const primaryCurrency = ilsLine ? 'ILS' : (lines[0]?.currency ?? 'ILS')

  return {
    supplier, orders: supOrders, payments: supPayments, pendingCheckPayments,
    lines, settled, primaryDebt, primaryCurrency,
  }
}

// ─── SupplierCard ─────────────────────────────────────────────────────────────

function SupplierCard({
  summary, expanded, onToggle, onPaymentSaved, today, season, fields, onFieldsChanged, onEdit, onDelete,
}: {
  summary: SupplierSummary
  expanded: boolean
  onToggle: () => void
  onPaymentSaved: () => void
  today: string
  season: string
  fields: Field[]
  onFieldsChanged: () => void
  onEdit: (supplier: Supplier) => void
  onDelete: (supplier: Supplier, hasDebt: boolean) => void
}) {
  const supabase = createClient()
  const { supplier, orders, payments, pendingCheckPayments, lines, settled } = summary

  const [activeTab,       setActiveTab]       = useState('payments')
  const [showPayForm,     setShowPayForm]     = useState(false)
  const [editingPayment,  setEditingPayment]  = useState<SupplierPayment | null>(null)
  const [selectedPay,     setSelectedPay]     = useState<Set<number>>(new Set())

  // ── field management state ──
  const [addingField,      setAddingField]      = useState(false)
  const [newFieldName,     setNewFieldName]     = useState('')
  const [editingFieldId,   setEditingFieldId]   = useState<number | null>(null)
  const [editingFieldName, setEditingFieldName] = useState('')
  const [fieldBusy,        setFieldBusy]        = useState(false)
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<number>>(new Set())

  // ── confirm states ──
  const [deleteFieldConfirm,       setDeleteFieldConfirm]       = useState<number | null>(null)
  const [deleteBulkFieldsConfirm,  setDeleteBulkFieldsConfirm]  = useState(false)
  const [deletePaymentConfirm,     setDeletePaymentConfirm]     = useState<number | null>(null)
  const [deleteBulkPaymentsConfirm,setDeleteBulkPaymentsConfirm]= useState(false)

  const myFields = fields.filter(f => f.supplier_id === supplier.id)

  async function addField() {
    const existingNames = new Set(myFields.map(f => f.name.trim().toLowerCase()))
    const allNames = newFieldName.split('\n').map(n => n.trim()).filter(Boolean)
    const dupes = allNames.filter(n => existingNames.has(n.toLowerCase()))
    const names = allNames.filter(n => !existingNames.has(n.toLowerCase()))
    if (dupes.length > 0 && names.length === 0) {
      toast.error(`כל השמות כבר קיימים: ${dupes.join(', ')}`)
      return
    }
    if (names.length === 0) return
    setFieldBusy(true)
    const { error } = await supabase.from('fields').insert(names.map(name => ({ name, supplier_id: supplier.id })))
    setFieldBusy(false)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    if (dupes.length > 0) toast.error(`כבר קיים: ${dupes.join(', ')}`)
    toast.success(names.length === 1 ? `חלקה "${names[0]}" נוספה` : `${names.length} חלקות נוספו`)
    setNewFieldName('')
    setAddingField(false)
    onFieldsChanged()
  }

  const pendingFieldCount = useMemo(() => {
    const existingNames = new Set(myFields.map(f => f.name.trim().toLowerCase()))
    return newFieldName.split('\n').map(n => n.trim()).filter(n => n && !existingNames.has(n.toLowerCase())).length
  }, [newFieldName, myFields])

  async function saveFieldName(id: number) {
    const name = editingFieldName.trim()
    if (!name) return
    setFieldBusy(true)
    const { error } = await supabase.from('fields').update({ name }).eq('id', id)
    setFieldBusy(false)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    setEditingFieldId(null)
    onFieldsChanged()
  }

  async function detachAndDeleteFields(ids: number[]) {
    await supabase.from('receiving_orders').update({ field_id: null }).in('field_id', ids)
    await supabase.from('sorting_events').update({ field_id: null }).in('field_id', ids)
    const { error } = await supabase.from('fields').delete().in('id', ids)
    return error
  }

  async function deleteField(id: number) {
    setDeleteFieldConfirm(id)
  }

  async function doDeleteField(id: number) {
    setDeleteFieldConfirm(null)
    setFieldBusy(true)
    const error = await detachAndDeleteFields([id])
    setFieldBusy(false)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    toast.success('חלקה נמחקה')
    setSelectedFieldIds(prev => { const n = new Set(prev); n.delete(id); return n })
    onFieldsChanged()
  }

  async function deleteBulkFields() {
    if (selectedFieldIds.size === 0) return
    setDeleteBulkFieldsConfirm(true)
  }

  async function doDeleteBulkFields() {
    const ids = Array.from(selectedFieldIds)
    setDeleteBulkFieldsConfirm(false)
    setFieldBusy(true)
    const error = await detachAndDeleteFields(ids)
    setFieldBusy(false)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    toast.success(`${ids.length} חלקות נמחקו`)
    setSelectedFieldIds(new Set())
    onFieldsChanged()
  }

  const { register: regPay, handleSubmit: hsPay, watch: watchPay, reset: resetPay,
    formState: { errors: payErrors, isSubmitting: paySubmitting } } = useForm<PayFormData>({
    resolver: zodResolver(paySchema) as Resolver<PayFormData>,
    defaultValues: { payment_date: today, method: 'העברה בנקאית', currency: 'ILS' },
  })
  const payMethod = watchPay('method')

  function openPayForm(existing?: SupplierPayment) {
    setEditingPayment(existing ?? null)
    resetPay(existing ? {
      payment_date:   existing.payment_date,
      method:         existing.method as PayFormData['method'],
      amount:         existing.amount,
      currency:       existing.currency ?? 'ILS',
      check_number:   existing.check_number  ?? undefined,
      check_due_date: existing.check_due_date ?? undefined,
      notes:          existing.notes          ?? undefined,
    } : { payment_date: today, method: 'העברה בנקאית', currency: 'ILS' })
    setShowPayForm(true)
  }

  async function onPaySubmit(data: PayFormData) {
    const payload = {
      payment_date:   data.payment_date,
      method:         data.method,
      amount:         data.amount,
      currency:       data.currency ?? 'ILS',
      check_number:   data.check_number   || null,
      check_due_date: data.check_due_date || null,
      notes:          data.notes          || null,
    }
    const { error } = editingPayment
      ? await supabase.from('supplier_payments').update(payload).eq('id', editingPayment.id)
      : await supabase.from('supplier_payments').insert({ ...payload, supplier_id: supplier.id, season })
    if (error) {
      if (error.code === '42P01') toast.error('טבלת תשלומים חסרה — הרץ את ה-SQL migration')
      else toast.error('שגיאה בשמירת תשלום: ' + error.message)
      return
    }
    toast.success(editingPayment ? 'תשלום עודכן' : 'תשלום נשמר')
    setShowPayForm(false)
    setEditingPayment(null)
    onPaymentSaved()
  }

  async function deletePayment(id: number) {
    setDeletePaymentConfirm(id)
  }

  async function doDeletePayment(id: number) {
    setDeletePaymentConfirm(null)
    const { error } = await supabase.from('supplier_payments').delete().eq('id', id)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    toast.success('תשלום נמחק')
    setSelectedPay(prev => { const n = new Set(prev); n.delete(id); return n })
    onPaymentSaved()
  }

  async function deleteSelectedPayments() {
    if (selectedPay.size === 0) return
    setDeleteBulkPaymentsConfirm(true)
  }

  async function doDeleteSelectedPayments() {
    setDeleteBulkPaymentsConfirm(false)
    const { error } = await supabase.from('supplier_payments').delete().in('id', Array.from(selectedPay))
    if (error) { toast.error('שגיאה: ' + error.message); return }
    toast.success(`${selectedPay.size} תשלומים נמחקו`)
    setSelectedPay(new Set())
    onPaymentSaved()
  }

  function togglePaySel(id: number) {
    setSelectedPay(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) } return n })
  }

  const ilsLine    = lines.find(l => l.currency === 'ILS')
  const otherLines = lines.filter(l => l.currency !== 'ILS')

  return (
    <>
      <div className={cn('relative group rounded-xl border bg-white overflow-hidden transition-shadow', expanded && 'shadow-md border-gray-300')}>
        {/* Collapsed row */}
        <button
          type="button"
          className="w-full flex items-stretch cursor-pointer select-none hover:bg-gray-50 transition-colors text-right"
          onClick={onToggle}
        >
          <div className="flex items-center justify-center px-3 text-gray-400 flex-shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </div>
          <div className="flex-1 py-3 px-2">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold text-base text-gray-900">{supplier.name}</span>
              {orders.length === 0 && payments.length === 0 ? (
                <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">לא פעיל</span>
              ) : settled ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">שולם ✓</span>
              ) : (
                <>
                  {ilsLine && ilsLine.remaining >= 0.01 && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                      חוב: {fmt(ilsLine.remaining)}
                    </span>
                  )}
                  {otherLines.filter(l => l.remaining >= 0.01).map(l => (
                    <span key={l.currency} className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                      חוב: {fmt(l.remaining, l.currency)}
                    </span>
                  ))}
                </>
              )}
            </div>
            <div className="flex gap-3 flex-wrap text-xs text-gray-400">
              <span>{orders.length} קבלות</span>
              {ilsLine && (
                <>
                  <span>סה״כ רכישות: <span className="text-gray-600">{fmt(ilsLine.purchases)}</span></span>
                  <span>שולם: <span className="text-green-700 font-medium">{fmt(ilsLine.paidCash)}</span></span>
                  {ilsLine.pendingChecksTotal > 0 && (
                    <span>שיק דחוי: <span className="text-orange-500 font-medium">{fmt(ilsLine.pendingChecksTotal)}</span></span>
                  )}
                </>
              )}
              {otherLines.map(l => (
                <span key={l.currency} className="text-purple-600 font-medium">
                  {CURRENCY_NAMES[l.currency] ?? l.currency}: {fmt(l.purchases, l.currency)}
                </span>
              ))}
            </div>
          </div>
        </button>

        {/* Edit / Delete buttons — always visible, float over the card row */}
        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onEdit(supplier) }}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
            title="עריכת ספק"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(supplier, !summary.settled) }}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 hover:text-red-600 hover:border-red-300 transition-colors"
            title="מחיקת ספק"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t px-4 pb-4 pt-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-3">
                <TabsTrigger value="payments">תשלומים</TabsTrigger>
                <TabsTrigger value="orders">קבלות סחורה</TabsTrigger>
                <TabsTrigger value="checks">שיקים עתידיים</TabsTrigger>
                <TabsTrigger value="fields">חלקות</TabsTrigger>
              </TabsList>

              {/* ── תשלומים ── */}
              <TabsContent value="payments">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">היסטוריית תשלומים</p>
                  <div className="flex items-center gap-2">
                    {selectedPay.size > 0 && (
                      <button
                        type="button"
                        className="h-7 text-xs px-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium flex items-center gap-1"
                        onClick={deleteSelectedPayments}
                      >
                        מחק {selectedPay.size} נבחרים
                      </button>
                    )}
                    {!showPayForm && (
                      <button
                        type="button"
                        className="h-7 text-xs px-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium flex items-center gap-1"
                        onClick={() => openPayForm()}
                      >
                        <Plus className="h-3 w-3" /> תשלום חדש
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline payment form */}
                {showPayForm && (
                  <div className="rounded-lg border border-green-200 bg-green-50/40 p-4 mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      {editingPayment ? 'עריכת תשלום' : 'תשלום חדש'}
                    </p>
                    <form onSubmit={hsPay(onPaySubmit)} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-600">תאריך *</label>
                          <input type="date" className={selectCls} {...regPay('payment_date')} />
                          {payErrors.payment_date && <p className="text-xs text-red-500">{payErrors.payment_date.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-600">אמצעי תשלום *</label>
                          <select className={selectCls} {...regPay('method')}>
                            <option value="העברה בנקאית">העברה בנקאית</option>
                            <option value="שיק">שיק</option>
                            <option value="מזומן">מזומן</option>
                            <option value="מטבע חוץ">מטבע חוץ</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-600">סכום *</label>
                          <input type="number" step="0.01" className={selectCls} {...regPay('amount', { valueAsNumber: true })} />
                          {payErrors.amount && <p className="text-xs text-red-500">{payErrors.amount.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-600">מטבע</label>
                          <select className={selectCls} {...regPay('currency')}>
                            <option value="ILS">₪ שקל</option>
                            <option value="USD">$ דולר</option>
                            <option value="EUR">€ אירו</option>
                            <option value="GBP">£ פאונד</option>
                          </select>
                        </div>
                      </div>
                      {payMethod === 'שיק' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">מספר שיק</label>
                            <input className={selectCls} {...regPay('check_number')} placeholder="123456" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">תאריך פירעון</label>
                            <input type="date" className={selectCls} {...regPay('check_due_date')} />
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">הערות</label>
                        <textarea className="w-full rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50" rows={2} {...regPay('notes')} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={paySubmitting}
                          className="h-8 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50"
                        >
                          {paySubmitting ? 'שומר...' : 'שמור תשלום'}
                        </button>
                        <button
                          type="button"
                          className="h-8 px-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium"
                          onClick={() => setShowPayForm(false)}
                        >
                          ביטול
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {payments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">אין תשלומים עדיין</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden mb-3">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="p-2 w-8">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5"
                              checked={selectedPay.size === payments.length && payments.length > 0}
                              onChange={e => setSelectedPay(e.target.checked ? new Set(payments.map(p => p.id)) : new Set())}
                            />
                          </th>
                          <th className="text-right p-2 font-medium">תאריך</th>
                          <th className="text-right p-2 font-medium">אמצעי תשלום</th>
                          <th className="text-right p-2 font-medium">סכום</th>
                          <th className="p-2 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.id} className={cn('border-b last:border-0 hover:bg-gray-50', selectedPay.has(p.id) && 'bg-blue-50')}>
                            <td className="p-2">
                              <input type="checkbox" className="h-3.5 w-3.5" checked={selectedPay.has(p.id)} onChange={() => togglePaySel(p.id)} />
                            </td>
                            <td className="p-2 text-gray-600 text-xs">
                              {new Date(p.payment_date).toLocaleDateString('he-IL')}
                            </td>
                            <td className="p-2">
                              <span>{p.method}</span>
                              {p.currency !== 'ILS' && (
                                <span className="text-xs text-purple-600 font-medium mr-1">({p.currency})</span>
                              )}
                              {p.check_number && (
                                <span className="text-xs text-gray-400 mr-1">#{p.check_number}</span>
                              )}
                            </td>
                            <td className="p-2 font-medium">{fmt(p.amount, p.currency)}</td>
                            <td className="p-2">
                              <div className="flex gap-1 justify-end">
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-gray-200 text-gray-500"
                                  title="עריכה"
                                  onClick={() => openPayForm(p)}
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-red-100 text-red-400"
                                  title="מחיקה"
                                  onClick={() => deletePayment(p.id)}
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Per-currency summary */}
                <div className="space-y-2">
                  {lines.map(l => (
                    <div key={l.currency} className="rounded-lg bg-gray-50 border p-3 space-y-1.5 text-sm">
                      {lines.length > 1 && (
                        <p className="text-xs font-semibold text-gray-400 mb-2">
                          {CURRENCY_NAMES[l.currency] ?? l.currency} ({sym(l.currency)})
                        </p>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">חוב כולל</span>
                        <span className="text-red-600 font-medium">{fmt(Math.max(0, l.debt), l.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">שולם</span>
                        <span className="text-green-700 font-medium">{fmt(l.paidCash, l.currency)}</span>
                      </div>
                      {l.pendingChecksTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">שיק דחוי</span>
                          <span className="text-orange-500 font-medium">{fmt(l.pendingChecksTotal, l.currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold border-t pt-1.5">
                        <span>נותר לסידור</span>
                        <span className={l.remaining > 0 ? 'text-red-600' : 'text-green-700'}>
                          {fmt(Math.max(0, l.remaining), l.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* ── קבלות סחורה ── */}
              <TabsContent value="orders">
                {orders.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">אין קבלות</p>
                ) : (
                  <>
                    <div className="rounded-lg border overflow-hidden mb-3">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-right p-2 font-medium">תאריך</th>
                            <th className="text-right p-2 font-medium">מס׳ קבלה</th>
                            <th className="text-right p-2 font-medium">שדה / כמות</th>
                            <th className="text-right p-2 font-medium">סכום</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...orders]
                            .sort((a, b) => b.received_date.localeCompare(a.received_date))
                            .map(o => {
                              const net  = Math.max(0, (o.total_quantity ?? 0) - o.returns_quantity)
                              const price = o.total_price ?? 0
                              const curr  = ((o as unknown) as Record<string, unknown>).order_currency as string ?? 'ILS'
                              return (
                                <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                                  <td className="p-2 text-gray-500 text-xs">
                                    {new Date(o.received_date).toLocaleDateString('he-IL')}
                                  </td>
                                  <td className="p-2 font-mono font-semibold">{o.serial_no}</td>
                                  <td className="p-2 text-gray-600">
                                    {((o as unknown) as { fields?: { name: string } }).fields?.name ?? '—'}
                                    {net > 0 && <span className="text-xs text-gray-400 mr-1">· {net.toLocaleString()}</span>}
                                  </td>
                                  <td className="p-2 font-medium">
                                    {price > 0 ? fmt(price, curr) : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-2">
                      {lines.map(l => {
                        const allPaid = l.paidCash + l.pendingChecksTotal
                        const ratio = l.purchases > 0 ? allPaid / l.purchases : 0
                        const statusLabel = ratio >= 1 ? 'שולם' : ratio > 0 ? 'חלקי' : 'טרם שולם'
                        const statusCls   = ratio >= 1
                          ? 'bg-green-100 text-green-700'
                          : ratio > 0 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-600'
                        return (
                          <div key={l.currency} className="rounded-lg bg-gray-50 border p-3 text-sm">
                            {lines.length > 1 && (
                              <p className="text-xs font-semibold text-gray-400 mb-2">
                                {CURRENCY_NAMES[l.currency] ?? l.currency}
                              </p>
                            )}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex gap-3 text-xs flex-wrap">
                                <span>סה״כ: <strong>{fmt(l.purchases, l.currency)}</strong></span>
                                <span>שולם: <strong className="text-green-700">{fmt(l.paidCash, l.currency)}</strong></span>
                                {l.pendingChecksTotal > 0 && (
                                  <span>שיק דחוי: <strong className="text-orange-500">{fmt(l.pendingChecksTotal, l.currency)}</strong></span>
                                )}
                                <span>חוב: <strong className={l.remaining > 0 ? 'text-red-600' : 'text-green-700'}>
                                  {fmt(Math.max(0, l.remaining), l.currency)}
                                </strong></span>
                              </div>
                              <span className={cn('text-xs px-2 py-0.5 rounded-full', statusCls)}>{statusLabel}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ── שיקים עתידיים ── */}
              <TabsContent value="checks">
                {pendingCheckPayments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">אין שיקים עתידיים</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-right p-2 font-medium">תאריך פירעון</th>
                          <th className="text-right p-2 font-medium">מספר שיק</th>
                          <th className="text-right p-2 font-medium">סכום</th>
                          <th className="text-right p-2 font-medium">סטטוס</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingCheckPayments.map(p => {
                          const daysUntil = Math.ceil(
                            (new Date(p.check_due_date!).getTime() - new Date(today).getTime()) / 86400000
                          )
                          return (
                            <React.Fragment key={p.id}>
                              <tr className="border-b hover:bg-gray-50">
                                <td className="p-2 text-gray-600">
                                  {new Date(p.check_due_date!).toLocaleDateString('he-IL')}
                                </td>
                                <td className="p-2 font-mono">{p.check_number ?? '—'}</td>
                                <td className="p-2 font-medium text-orange-600">{fmt(p.amount, p.currency)}</td>
                                <td className="p-2">
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">ממתין</span>
                                </td>
                              </tr>
                              {daysUntil <= 7 && (
                                <tr className="bg-amber-50 border-b">
                                  <td colSpan={4} className="px-3 py-1.5 text-xs text-amber-700">
                                    ⚠ שיק יפרע בעוד {daysUntil} ימים
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
              {/* ── חלקות ── */}
              <TabsContent value="fields">
                <div className="space-y-1">
                  {/* bulk action bar */}
                  {myFields.length > 0 && (
                    <div className="flex items-center gap-2 pb-1 mb-1 border-b border-gray-100">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-green-600 cursor-pointer"
                        checked={myFields.length > 0 && myFields.every(f => selectedFieldIds.has(f.id))}
                        onChange={e => setSelectedFieldIds(e.target.checked ? new Set(myFields.map(f => f.id)) : new Set())}
                      />
                      <span className="text-xs text-gray-400 flex-1">
                        {selectedFieldIds.size > 0 ? `${selectedFieldIds.size} נבחרו` : 'בחר הכל'}
                      </span>
                      {selectedFieldIds.size > 0 && (
                        <button type="button" onClick={deleteBulkFields} disabled={fieldBusy}
                          className="flex-shrink-0 h-7 px-2 bg-red-500 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-red-600">
                          {fieldBusy ? '...' : `מחק ${selectedFieldIds.size}`}
                        </button>
                      )}
                    </div>
                  )}
                  {myFields.length === 0 && !addingField && (
                    <p className="text-sm text-gray-400 text-center py-4">אין חלקות משויכות לספק זה</p>
                  )}
                  {myFields.map(field => (
                    <div key={field.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group min-w-0">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-green-600 cursor-pointer flex-shrink-0"
                        checked={selectedFieldIds.has(field.id)}
                        onChange={e => setSelectedFieldIds(prev => {
                          const n = new Set(prev)
                          if (e.target.checked) { n.add(field.id) } else { n.delete(field.id) }
                          return n
                        })}
                      />
                      {editingFieldId === field.id ? (
                        <>
                          <input
                            autoFocus
                            className="flex-1 min-w-0 h-8 rounded-lg border border-green-400 px-2 text-sm outline-none focus:ring-2 focus:ring-green-500/20 bg-white"
                            value={editingFieldName}
                            onChange={e => setEditingFieldName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveFieldName(field.id) }
                              if (e.key === 'Escape') setEditingFieldId(null)
                            }}
                          />
                          <button type="button" disabled={fieldBusy} onClick={() => saveFieldName(field.id)}
                            className="flex-shrink-0 h-8 px-2 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-green-700">
                            {fieldBusy ? '...' : 'שמור'}
                          </button>
                          <button type="button" onClick={() => setEditingFieldId(null)}
                            className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600">
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium text-gray-800">{field.name}</span>
                          {field.short_code && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 rounded">{field.short_code}</span>}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button"
                              onClick={() => { setEditingFieldId(field.id); setEditingFieldName(field.name) }}
                              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600" title="עריכה">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteField(field.id)}
                              className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500" title="מחק חלקה">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {addingField ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        autoFocus
                        value={newFieldName}
                        onChange={e => setNewFieldName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') { setAddingField(false); setNewFieldName('') }
                          if (e.key === 'Enter') e.stopPropagation()
                        }}
                        placeholder={'חלקה א׳\nחלקה ב׳\nחלקה ג׳'}
                        rows={3}
                        className="w-full rounded-lg border border-green-400 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500/20 bg-white resize-none"
                      />
                      <div className="flex gap-1">
                        <button type="button" onClick={addField} disabled={fieldBusy || pendingFieldCount === 0}
                          className="flex-shrink-0 h-8 px-3 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-green-700">
                          {fieldBusy ? '...' : pendingFieldCount > 1 ? `הוסף ${pendingFieldCount} חלקות` : 'הוסף חלקה'}
                        </button>
                        <button type="button" onClick={() => { setAddingField(false); setNewFieldName('') }}
                          className="flex-shrink-0 h-8 px-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 text-xs">
                          ביטול
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setAddingField(true)}
                      className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium px-1">
                      <Plus className="h-3.5 w-3.5" /> הוסף חלקה
                    </button>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteFieldConfirm !== null}
        title="מחיקת חלקה"
        message="למחוק חלקה זו לצמיתות?"
        onConfirm={() => deleteFieldConfirm !== null && doDeleteField(deleteFieldConfirm)}
        onCancel={() => setDeleteFieldConfirm(null)}
      />
      <ConfirmDialog
        open={deleteBulkFieldsConfirm}
        title="מחיקת חלקות"
        message={`למחוק ${selectedFieldIds.size} חלקות לצמיתות?`}
        onConfirm={doDeleteBulkFields}
        onCancel={() => setDeleteBulkFieldsConfirm(false)}
      />
      <ConfirmDialog
        open={deletePaymentConfirm !== null}
        title="מחיקת תשלום"
        message="למחוק תשלום זה?"
        onConfirm={() => deletePaymentConfirm !== null && doDeletePayment(deletePaymentConfirm)}
        onCancel={() => setDeletePaymentConfirm(null)}
      />
      <ConfirmDialog
        open={deleteBulkPaymentsConfirm}
        title="מחיקת תשלומים"
        message={`למחוק ${selectedPay.size} תשלומים?`}
        onConfirm={doDeleteSelectedPayments}
        onCancel={() => setDeleteBulkPaymentsConfirm(false)}
      />
    </>
  )
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function SuppliersInner() {
  const supabase = createClient()
  const { activeSeason } = useSeason()
  const searchParams = useSearchParams()
  const autoExpandId = searchParams.get('id') ? Number(searchParams.get('id')) : null

  const [suppliers,   setSuppliers]   = useState<Supplier[]>([])
  const [orders,      setOrders]      = useState<ReceivingOrder[]>([])
  const [payments,    setPayments]    = useState<SupplierPayment[]>([])
  const [fields,      setFields]      = useState<Field[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expandedId,  setExpandedId]  = useState<number | null>(autoExpandId)
  const [supDialogOpen, setSupDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [unassignedOpen, setUnassignedOpen] = useState(false)
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<number>>(new Set())

  // ── delete confirm states ──
  const [deleteSupplierConfirm, setDeleteSupplierConfirm] = useState<{ supplier: Supplier; hasDebt: boolean } | null>(null)
  const [deleteSupplierFieldsConfirm, setDeleteSupplierFieldsConfirm] = useState<{ supplier: Supplier; fieldCount: number } | null>(null)
  const [deleteUnassignedConfirm, setDeleteUnassignedConfirm] = useState<number | null>(null)
  const [deleteBulkUnassignedConfirm, setDeleteBulkUnassignedConfirm] = useState(false)

  const today = todayISO()

  const { register: regSup, handleSubmit: hsSup, reset: resetSup,
    formState: { errors: supErrors, isSubmitting: supSubmitting } } = useForm<SupFormData>({
    resolver: zodResolver(supSchema),
  })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [supRes, ordRes, payRes, fldRes] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('receiving_orders').select('*, fields(name)').eq('season', activeSeason),
      supabase.from('supplier_payments').select('*').eq('season', activeSeason)
        .order('payment_date', { ascending: false }),
      supabase.from('fields').select('*').order('name'),
    ])
    if (supRes.data && !supRes.error) setSuppliers(supRes.data)
    if (ordRes.data  && !ordRes.error) setOrders(ordRes.data as ReceivingOrder[])
    if (payRes.data  && !payRes.error) setPayments(payRes.data as SupplierPayment[])
    if (fldRes.data  && !fldRes.error) setFields(fldRes.data)
    if (ordRes.error) console.error('[suppliers] orders error:', ordRes.error.message)
    if (payRes.error) {
      console.error('[suppliers] payments error:', payRes.error.message)
      if (payRes.error.message.includes('supplier_payments') || payRes.error.code === '42P01') {
        toast.error('טבלת תשלומים חסרה — הרץ את ה-SQL migration ב-Supabase')
      }
    }
    setLoading(false)
  }, [supabase, activeSeason]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

  const summaries = useMemo<SupplierSummary[]>(() => {
    return suppliers
      .map(s => buildSummary(s, orders, payments, today))
  }, [suppliers, orders, payments, today])

  const globalDebt = useMemo(() => {
    const map: Record<string, number> = {}
    summaries.forEach(s => s.lines.forEach(l => {
      if (l.remaining > 0) map[l.currency] = (map[l.currency] ?? 0) + l.remaining
    }))
    return map
  }, [summaries])

  const globalPendingChecks = useMemo(() => {
    const map: Record<string, number> = {}
    summaries.forEach(s => s.lines.forEach(l => {
      if (l.pendingChecksTotal > 0) map[l.currency] = (map[l.currency] ?? 0) + l.pendingChecksTotal
    }))
    return map
  }, [summaries])

  const suppliersWithDebt = summaries.filter(s => !s.settled).length
  const pendingCheckCount = summaries.reduce((n, s) => n + s.pendingCheckPayments.length, 0)

  function openNewSupplier() {
    setEditingSupplier(null)
    resetSup({ name: '', contact_phone: '', notes: '' })
    setSupDialogOpen(true)
  }

  function openEditSupplier(supplier: Supplier) {
    setEditingSupplier(supplier)
    resetSup({ name: supplier.name, contact_phone: supplier.contact_phone ?? '', notes: supplier.notes ?? '' })
    setSupDialogOpen(true)
  }

  async function onSupSubmit(data: SupFormData) {
    if (editingSupplier) {
      const { error } = await supabase.from('suppliers').update({
        name:          data.name,
        contact_phone: data.contact_phone || null,
        notes:         data.notes         || null,
      }).eq('id', editingSupplier.id)
      if (error) { toast.error('שגיאה: ' + error.message); return }
      toast.success('ספק עודכן')
    } else {
      const trimmedName = data.name.trim()
      const { data: existing } = await supabase
        .from('suppliers')
        .select('id')
        .eq('name', trimmedName)
        .maybeSingle()
      if (existing) { toast.error('ספק עם שם זה כבר קיים'); return }
      const { error } = await supabase.from('suppliers').insert({
        name:          trimmedName,
        contact_phone: data.contact_phone || null,
        notes:         data.notes         || null,
      })
      if (error) { toast.error('שגיאה: ' + error.message); return }
      toast.success('ספק נוסף')
    }
    setSupDialogOpen(false)
    setEditingSupplier(null)
    resetSup()
    fetchAll()
  }

  async function detachAndDeleteFields(ids: number[]) {
    await supabase.from('receiving_orders').update({ field_id: null }).in('field_id', ids)
    await supabase.from('sorting_events').update({ field_id: null }).in('field_id', ids)
    return (await supabase.from('fields').delete().in('id', ids)).error
  }

  async function deleteUnassignedField(id: number) {
    setDeleteUnassignedConfirm(id)
  }

  async function doDeleteUnassignedField(id: number) {
    setDeleteUnassignedConfirm(null)
    const error = await detachAndDeleteFields([id])
    if (error) { toast.error('שגיאה: ' + error.message); return }
    toast.success('חלקה נמחקה')
    setSelectedUnassigned(prev => { const n = new Set(prev); n.delete(id); return n })
    fetchAll()
  }

  async function deleteBulkUnassigned() {
    if (selectedUnassigned.size === 0) return
    setDeleteBulkUnassignedConfirm(true)
  }

  async function doDeleteBulkUnassigned() {
    const ids = Array.from(selectedUnassigned)
    setDeleteBulkUnassignedConfirm(false)
    const error = await detachAndDeleteFields(ids)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    toast.success(`${ids.length} חלקות נמחקו`)
    setSelectedUnassigned(new Set())
    fetchAll()
  }

  async function handleDeleteSupplier(supplier: Supplier, hasDebt: boolean) {
    setDeleteSupplierConfirm({ supplier, hasDebt })
  }

  async function doDeleteSupplierStep1() {
    if (!deleteSupplierConfirm) return
    const { supplier } = deleteSupplierConfirm
    setDeleteSupplierConfirm(null)
    const supplierFields = fields.filter(f => f.supplier_id === supplier.id)
    if (supplierFields.length > 0) {
      setDeleteSupplierFieldsConfirm({ supplier, fieldCount: supplierFields.length })
    } else {
      await doDeleteSupplierFinal(supplier, false)
    }
  }

  async function doDeleteSupplierFinal(supplier: Supplier, deleteFields: boolean) {
    setDeleteSupplierFieldsConfirm(null)
    if (deleteFields) {
      await supabase.from('fields').delete().eq('supplier_id', supplier.id)
    } else {
      await supabase.from('fields').update({ supplier_id: null }).eq('supplier_id', supplier.id)
    }
    const { error } = await supabase.from('suppliers').delete().eq('id', supplier.id)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    toast.success(`ספק "${supplier.name}" נמחק`)
    if (expandedId === supplier.id) setExpandedId(null)
    fetchAll()
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">ספקים</h1>
          <p className="text-xs text-gray-400 mt-0.5">{summaries.length} ספקים · עונה {activeSeason}</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700" onClick={openNewSupplier}>
          <Plus className="h-4 w-4 ml-1" /> ספק חדש
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-red-100 bg-red-50/60">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">סה״כ חוב לספקים</p>
            <p className="text-3xl font-bold text-red-600">
              {globalDebt['ILS'] ? fmt(globalDebt['ILS']) : '₪0'}
            </p>
            {Object.entries(globalDebt).filter(([c]) => c !== 'ILS').map(([c, v]) => (
              <p key={c} className="text-sm font-semibold text-red-500 mt-0.5">{fmt(v, c)}</p>
            ))}
            <p className="text-xs text-gray-400 mt-1">{suppliersWithDebt} ספקים עם יתרה</p>
          </CardContent>
        </Card>
        <Card className="border-orange-100 bg-orange-50/60">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">שיקים עתידיים</p>
            <p className="text-3xl font-bold text-orange-500">
              {globalPendingChecks['ILS'] ? fmt(globalPendingChecks['ILS']) : '₪0'}
            </p>
            {Object.entries(globalPendingChecks).filter(([c]) => c !== 'ILS').map(([c, v]) => (
              <p key={c} className="text-sm font-semibold text-orange-400 mt-0.5">{fmt(v, c)}</p>
            ))}
            <p className="text-xs text-gray-400 mt-1">{pendingCheckCount} שיקים ממתינים</p>
          </CardContent>
        </Card>
      </div>

      {/* Supplier cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>אין ספקים פעילים בעונה {activeSeason}</p>
          <p className="text-xs mt-1">הוסף קבלת סחורה עם ספק כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map(s => (
            <SupplierCard
              key={s.supplier.id}
              summary={s}
              expanded={expandedId === s.supplier.id}
              onToggle={() => setExpandedId(expandedId === s.supplier.id ? null : s.supplier.id)}
              onPaymentSaved={fetchAll}
              today={today}
              season={activeSeason}
              fields={fields}
              onFieldsChanged={fetchAll}
              onEdit={openEditSupplier}
              onDelete={handleDeleteSupplier}
            />
          ))}
        </div>
      )}

      {/* ── Unassigned fields panel ── */}
      {fields.some(f => f.supplier_id === null) && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors text-right"
            onClick={() => setUnassignedOpen(v => !v)}
          >
            {unassignedOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronLeft className="h-4 w-4 text-gray-400" />}
            <span className="font-medium text-sm text-gray-700">חלקות ללא ספק</span>
            <span className="text-xs text-gray-400">({fields.filter(f => f.supplier_id === null).length})</span>
          </button>
          {unassignedOpen && (() => {
            const unassigned = fields.filter(f => f.supplier_id === null)
            const allSelected = unassigned.length > 0 && unassigned.every(f => selectedUnassigned.has(f.id))
            return (
              <div className="border-t px-4 pb-4 pt-3 space-y-1">
                {/* bulk bar */}
                <div className="flex items-center gap-2 pb-1 mb-1 border-b border-gray-100">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-green-600 cursor-pointer"
                    checked={allSelected}
                    onChange={e => setSelectedUnassigned(e.target.checked ? new Set(unassigned.map(f => f.id)) : new Set())}
                  />
                  <span className="text-xs text-gray-400 flex-1">
                    {selectedUnassigned.size > 0 ? `${selectedUnassigned.size} נבחרו` : 'בחר הכל'}
                  </span>
                  {selectedUnassigned.size > 0 && (
                    <button type="button" onClick={deleteBulkUnassigned}
                      className="flex-shrink-0 h-7 px-2 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600">
                      מחק {selectedUnassigned.size}
                    </button>
                  )}
                </div>
                {unassigned.map(field => (
                  <div key={field.id} className="flex items-center gap-2 py-1.5 group">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-green-600 cursor-pointer flex-shrink-0"
                      checked={selectedUnassigned.has(field.id)}
                      onChange={e => setSelectedUnassigned(prev => {
                        const n = new Set(prev)
                        if (e.target.checked) { n.add(field.id) } else { n.delete(field.id) }
                        return n
                      })}
                    />
                    <span className="flex-1 text-sm font-medium text-gray-700">{field.name}</span>
                    <select
                      className="rounded-lg border border-input bg-transparent px-2 py-1 text-xs h-7 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                      defaultValue=""
                      onChange={async e => {
                        const sid = Number(e.target.value)
                        if (!sid) return
                        const { error } = await supabase.from('fields').update({ supplier_id: sid }).eq('id', field.id)
                        if (error) { toast.error('שגיאה: ' + error.message); return }
                        toast.success('חלקה שויכה לספק')
                        setSelectedUnassigned(prev => { const n = new Set(prev); n.delete(field.id); return n })
                        fetchAll()
                      }}
                    >
                      <option value="">שייך לספק...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button type="button" onClick={() => deleteUnassignedField(field.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-opacity" title="מחק">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Supplier delete confirm dialogs ── */}
      <ConfirmDialog
        open={!!deleteSupplierConfirm}
        title="מחיקת ספק"
        message={deleteSupplierConfirm
          ? <>
              <span>{`למחוק את הספק "${deleteSupplierConfirm.supplier.name}"? פעולה זו אינה הפיכה.`}</span>
              {deleteSupplierConfirm.hasDebt && <span className="block mt-1 text-red-600 font-medium">⚠ לספק זה יש חוב פתוח — המחיקה תאבד את כל ההיסטוריה!</span>}
            </>
          : ''}
        onConfirm={doDeleteSupplierStep1}
        onCancel={() => setDeleteSupplierConfirm(null)}
      />
      <ConfirmDialog
        open={!!deleteSupplierFieldsConfirm}
        title="מחיקת חלקות הספק"
        message={deleteSupplierFieldsConfirm
          ? `לספק "${deleteSupplierFieldsConfirm.supplier.name}" יש ${deleteSupplierFieldsConfirm.fieldCount} חלקות. אישור — תמחק אותן. ביטול — תשאיר ללא שיוך.`
          : ''}
        confirmLabel="מחק חלקות"
        cancelLabel="השאר ללא שיוך"
        onConfirm={() => deleteSupplierFieldsConfirm && doDeleteSupplierFinal(deleteSupplierFieldsConfirm.supplier, true)}
        onCancel={() => deleteSupplierFieldsConfirm && doDeleteSupplierFinal(deleteSupplierFieldsConfirm.supplier, false)}
      />

      <ConfirmDialog
        open={deleteUnassignedConfirm !== null}
        title="מחיקת חלקה"
        message="למחוק חלקה זו לצמיתות?"
        onConfirm={() => deleteUnassignedConfirm !== null && doDeleteUnassignedField(deleteUnassignedConfirm)}
        onCancel={() => setDeleteUnassignedConfirm(null)}
      />
      <ConfirmDialog
        open={deleteBulkUnassignedConfirm}
        title="מחיקת חלקות"
        message={`למחוק ${selectedUnassigned.size} חלקות לצמיתות?`}
        onConfirm={doDeleteBulkUnassigned}
        onCancel={() => setDeleteBulkUnassignedConfirm(false)}
      />

      {/* ── New / Edit supplier dialog ── */}
      <Dialog open={supDialogOpen} onOpenChange={open => { setSupDialogOpen(open); if (!open) setEditingSupplier(null) }}>
        <DialogContent className="sm:max-w-sm bg-white text-gray-900" dir="rtl">
          <DialogHeader><DialogTitle>{editingSupplier ? 'עריכת ספק' : 'ספק חדש'}</DialogTitle></DialogHeader>
          <form onSubmit={hsSup(onSupSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>שם ספק *</Label>
              <Input {...regSup('name')} />
              {supErrors.name && <p className="text-xs text-red-500">{supErrors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>טלפון</Label>
              <Input {...regSup('contact_phone')} placeholder="050-1234567" />
            </div>
            <div className="space-y-1">
              <Label>הערות</Label>
              <Textarea {...regSup('notes')} rows={2} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={supSubmitting} className="bg-green-600 hover:bg-green-700">
                {supSubmitting ? 'שומר...' : editingSupplier ? 'שמור שינויים' : 'הוסף ספק'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setSupDialogOpen(false); setEditingSupplier(null) }}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  return (
    <Suspense>
      <SuppliersInner />
    </Suspense>
  )
}
