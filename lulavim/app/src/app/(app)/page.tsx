'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/lib/context/SeasonContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GRADES } from '@/lib/constants'
import type { InventoryRow } from '@/lib/types'
import Link from 'next/link'
import { ArrowDownToLine, SlidersHorizontal, Package, TrendingUp, AlertTriangle } from 'lucide-react'

interface Movement {
  id: number
  movement_date: string
  movement_type: string
  grade_from: string | null
  grade_to: string | null
  quantity: number
  notes: string | null
}

interface Stats {
  totalInventory: number
  pendingKabala: number
  todaySortings: number
  totalSortings: number
}

interface AlertItem {
  type: 'no_field' | 'no_price'
  label: string
  count: number
  href: string
}

export default function DashboardPage() {
  const supabase = createClient()
  const { activeSeason } = useSeason()
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [stats,     setStats]     = useState<Stats | null>(null)
  const [alerts,    setAlerts]    = useState<AlertItem[]>([])
  const [loading,   setLoading]   = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const today = new Date().toLocaleDateString('en-CA')

    const [invRes, movRes, kabRes, sortRes, todaySort, ordRes] = await Promise.all([
      supabase.from('inventory').select('*').eq('season', activeSeason).gt('quantity', 0),
      supabase.from('inventory_movements').select('*').eq('season', activeSeason).order('movement_date', { ascending: false }).limit(5),
      supabase.from('receiving_orders').select('id', { count: 'exact' }).eq('season', activeSeason).eq('status', 'pending'),
      supabase.from('sorting_events').select('id', { count: 'exact' }).eq('season', activeSeason),
      supabase.from('sorting_events').select('id', { count: 'exact' }).eq('season', activeSeason).eq('sorted_date', today),
      supabase.from('receiving_orders').select('id, field_id, total_price, order_type').eq('season', activeSeason),
    ])

    if (invRes.data)  setInventory(invRes.data as InventoryRow[])
    if (movRes.data)  setMovements(movRes.data as Movement[])
    setStats({
      totalInventory: invRes.data?.reduce((s, r) => s + r.quantity, 0) ?? 0,
      pendingKabala:  kabRes.count  ?? 0,
      todaySortings:  todaySort.count ?? 0,
      totalSortings:  sortRes.count  ?? 0,
    })

    // compute alerts
    const newAlerts: AlertItem[] = []

    // lulav receiving orders without field
    const orders = (ordRes.data ?? []) as { id: number; field_id: number | null; total_price: number | null; order_type: string | null }[]
    const lulavOrders = orders.filter(o => (o.order_type ?? '') !== 'אחר')
    const noField = lulavOrders.filter(o => !o.field_id).length
    if (noField > 0) {
      newAlerts.push({ type: 'no_field', label: `${noField} קבלות ללא שדה`, count: noField, href: '/kabala' })
    }
    const noPrice = lulavOrders.filter(o => !o.total_price || o.total_price === 0).length
    if (noPrice > 0) {
      newAlerts.push({ type: 'no_price', label: `${noPrice} קבלות ללא מחיר`, count: noPrice, href: '/kabala' })
    }

    setAlerts(newAlerts)
    setLoading(false)
  }, [supabase, activeSeason])

  useEffect(() => { fetchAll() }, [fetchAll])

  const gradesSummary = GRADES.map(g => ({
    ...g,
    quantity: inventory.filter(r => r.grade === g.name).reduce((s, r) => s + r.quantity, 0),
  })).filter(g => g.quantity > 0)

  const quickLinks = [
    { href: '/miuinim', label: 'מיון חדש',   icon: SlidersHorizontal, color: 'bg-green-50 text-green-700 hover:bg-green-100' },
    { href: '/kabala',  label: 'קבלה חדשה',  icon: ArrowDownToLine,   color: 'bg-blue-50 text-blue-700 hover:bg-blue-100'   },
    { href: '/malay',   label: 'צפה במלאי',  icon: Package,           color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
  ]

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-baseline gap-2">
        <h1 className="text-xl font-bold">דאשבורד</h1>
        <span className="text-sm text-gray-400">עונה {activeSeason}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />) : (
          <>
            <StatCard title="יחידות במלאי"   value={stats?.totalInventory.toLocaleString() ?? '—'} icon={<Package        className="h-5 w-5 text-green-600"  />} />
            <StatCard title="מיונים היום"     value={stats?.todaySortings?.toString()  ?? '—'}      icon={<SlidersHorizontal className="h-5 w-5 text-blue-600"   />} />
            <StatCard title="מיונים סה״כ"     value={stats?.totalSortings?.toString()  ?? '—'}      icon={<TrendingUp     className="h-5 w-5 text-purple-600" />} />
            <StatCard title="קבלות ממתינות"   value={stats?.pendingKabala?.toString()  ?? '—'}      icon={<ArrowDownToLine className="h-5 w-5 text-orange-600" />} />
          </>
        )}
      </div>

      {/* Alerts */}
      {!loading && alerts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> נתונים חסרים ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-2">
              {alerts.map(alert => (
                <Link key={alert.type} href={alert.href}
                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-yellow-200 hover:border-yellow-400 transition-colors">
                  <span className="text-sm text-yellow-900">{alert.label}</span>
                  <span className="text-xs text-yellow-600 hover:underline">עבור לתיקון ›</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* מלאי לפי רמה */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">מלאי לפי רמה</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-32 w-full" /> : gradesSummary.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">המלאי ריק</p>
            ) : (
              <div className="space-y-2">
                {gradesSummary.map(g => (
                  <div key={g.name} className="flex items-center gap-2">
                    <span className="w-16 inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0"
                      style={{ background: g.color, color: g.textColor }}>
                      {g.name}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((g.quantity / (stats?.totalInventory || 1)) * 100, 100)}%`, background: g.color }} />
                    </div>
                    <span className="text-sm font-semibold w-16 text-left">{g.quantity.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* פעולות אחרונות */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">5 פעולות אחרונות</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-32 w-full" /> : movements.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">אין פעולות עדיין</p>
            ) : (
              <div className="space-y-2">
                {movements.map(m => (
                  <div key={m.id} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                    <Badge variant="outline" className="text-xs flex-shrink-0">{m.movement_type}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {m.grade_to && <span>→ <span className="font-medium">{m.grade_to}</span></span>}
                        {m.quantity > 0 && <span className="text-gray-500 mr-1">({m.quantity.toLocaleString()})</span>}
                      </p>
                      {m.notes && <p className="text-xs text-gray-400 truncate">{m.notes}</p>}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(m.movement_date).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        {quickLinks.map(({ href, label, icon: Icon, color }) => (
          <Link key={href} href={href}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg font-medium text-sm transition-colors ${color}`}>
            <Icon className="h-6 w-6" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 font-medium">{title}</span>
          {icon}
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
