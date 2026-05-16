'use client'

import { useState, useMemo } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import type { ReceivingOrder, Supplier, Field } from '@/lib/types'

type SortDir = 'asc' | 'desc'

type SortingEventSummary = {
  id: number
  receiving_serial: string | null
  warehouse_code: string | null
  sorting_quantities: { quantity: number }[] | null
}

type StatusInfo = { label: string; style: CSSProperties }

interface RowData {
  order: ReceivingOrder & { warehouse_code?: string | null }
  supplier: string
  field: string
  net: number
  status: StatusInfo
  priceStr: string
}

const COLS: { key: string; label: string; sortable: boolean; filterable: boolean }[] = [
  { key: 'serial',    label: 'מס׳ קבלה',  sortable: true,  filterable: false },
  { key: 'warehouse', label: 'מח׳',        sortable: true,  filterable: true  },
  { key: 'date',      label: 'תאריך',      sortable: true,  filterable: true  },
  { key: 'supplier',  label: 'ספק',        sortable: true,  filterable: true  },
  { key: 'field',     label: 'שדה',        sortable: true,  filterable: true  },
  { key: 'length',    label: 'אורך',       sortable: true,  filterable: true  },
  { key: 'freshness', label: 'טריות',      sortable: true,  filterable: true  },
  { key: 'qty',       label: 'כמות',       sortable: true,  filterable: false },
  { key: 'returns',   label: 'חזרות',      sortable: true,  filterable: false },
  { key: 'net',       label: 'סה״כ',       sortable: true,  filterable: false },
  { key: 'category',  label: 'קטגוריה',    sortable: true,  filterable: true  },
  { key: 'status',    label: 'סטטוס מיון', sortable: true,  filterable: true  },
  { key: 'price',     label: 'סה״כ מחיר', sortable: true,  filterable: false },
  { key: 'actions',   label: '',           sortable: false, filterable: false },
]

const STATUS_BASE: CSSProperties = { borderRadius: 9999, padding: '1px 8px', fontSize: 11, whiteSpace: 'nowrap' }

