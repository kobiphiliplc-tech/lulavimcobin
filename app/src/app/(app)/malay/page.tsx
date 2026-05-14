'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/lib/context/SeasonContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, CreditCard, ChevronDown, ChevronUp } from 'lucide-react'
import { SaleOrderForm, type SaleOrderFormData } from '@/components/malay/SaleOrderForm'
import { CustomerFormDialog } from '@/components/malay/CustomerFormDialog'
import { PaymentFormDialog, type PaymentFormData } from '@/components/malay/PaymentFormDialog'
import type { Customer, SaleOrder, CustomerPayment, InventoryRow } from '@/lib/types'

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין', ready: 'מוכן', packed: 'ארוז', shipped: 'נשלח', cancelled: 'בוטל',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  ready:   'bg-blue-100 text-blue-800',
  packed:  'bg-purple-100 text-purple-800',
  shipped: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
}
const STATUS_ORDER = ['pending', 'ready', 'packed', 'shipped', 'cancelled']
const CURRENCY_SYM: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' }

function sym(c: string) { return CURRENCY_SYM[c] ?? c }

function fmt(amount: number, currency = 'ILS') {
  return sym(currency) + Math.abs(amount).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

type MarketFilter = 'הכל' | 'ישראל' | 'חו"ל'

// ─── OrderRow ──────────────────────────────────────────────────────────────────

function OrderRow({
  order, payments, customers, onEdit, onPayment, onDelete, onStatusChange,
}: {
  order: SaleOrder
  payments: CustomerPayment[]
  customers: Customer[]
  onEdit: (o: SaleOrder) => void
  onPayment: (o: SaleOrder) => void
  onDelete: (o: SaleOrder) => void
  onStatusChange: (o: SaleOrder, status: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const customer = customers.find(c => c.id === order.customer_id)
  const orderPayments = payments.filter(p => p.order_id === order.id)
  const paid = orderPayments.reduce((s, p) => s + p.amount, 0)
  const total = order.total_amount ?? 0
  const remaining = total - paid

  const items = order.sale_order_items ?? []
  const itemSummary = items.map(i => `${i.grade} ${i.length_type} ${i.freshness_type} ×${i.quantity_ordered}`).join(', ')

  return (
    <>
      <tr
        className="border-b hover:bg-muted/30 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-3 py-2 font-medium">
          <div className="flex items-center gap-1">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {customer?.name ?? '—'}
          </div>
          {customer?.market === 'חו"ל' && (
            <span className="text-xs text-muted-foreground">חו&quot;ל</span>
          )}
        </td>
        <td className="px-3 py-2 text-sm text-muted-foreground">{order.order_date}</td>
        <td className="px-3 py-2 text-sm max-w-[200px] truncate" title={itemSummary}>{itemSummary || '—'}</td>
        <td className="px-3 py-2 text-sm font-medium">
          {total > 0 ? fmt(total, order.currency) : '—'}
        </td>
        <td className="px-3 py-2 text-sm text-green-700">
          {paid > 0 ? fmt(paid, order.currency) : '—'}
        </td>
        <td className={`px-3 py-2 text-sm font-medium ${remaining > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
          {remaining > 0 ? fmt(remaining, order.currency) : '—'}
        </td>
        <td className="px-3 py-2">
          <select
            value={order.status}
            onClick={e => e.stopPropagation()}
            onChange={e => onStatusChange(order, e.target.value)}
            className={`rounded px-1.5 py-0.5 text-xs border-0 cursor-pointer ${STATUS_COLORS[order.status] ?? ''}`}
          >
            {STATUS_ORDER.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(order)} title="ערוך">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPayment(order)} title="תשלום">
              <CreditCard className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(order)} title="מחק">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-muted/20 border-b">
          <td colSpan={8} className="px-4 py-3">
            <div className="space-y-2">
              {items.length === 0 && <p className="text-sm text-muted-foreground">אין פריטים</p>}
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_80px_80px_80px_80px_1fr] gap-2 text-sm items-center">
                  <span className="font-medium">{item.grade}</span>
                  <span className="text-muted-foreground">{item.length_type}</span>
                  <span className="text-muted-foreground">{item.freshness_type}</span>
                  <span>הוזמן: {item.quantity_ordered}</span>
                  <span className={item.quantity_ready < item.quantity_ordered ? 'text-orange-600' : 'text-green-600'}>
                    מוכן: {item.quantity_ready}
                  </span>
                  <span className="text-purple-600">ארוז: {item.quantity_packed}</span>
                  <span className="text-muted-foreground">
                    {item.unit_price ? fmt(item.unit_price, order.currency) + '/יח׳' : ''}
                    {item.total_price ? ` = ${fmt(item.total_price, order.currency)}` : ''}
                  </span>
                </div>
              ))}

              {orderPayments.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">תשלומים:</p>
                  {orderPayments.map(p => (
                    <div key={p.id} className="text-xs text-muted-foreground">
                      {p.payment_date} — {p.method} — {fmt(p.amount, p.currency)}
                      {p.notes ? ` (${p.notes})` : ''}
                    </div>
                  ))}
                </div>
              )}

              {order.notes && (
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">הערה: {order.notes}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MalayPage() {
  const supabase = createClient()
  const { activeSeason } = useSeason()

  const [orders,    setOrders]    = useState<SaleOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [payments,  setPayments]  = useState<CustomerPayment[]>([])
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading,   setLoading]   = useState(true)

  const [activeTab,    setActiveTab]    = useState('orders')
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('הכל')

  const [orderDialog,     setOrderDialog]     = useState(false)
  const [editingOrder,    setEditingOrder]     = useState<SaleOrder | null>(null)
  const [customerDialog,  setCustomerDialog]  = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [paymentDialog,   setPaymentDialog]   = useState(false)
  const [payingOrder,     setPayingOrder]     = useState<SaleOrder | null>(null)
  const [deleteConfirm,   setDeleteConfirm]   = useState<SaleOrder | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordersRes, customersRes, paymentsRes, inventoryRes] = await Promise.all([
      supabase
        .from('sale_orders')
        .select('*, sale_order_items(*), customers(name, market)')
        .eq('season', activeSeason)
        .order('order_date', { ascending: false }),
      supabase.from('customers').select('*').order('name'),
      supabase.from('customer_payments').select('*').eq('season', activeSeason),
      supabase.from('inventory').select('*').eq('season', activeSeason).gt('quantity', 0),
    ])
    if (ordersRes.data)    setOrders(ordersRes.data as SaleOrder[])
    if (customersRes.data) setCustomers(customersRes.data as Customer[])
    if (paymentsRes.data)  setPayments(paymentsRes.data as CustomerPayment[])
    if (inventoryRes.data) setInventory(inventoryRes.data as InventoryRow[])
    setLoading(false)
  }, [supabase, activeSeason])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filteredOrders = orders.filter(o => {
    if (marketFilter === 'הכל') return true
    const customer = customers.find(c => c.id === o.customer_id)
    return customer?.market === marketFilter
  })

  const ilsOrders = filteredOrders.filter(o => o.currency === 'ILS')
  const totalAmount  = ilsOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const totalPaid    = payments
    .filter(p => p.currency === 'ILS' && ilsOrders.some(o => o.id === p.order_id))
    .reduce((s, p) => s + p.amount, 0)
  const totalDebt    = totalAmount - totalPaid
  const pendingCount = orders.filter(o => o.status === 'pending' || o.status === 'ready' || o.status === 'packed').length

  // ── Save order ────────────────────────────────────────────────────────────────

  async function handleSaveOrder(data: SaleOrderFormData) {
    const customer = customers.find(c => c.id === data.customer_id)
    const currency = customer?.currency ?? 'ILS'

    const total = data.items.reduce((s, item) => {
      return s + (Number(item.quantity_ordered) || 0) * (Number(item.unit_price) || 0)
    }, 0)

    if (editingOrder) {
      const { error: orderErr } = await supabase
        .from('sale_orders')
        .update({ customer_id: data.customer_id, order_date: data.order_date, notes: data.notes ?? null, currency, total_amount: total || null })
        .eq('id', editingOrder.id)
      if (orderErr) { toast.error('שגיאה בעדכון הזמנה'); return }

      await supabase.from('sale_order_items').delete().eq('order_id', editingOrder.id)
      const itemRows = data.items.map(item => ({
        order_id: editingOrder.id,
        grade: item.grade,
        length_type: item.length_type,
        freshness_type: item.freshness_type,
        quantity_ordered: item.quantity_ordered,
        quantity_ready: 0,
        quantity_packed: 0,
        unit_price: item.unit_price ?? null,
        total_price: (Number(item.quantity_ordered) || 0) * (Number(item.unit_price) || 0) || null,
        notes: item.notes ?? null,
      }))
      const { error: itemsErr } = await supabase.from('sale_order_items').insert(itemRows)
      if (itemsErr) { toast.error('שגיאה בשמירת פריטים'); return }
      toast.success('הזמנה עודכנה')
    } else {
      const { data: newOrder, error: orderErr } = await supabase
        .from('sale_orders')
        .insert({ season: activeSeason, customer_id: data.customer_id, order_date: data.order_date, notes: data.notes ?? null, currency, total_amount: total || null, status: 'pending' })
        .select('id')
        .single()
      if (orderErr || !newOrder) { toast.error('שגיאה ביצירת הזמנה'); return }

      const itemRows = data.items.map(item => ({
        order_id: newOrder.id,
        grade: item.grade,
        length_type: item.length_type,
        freshness_type: item.freshness_type,
        quantity_ordered: item.quantity_ordered,
        quantity_ready: 0,
        quantity_packed: 0,
        unit_price: item.unit_price ?? null,
        total_price: (Number(item.quantity_ordered) || 0) * (Number(item.unit_price) || 0) || null,
        notes: item.notes ?? null,
      }))
      const { error: itemsErr } = await supabase.from('sale_order_items').insert(itemRows)
      if (itemsErr) { toast.error('שגיאה בשמירת פריטים'); return }
      toast.success('הזמנה נוצרה')
    }

    setEditingOrder(null)
    setOrderDialog(false)
    fetchData()
  }

  // ── Quick add customer from sale form ────────────────────────────────────────

  async function handleQuickAddCustomer(name: string, market: string): Promise<Customer | null> {
    const currency = market === 'חו"ל' ? 'USD' : 'ILS'
    const { data, error } = await supabase
      .from('customers')
      .insert({ name, market, currency })
      .select()
      .single()
    if (error || !data) { toast.error('שגיאה בהוספת לקוח: ' + error?.message); return null }
    setCustomers(prev => [...prev, data as Customer].sort((a, b) => a.name.localeCompare(b.name, 'he')))
    toast.success(`לקוח "${name}" נוסף`)
    return data as Customer
  }

  // ── Save customer ─────────────────────────────────────────────────────────────

  async function handleSaveCustomer(data: { name: string; phone?: string; market: 'ישראל' | 'חו"ל'; currency: 'ILS' | 'USD' | 'EUR'; notes?: string }) {
    if (editingCustomer) {
      const { error } = await supabase.from('customers').update({ ...data, phone: data.phone || null, notes: data.notes || null }).eq('id', editingCustomer.id)
      if (error) { toast.error('שגיאה בעדכון לקוח'); return }
      toast.success('לקוח עודכן')
    } else {
      const { error } = await supabase.from('customers').insert({ ...data, phone: data.phone || null, notes: data.notes || null })
      if (error) { toast.error('שגיאה בשמירת לקוח'); return }
      toast.success('לקוח נוסף')
    }
    setEditingCustomer(null)
    setCustomerDialog(false)
    fetchData()
  }

  // ── Save payment ──────────────────────────────────────────────────────────────

  async function handleSavePayment(data: PaymentFormData) {
    const { error } = await supabase.from('customer_payments').insert({
      customer_id:    data.customer_id,
      order_id:       payingOrder?.id ?? null,
      season:         activeSeason,
      payment_date:   data.payment_date,
      method:         data.method,
      amount:         data.amount,
      currency:       data.currency,
      check_number:   data.check_number ?? null,
      check_due_date: data.check_due_date ?? null,
      notes:          data.notes ?? null,
    })
    if (error) { toast.error('שגיאה בשמירת תשלום'); return }
    toast.success('תשלום נרשם')
    setPayingOrder(null)
    setPaymentDialog(false)
    fetchData()
  }

  // ── Status change ─────────────────────────────────────────────────────────────

  async function handleStatusChange(order: SaleOrder, status: string) {
    const { error } = await supabase.from('sale_orders').update({ status }).eq('id', order.id)
    if (error) { toast.error('שגיאה בעדכון סטטוס'); return }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: status as SaleOrder['status'] } : o))
  }

  // ── Delete order ──────────────────────────────────────────────────────────────

  async function handleDeleteOrder(order: SaleOrder) {
    const { error } = await supabase.from('sale_orders').delete().eq('id', order.id)
    if (error) { toast.error('שגיאה במחיקה'); return }
    toast.success('הזמנה נמחקה')
    setDeleteConfirm(null)
    fetchData()
  }

  // ── Delete customer ───────────────────────────────────────────────────────────

  async function handleDeleteCustomer(customer: Customer) {
    const hasOrders = orders.some(o => o.customer_id === customer.id)
    if (hasOrders) { toast.error('לא ניתן למחוק לקוח עם הזמנות בעונה'); return }
    const { error } = await supabase.from('customers').delete().eq('id', customer.id)
    if (error) { toast.error('שגיאה במחיקה'); return }
    toast.success('לקוח נמחק')
    fetchData()
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">מכירות</h1>
        <Button onClick={() => { setEditingOrder(null); setOrderDialog(true) }}>
          <Plus className="w-4 h-4 ml-1" /> הזמנה חדשה
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders">הזמנות</TabsTrigger>
          <TabsTrigger value="customers">לקוחות</TabsTrigger>
        </TabsList>

        {/* ── Orders Tab ──────────────────────────────────────────────────────── */}
        <TabsContent value="orders" className="space-y-4">

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">סה&quot;כ הזמנות</p>
              {loading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                <p className="text-xl font-bold">{fmt(totalAmount)}</p>
              )}
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">סה&quot;כ שולם</p>
              {loading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                <p className="text-xl font-bold text-green-700">{fmt(totalPaid)}</p>
              )}
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">יתרת גבייה</p>
              {loading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                <p className={`text-xl font-bold ${totalDebt > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{fmt(totalDebt)}</p>
              )}
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">פתוחות</p>
              {loading ? <Skeleton className="h-7 w-12 mt-1" /> : (
                <p className="text-xl font-bold">{pendingCount}</p>
              )}
            </CardContent></Card>
          </div>

          {/* Market filter */}
          <div className="flex gap-2">
            {(['הכל', 'ישראל', 'חו"ל'] as MarketFilter[]).map(m => (
              <Button
                key={m}
                variant={marketFilter === m ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMarketFilter(m)}
              >{m}</Button>
            ))}
          </div>

          {/* Orders table */}
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">אין הזמנות</p>
              <Button className="mt-3" onClick={() => { setEditingOrder(null); setOrderDialog(true) }}>
                <Plus className="w-4 h-4 ml-1" /> הזמנה ראשונה
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">לקוח</th>
                    <th className="px-3 py-2 text-right font-medium">תאריך</th>
                    <th className="px-3 py-2 text-right font-medium">פירוט</th>
                    <th className="px-3 py-2 text-right font-medium">סה&quot;כ</th>
                    <th className="px-3 py-2 text-right font-medium">שולם</th>
                    <th className="px-3 py-2 text-right font-medium">חסר</th>
                    <th className="px-3 py-2 text-right font-medium">סטטוס</th>
                    <th className="px-3 py-2 text-right font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      payments={payments}
                      customers={customers}
                      onEdit={o => { setEditingOrder(o); setOrderDialog(true) }}
                      onPayment={o => { setPayingOrder(o); setPaymentDialog(true) }}
                      onDelete={o => setDeleteConfirm(o)}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Customers Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingCustomer(null); setCustomerDialog(true) }}>
              <Plus className="w-4 h-4 ml-1" /> לקוח חדש
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : customers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">אין לקוחות רשומים</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">שם</th>
                    <th className="px-3 py-2 text-right font-medium">טלפון</th>
                    <th className="px-3 py-2 text-right font-medium">שוק</th>
                    <th className="px-3 py-2 text-right font-medium">מטבע</th>
                    <th className="px-3 py-2 text-right font-medium">הזמנות בעונה</th>
                    <th className="px-3 py-2 text-right font-medium">סה&quot;כ</th>
                    <th className="px-3 py-2 text-right font-medium">שולם</th>
                    <th className="px-3 py-2 text-right font-medium">יתרה</th>
                    <th className="px-3 py-2 text-right font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => {
                    const custOrders   = orders.filter(o => o.customer_id === customer.id)
                    const custPayments = payments.filter(p => p.customer_id === customer.id)
                    const custTotal    = custOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
                    const custPaid     = custPayments.reduce((s, p) => s + p.amount, 0)
                    const custDebt     = custTotal - custPaid

                    return (
                      <tr key={customer.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{customer.name}</td>
                        <td className="px-3 py-2 text-muted-foreground" dir="ltr">{customer.phone ?? '—'}</td>
                        <td className="px-3 py-2">{customer.market}</td>
                        <td className="px-3 py-2">{customer.currency}</td>
                        <td className="px-3 py-2">{custOrders.length}</td>
                        <td className="px-3 py-2">{custTotal > 0 ? fmt(custTotal, customer.currency) : '—'}</td>
                        <td className="px-3 py-2 text-green-700">{custPaid > 0 ? fmt(custPaid, customer.currency) : '—'}</td>
                        <td className={`px-3 py-2 font-medium ${custDebt > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {custDebt > 0 ? fmt(custDebt, customer.currency) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCustomer(customer); setCustomerDialog(true) }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteCustomer(customer)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      <SaleOrderForm
        open={orderDialog}
        onClose={() => { setOrderDialog(false); setEditingOrder(null) }}
        onSave={handleSaveOrder}
        customers={customers}
        inventory={inventory}
        order={editingOrder}
        onCustomerAdded={handleQuickAddCustomer}
      />

      <CustomerFormDialog
        open={customerDialog}
        onClose={() => { setCustomerDialog(false); setEditingCustomer(null) }}
        onSave={handleSaveCustomer}
        customer={editingCustomer}
      />

      <PaymentFormDialog
        open={paymentDialog}
        onClose={() => { setPaymentDialog(false); setPayingOrder(null) }}
        onSave={handleSavePayment}
        customers={customers}
        defaultCustomerId={payingOrder?.customer_id}
        defaultCurrency={payingOrder?.currency}
        orderId={payingOrder?.id}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>מחיקת הזמנה</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            האם למחוק את ההזמנה של {customers.find(c => c.id === deleteConfirm?.customer_id)?.name ?? 'הלקוח'}?
            פעולה זו לא ניתנת לביטול.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>ביטול</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDeleteOrder(deleteConfirm)}>מחק</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
