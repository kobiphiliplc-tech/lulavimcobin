'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Module = 'receiving' | 'sorting' | 'sales' | 'customers' | 'suppliers' | 'inventory'

interface RecordOption {
  id: string
  label: string
  sublabel?: string
  deep_link_path: string
  record_label: string
}

interface Props {
  onSelect: (data: {
    linked_module: string
    linked_sub_module?: string
    linked_record_id: string
    linked_record_label: string
    linked_deep_link_path: string
    linked_entity_name: string
  }) => void
  onClear: () => void
  currentLabel?: string
}

const MODULE_LABELS: Record<Module, string> = {
  receiving:  'קבלת סחורה',
  sorting:    'מיון',
  sales:      'מכירות',
  customers:  'לקוחות',
  suppliers:  'ספקים',
  inventory:  'מלאי',
}

export function DeepLinkPicker({ onSelect, onClear, currentLabel }: Props) {
  const supabase = createClient()
  const [selectedModule, setSelectedModule] = useState<Module | null>(null)
  const [records, setRecords] = useState<RecordOption[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const fetchRecords = useCallback(async (mod: Module): Promise<RecordOption[]> => {
    switch (mod) {
      case 'receiving': {
        const { data } = await supabase
          .from('receiving_orders')
          .select('id, serial_no, suppliers(name)')
          .order('created_at', { ascending: false })
          .limit(10)
        type ReceivingRow = { id: number; serial_no: string; suppliers?: { name: string } | { name: string }[] | null }
        return ((data ?? []) as unknown as ReceivingRow[]).map(r => ({
          id: String(r.id),
          label: r.serial_no,
          sublabel: Array.isArray(r.suppliers) ? r.suppliers[0]?.name : r.suppliers?.name,
          deep_link_path: `/kabala?highlight=${r.id}`,
          record_label: `קבלת סחורה › ${r.serial_no}`,
        }))
      }
      case 'sorting': {
        const { data } = await supabase
          .from('sorting_events')
          .select('id, sort_serial, sorted_date')
          .order('created_at', { ascending: false })
          .limit(10)
        type SortingRow = { id: number; sort_serial: number; sorted_date: string | null }
        return ((data ?? []) as unknown as SortingRow[]).map(r => ({
          id: String(r.id),
          label: `מיון #${r.sort_serial}`,
          sublabel: r.sorted_date ? new Date(r.sorted_date).toLocaleDateString('he-IL') : undefined,
          deep_link_path: `/miuinim?id=${r.id}`,
          record_label: `מיון › #${r.sort_serial}`,
        }))
      }
      case 'sales': {
        const { data } = await supabase
          .from('sale_orders')
          .select('id, order_date, customers(name)')
          .order('created_at', { ascending: false })
          .limit(10)
        type SalesRow = { id: number; order_date: string | null; customers?: { name: string } | { name: string }[] | null }
        return ((data ?? []) as unknown as SalesRow[]).map(r => {
          const custName = Array.isArray(r.customers) ? r.customers[0]?.name : r.customers?.name
          return {
            id: String(r.id),
            label: custName ?? 'לקוח',
            sublabel: r.order_date ? new Date(r.order_date).toLocaleDateString('he-IL') : undefined,
            deep_link_path: `/malay?order=${r.id}`,
            record_label: `מכירות › ${custName ?? ''}`,
          }
        })
      }
      case 'customers': {
        const { data } = await supabase
          .from('customers')
          .select('id, name')
          .order('name')
          .limit(10)
        type SimpleRow = { id: number; name: string }
        return ((data ?? []) as unknown as SimpleRow[]).map(r => ({
          id: String(r.id),
          label: r.name,
          deep_link_path: `/malay?customer=${r.id}`,
          record_label: `לקוח › ${r.name}`,
        }))
      }
      case 'suppliers': {
        const { data } = await supabase
          .from('suppliers')
          .select('id, name')
          .order('name')
          .limit(10)
        type SimpleRow = { id: number; name: string }
        return ((data ?? []) as unknown as SimpleRow[]).map(r => ({
          id: String(r.id),
          label: r.name,
          deep_link_path: `/suppliers?id=${r.id}`,
          record_label: `ספק › ${r.name}`,
        }))
      }
      case 'inventory': {
        const { data } = await supabase
          .from('inventory')
          .select('id, grade, length_type, freshness_type, quantity')
          .order('grade')
          .limit(10)
        type InvRow = { id: number; grade: string; length_type: string; freshness_type: string; quantity: number }
        return ((data ?? []) as unknown as InvRow[]).map(r => ({
          id: String(r.id),
          label: `${r.grade} ${r.length_type} ${r.freshness_type}`,
          sublabel: `כמות: ${r.quantity}`,
          deep_link_path: `/inventory`,
          record_label: `מלאי › ${r.grade} ${r.length_type}`,
        }))
      }
      default:
        return []
    }
  }, [supabase])

  useEffect(() => {
    if (!selectedModule) return
    setLoading(true)
    fetchRecords(selectedModule).then(r => {
      setRecords(r)
      setLoading(false)
    })
  }, [selectedModule, fetchRecords])

  const filtered = records.filter(r =>
    r.label.includes(search) || (r.sublabel ?? '').includes(search)
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-dashed border-gray-300 rounded-md px-3 py-2 text-sm text-gray-500 hover:border-gray-400 text-right"
      >
        {currentLabel ? (
          <span className="text-gray-700">{currentLabel}</span>
        ) : (
          'בחר רשומה ספציפית...'
        )}
      </button>
    )
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      {/* Module selector */}
      {!selectedModule ? (
        <div className="divide-y divide-gray-100">
          {(Object.entries(MODULE_LABELS) as [Module, string][]).map(([mod, label]) => (
            <button
              key={mod}
              type="button"
              onClick={() => setSelectedModule(mod)}
              className="w-full px-3 py-2.5 text-sm text-right flex items-center justify-between hover:bg-gray-50"
            >
              <span>{label}</span>
              <ChevronLeft className="h-4 w-4 text-gray-400" />
            </button>
          ))}
          {currentLabel && (
            <button type="button" onClick={onClear} className="w-full px-3 py-2 text-sm text-red-500 text-right hover:bg-red-50">
              הסר קישור
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} className="w-full px-3 py-2 text-xs text-gray-400 text-right hover:bg-gray-50">
            ביטול
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
            <button type="button" onClick={() => { setSelectedModule(null); setSearch('') }} className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">{MODULE_LABELS[selectedModule]}</span>
          </div>

          <div className="px-3 py-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute right-2.5 top-2 h-4 w-4 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש..."
                className="w-full border border-gray-200 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">טוען...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">אין תוצאות</div>
            ) : (
              filtered.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onSelect({
                      linked_module: selectedModule,
                      linked_record_id: r.id,
                      linked_record_label: r.record_label,
                      linked_deep_link_path: r.deep_link_path,
                      linked_entity_name: r.label,
                    })
                    setOpen(false)
                    setSelectedModule(null)
                    setSearch('')
                  }}
                  className="w-full px-3 py-2 text-sm text-right hover:bg-green-50 flex flex-col"
                >
                  <span className="font-medium">{r.label}</span>
                  {r.sublabel && <span className="text-xs text-gray-400">{r.sublabel}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