function calcStatus(order: ReceivingOrder, net: number, events: SortingEventSummary[]): StatusInfo {
  const matched = events.filter(e =>
    e.warehouse_code === order.serial_no || e.receiving_serial === order.serial_no
  )
  const sorted = matched.reduce((s, e) => s + (e.sorting_quantities ?? []).reduce((a, q) => a + q.quantity, 0), 0)
  if (matched.length === 0)
    return { label: 'לא מויין', style: { ...STATUS_BASE, background: '#f3f4f6', color: '#4b5563' } }
  if (order.status === 'sorted' || (net > 0 && sorted >= net))
    return { label: `מויין מלא — ${sorted.toLocaleString()}`, style: { ...STATUS_BASE, background: '#dcfce7', color: '#166534' } }
  return { label: `מויין חלקי — ${sorted.toLocaleString()}/${net.toLocaleString()}`, style: { ...STATUS_BASE, background: '#fef9c3', color: '#92400e' } }
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function getColValue(key: string, row: RowData): string {
  switch (key) {
    case 'serial':    return row.order.serial_no
    case 'warehouse': return row.order.warehouse_code ?? ''
    case 'date':      return fmtDate(row.order.received_date)
    case 'supplier':  return row.supplier
    case 'field':     return row.field
    case 'length':    return row.order.length_type
    case 'freshness': return row.order.freshness_type
    case 'qty':       return String(row.order.total_quantity ?? 0)
    case 'returns':   return String(row.order.returns_quantity)
    case 'net':       return String(row.net)
    case 'category':  return row.order.category ?? ''
    case 'status':    return row.status.label
    case 'price':     return row.priceStr
    default:          return ''
  }
}

interface Props {
  orders: ReceivingOrder[]
  suppliers: Supplier[]
  fields: Field[]
  sortingEvents: SortingEventSummary[]
  loading?: boolean
  onEdit: (order: ReceivingOrder) => void
  onDelete: (order: ReceivingOrder) => void
}

export function KabalaTable({ orders, suppliers, fields, sortingEvents, loading, onEdit, onDelete }: Props) {
  const [sortCol,      setSortCol]      = useState<string | null>(null)
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')
  const [colFilters,   setColFilters]   = useState<Record<string, string[]>>({})
  const [openFilter,   setOpenFilter]   = useState<{ key: string; x: number; y: number } | null>(null)
  const [filterSearch, setFilterSearch] = useState('')

  function toggleSort(key: string) {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  function toggleFilterValue(key: string, val: string) {
    setColFilters(prev => {
      const current = prev[key] ?? []
      const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val]
      if (next.length === 0) { const copy = { ...prev }; delete copy[key]; return copy }
      return { ...prev, [key]: next }
    })
  }

  const baseRows = useMemo<RowData[]>(() =>
    (orders as (ReceivingOrder & { warehouse_code?: string | null })[]).map(o => {
      const net     = Math.max(0, (o.total_quantity ?? 0) - o.returns_quantity)
      const curr    = o.order_currency ?? 'ILS'
      const sym     = ({ ILS: '₪', USD: '$', EUR: '€', GBP: '£' } as Record<string, string>)[curr] ?? curr
      const priceStr = o.total_price
        ? `${sym}${o.total_price.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`
        : '—'
      return {
        order:    o,
        supplier: suppliers.find(s => s.id === o.supplier_id)?.name ?? o.suppliers?.name ?? '—',
        field:    fields.find(f => f.id === o.field_id)?.name ?? o.fields?.name ?? '—',
        net,
        status:   calcStatus(o, net, sortingEvents),
        priceStr,
      }
    }),
  [orders, suppliers, fields, sortingEvents])

  function getUniqueVals(colKey: string): string[] {
    const vals = new Set<string>()
    for (const row of baseRows) vals.add(getColValue(colKey, row))
    return Array.from(vals).sort((a, b) => a.localeCompare(b, 'he'))
  }

  const rows = useMemo<RowData[]>(() => {
    const filtered = baseRows.filter(row =>
      Object.entries(colFilters).every(([key, vals]) =>
        !vals.length || vals.includes(getColValue(key, row))
      )
    )
    if (!sortCol) return filtered
    return [...filtered].sort((a, b) => {
      let av: string | number | null = null
      let bv: string | number | null = null
      if      (sortCol === 'serial')    { av = a.order.serial_no;             bv = b.order.serial_no             }
      else if (sortCol === 'warehouse') { av = a.order.warehouse_code ?? '';  bv = b.order.warehouse_code ?? ''  }
      else if (sortCol === 'date')      { av = a.order.received_date;         bv = b.order.received_date         }
      else if (sortCol === 'supplier')  { av = a.supplier;                    bv = b.supplier                    }
      else if (sortCol === 'field')     { av = a.field;                       bv = b.field                       }
      else if (sortCol === 'length')    { av = a.order.length_type;           bv = b.order.length_type           }
      else if (sortCol === 'freshness') { av = a.order.freshness_type;        bv = b.order.freshness_type        }
      else if (sortCol === 'qty')       { av = a.order.total_quantity ?? 0;   bv = b.order.total_quantity ?? 0   }
      else if (sortCol === 'returns')   { av = a.order.returns_quantity;      bv = b.order.returns_quantity      }
      else if (sortCol === 'net')       { av = a.net;                         bv = b.net                         }
      else if (sortCol === 'category')  { av = a.order.category ?? '';        bv = b.order.category ?? ''        }
      else if (sortCol === 'status')    { av = a.status.label;                bv = b.status.label                }
      else if (sortCol === 'price')     { av = a.order.total_price ?? 0;      bv = b.order.total_price ?? 0      }
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [baseRows, colFilters, sortCol, sortDir])

  const totals = useMemo(() => {
    let totalQty = 0, totalNet = 0
    for (const r of rows) { totalQty += r.order.total_quantity ?? 0; totalNet += r.net }
    return { totalQty, totalNet }
  }, [rows])

  // ── styles (identical to SortingTable) ────────────────────────────────────
  const thBase: CSSProperties = {
    padding: '7px 10px', textAlign: 'right',
    borderBottom: '1px solid #e5e7eb', color: '#111827',
    fontWeight: 500, whiteSpace: 'nowrap', userSelect: 'none',
    position: 'sticky', top: 0, background: '#f9fafb', zIndex: 10,
  }
  const tdStyle: CSSProperties = { padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }

  const sortIcon = (key: string) => (
    <span style={{ fontSize: 9, lineHeight: 1, color: sortCol === key ? '#16a34a' : '#d1d5db', marginRight: 1 }}>
      {sortCol === key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )

  const filterTrigger = (col: { key: string; filterable: boolean }) => {
    if (!col.filterable) return null
    const hasFilter = (colFilters[col.key]?.length ?? 0) > 0
    return (
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          if (openFilter?.key !== col.key) setFilterSearch('')
          setOpenFilter(f => f?.key === col.key ? null : { key: col.key, x: rect.left, y: rect.bottom + 4 })
        }}
        style={{
          background: hasFilter ? '#dcfce7' : 'none',
          border: hasFilter ? '1px solid #86efac' : 'none',
          borderRadius: 4, cursor: 'pointer', padding: '0 3px', lineHeight: 1.4,
          color: hasFilter ? '#16a34a' : '#d1d5db', fontSize: 11,
        }}
      >
        {hasFilter ? `▾ ${colFilters[col.key].length}` : '▾'}
      </button>
    )
  }

  const activeFilterCount = Object.keys(colFilters).length

  if (!loading && orders.length === 0) {
    return <p style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>אין קבלות להצגה</p>
  }

  return (
    <div dir="rtl">
      {/* toolbar */}
      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setColFilters({})}
            style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #fed7aa', borderRadius: 6, background: '#fff7ed', color: '#c2410c', cursor: 'pointer' }}
          >
            נקה סינונים ({activeFilterCount})
          </button>
        </div>
      )}

      {/* table */}
      <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {COLS.map(col => (
                <th key={col.key} style={thBase}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.sortable
                      ? <span onClick={() => toggleSort(col.key)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                          {col.label} {sortIcon(col.key)}
                        </span>
                      : <span>{col.label}</span>
                    }
                    {filterTrigger(col)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {COLS.map((_, j) => (
                      <td key={j} style={tdStyle}>
                        <div style={{ height: 14, background: '#f3f4f6', borderRadius: 4, width: '80%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map(({ order: o, supplier, field, net, status, priceStr }) => {
                  const isMissing = !o.field_id || !o.total_price || o.total_price === 0
                  return (
                    <tr key={o.id} style={{ background: isMissing ? '#fefce8' : '#fff' }}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>{o.serial_no}</td>
                      <td style={tdStyle}>
                        {o.warehouse_code
                          ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{o.warehouse_code}</span>
                          : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, color: '#6b7280' }}>{fmtDate(o.received_date)}</td>
                      <td style={tdStyle}>
                        {o.supplier_id
                          ? <Link href={`/suppliers?id=${o.supplier_id}`} style={{ color: '#15803d' }}>{supplier}</Link>
                          : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={tdStyle}>{field}</td>
                      <td style={tdStyle}>{o.length_type}</td>
                      <td style={tdStyle}>{o.freshness_type}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{o.total_quantity?.toLocaleString() ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{(o.returns_quantity || 0).toLocaleString()}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, textAlign: 'center' }}>{net.toLocaleString()}</td>
                      <td style={{ ...tdStyle, fontSize: 11 }}>{o.category ?? '—'}</td>
                      <td style={tdStyle}>
                        <span style={status.style}>{status.label}</span>
                      </td>
                      <td style={tdStyle}>{priceStr}</td>
                      <td style={{ ...tdStyle, padding: '4px 6px' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button onClick={() => onEdit(o)} title="עריכה"
                            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => onDelete(o)} title="מחיקה"
                            style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f3f4f6', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
                <td style={{ ...tdStyle, color: '#374151' }} colSpan={7}>{`סה"כ (${rows.length})`}</td>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#374151' }}>{totals.totalQty.toLocaleString()}</td>
                <td style={tdStyle} />
                <td style={{ ...tdStyle, textAlign: 'center', color: '#374151' }}>{totals.totalNet.toLocaleString()}</td>
                <td style={tdStyle} colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* filter popup */}
      {openFilter && (() => {
        const colDef = COLS.find(c => c.key === openFilter.key)!
        const uniq   = getUniqueVals(openFilter.key)
        const visible = filterSearch.trim()
          ? uniq.filter(v => v.toLowerCase().includes(filterSearch.trim().toLowerCase()))
          : uniq
        const active      = colFilters[openFilter.key] ?? []
        const allSelected = visible.length > 0 && visible.every(v => active.includes(v))
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpenFilter(null)} />
            <div style={{
              position: 'fixed', zIndex: 50,
              left: openFilter.x, top: openFilter.y,
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 200,
            }}>
              <div style={{ padding: '7px 12px 6px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{colDef?.label}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button"
                    onClick={() => {
                      setColFilters(prev => {
                        const current = prev[openFilter.key] ?? []
                        if (allSelected) {
                          const next = { ...prev, [openFilter.key]: current.filter(v => !visible.includes(v)) }
                          if (!next[openFilter.key].length) delete next[openFilter.key]
                          return next
                        }
                        const toAdd = visible.filter(v => !current.includes(v))
                        return { ...prev, [openFilter.key]: [...current, ...toAdd] }
                      })
                    }}
                    style={{ fontSize: 10, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {allSelected ? 'בטל הכל' : 'בחר הכל'}
                  </button>
                  {active.length > 0 && (
                    <button type="button"
                      onClick={() => setColFilters(p => { const n = { ...p }; delete n[openFilter.key]; return n })}
                      style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      נקה
                    </button>
                  )}
                </div>
              </div>
              <div style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="חיפוש..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {visible.map(val => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}
                    className="hover:bg-gray-50">
                    <input type="checkbox" checked={active.includes(val)} onChange={() => toggleFilterValue(openFilter.key, val)} style={{ cursor: 'pointer' }} />
                    <span>{val || '(ריק)'}</span>
                  </label>
                ))}
                {visible.length === 0 && (
                  <div style={{ padding: '8px 12px', fontSize: 12, color: '#9ca3af' }}>
                    {uniq.length === 0 ? 'אין ערכים' : 'לא נמצאו תוצאות'}
                  </div>
                )}
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
