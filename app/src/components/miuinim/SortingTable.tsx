'use client'

import { useState, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { SortingEvent, Supplier, Field, ReceivingOrder, Grade } from '@/lib/types'

interface Props {
  events: SortingEvent[]
  suppliers: Supplier[]
  fields: Field[]
  receivingOrders: ReceivingOrder[]
  grades: Grade[]
}

type SortDir = 'asc' | 'desc'

const GROUP_ORDER: Record<string, number> = { high: 0, mid: 1, low: 2, reject: 3 }

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function statusLabel(s: string) {
  if (!s || s === 'בסיסי') return 'בסיסי'
  return s
}

function statusStyle(s: string): CSSProperties {
  if (s === 'משנת יוסף') return { background: '#dbeafe', color: '#1e40af', borderRadius: 9999, padding: '1px 8px', fontSize: 11, whiteSpace: 'nowrap' }
  if (s === 'צהוב')       return { background: '#fef9c3', color: '#854d0e', borderRadius: 9999, padding: '1px 8px', fontSize: 11, whiteSpace: 'nowrap' }
  return { background: '#dcfce7', color: '#166534', borderRadius: 9999, padding: '1px 8px', fontSize: 11, whiteSpace: 'nowrap' }
}

interface RowData {
  event: SortingEvent
  field: string
  supplier: string
  kabala: string
  total: number
}

const FIXED_COLS: { key: string; label: string; filterable: boolean }[] = [
  { key: 'field',     label: 'שדה/חלקה', filterable: true  },
  { key: 'freshness', label: 'מיון',      filterable: true  },
  { key: 'date',      label: 'תאריך',     filterable: false },
  { key: 'supplier',  label: 'ספק',       filterable: true  },
  { key: 'kabala',    label: 'קבלה',      filterable: false },
  { key: 'length',    label: 'אורך',      filterable: true  },
]
const TAIL_COLS: { key: string; label: string; filterable: boolean }[] = [
  { key: 'total',  label: 'סה"כ',  filterable: false },
  { key: 'status', label: 'סטטוס', filterable: true  },
]

function getColValue(colKey: string, row: RowData): string {
  switch (colKey) {
    case 'field':     return row.field
    case 'freshness': return row.event.freshness_type
    case 'supplier':  return row.supplier
    case 'length':    return row.event.length_type
    case 'status':    return statusLabel(row.event.status_type)
    default:          return ''
  }
}

export function SortingTable({ events, suppliers, fields, receivingOrders, grades }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<{ key: string; x: number; y: number } | null>(null)
  const [filterSearch, setFilterSearch] = useState('')

  // grades sorted by group then sort_order
  const sortedGrades = useMemo(() =>
    [...grades].sort((a, b) => {
      const ga = GROUP_ORDER[a.group_name] ?? 99
      const gb = GROUP_ORDER[b.group_name] ?? 99
      if (ga !== gb) return ga - gb
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    }),
  [grades])

  function toggleSort(key: string) {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  function toggleFilterValue(key: string, val: string) {
    setColFilters(prev => {
      const current = prev[key] ?? []
      const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val]
      if (next.length === 0) {
        const { [key]: _r, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: next }
    })
  }

  // ── base rows (no sort/filter applied) ────────────────────────────────────
  const baseRows = useMemo<RowData[]>(() =>
    events.map(e => ({
      event:    e,
      field:    fields.find(f => f.id === e.field_id)?.name ?? e.field_name ?? '—',
      supplier: suppliers.find(s => s.id === e.supplier_id)?.name ?? '—',
      kabala:   e.warehouse_code
        ? (receivingOrders.find(o => o.warehouse_code === e.warehouse_code)?.serial_no ?? '—')
        : '—',
      total: (e.sorting_quantities ?? []).reduce((s, q) => s + q.quantity, 0),
    })),
  [events, fields, suppliers, receivingOrders])

  // unique values per filterable column (from unfiltered base)
  function getUniqueVals(colKey: string): string[] {
    const vals = new Set<string>()
    for (const row of baseRows) vals.add(getColValue(colKey, row))
    return [...vals].sort((a, b) => a.localeCompare(b, 'he'))
  }

  // ── filtered + sorted rows ─────────────────────────────────────────────────
  const rows = useMemo<RowData[]>(() => {
    let filtered = baseRows.filter(row =>
      Object.entries(colFilters).every(([key, vals]) => {
        if (!vals.length) return true
        return vals.includes(getColValue(key, row))
      })
    )

    if (!sortCol) return filtered

    return [...filtered].sort((a, b) => {
      let av: string | number | null = null
      let bv: string | number | null = null

      if      (sortCol === 'field')     { av = a.field;                bv = b.field                }
      else if (sortCol === 'freshness') { av = a.event.freshness_type; bv = b.event.freshness_type }
      else if (sortCol === 'date')      { av = a.event.sorted_date;    bv = b.event.sorted_date    }
      else if (sortCol === 'supplier')  { av = a.supplier;             bv = b.supplier             }
      else if (sortCol === 'kabala')    { av = a.kabala;               bv = b.kabala               }
      else if (sortCol === 'length')    { av = a.event.length_type;    bv = b.event.length_type    }
      else if (sortCol === 'total')     { av = a.total;                bv = b.total                }
      else if (sortCol === 'status')    { av = a.event.status_type;    bv = b.event.status_type    }
      else {
        const gid = parseInt(sortCol.replace('grade_', ''), 10)
        const g   = sortedGrades.find(gr => gr.id === gid)
        if (g) {
          av = a.event.sorting_quantities?.find(q => q.grade === g.name)?.quantity ?? 0
          bv = b.event.sorting_quantities?.find(q => q.grade === g.name)?.quantity ?? 0
        }
      }

      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [baseRows, colFilters, sortCol, sortDir, sortedGrades])

  // ── totals over filtered rows ──────────────────────────────────────────────
  const totals = useMemo(() => {
    const gradeMap: Record<string, number> = {}
    for (const g of sortedGrades) gradeMap[g.name] = 0
    let grandTotal = 0
    for (const { event: e } of rows) {
      for (const q of e.sorting_quantities ?? []) {
        if (gradeMap[q.grade] !== undefined) gradeMap[q.grade] += q.quantity
        grandTotal += q.quantity
      }
    }
    return { gradeMap, grandTotal }
  }, [rows, sortedGrades])

  const activeFilterCount = Object.keys(colFilters).length

  // ── styles ─────────────────────────────────────────────────────────────────
  const thBase: CSSProperties = {
    padding: '7px 10px',
    textAlign: 'right',
    borderBottom: '1px solid #e5e7eb',
    color: '#111827',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    position: 'sticky',
    top: 0,
    background: '#f9fafb',
    zIndex: 10,
  }

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

  const tdStyle: CSSProperties = { padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }

  if (events.length === 0) {
    return <p style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>אין מיונים להצגה</p>
  }

  return (
    <div dir="rtl">
      {activeFilterCount > 0 && (
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => setColFilters({})}
            style={{ fontSize: 12, padding: '3px 10px', border: '1px solid #fed7aa', borderRadius: 6, background: '#fff7ed', color: '#c2410c', cursor: 'pointer' }}
          >
            נקה סינונים ({activeFilterCount})
          </button>
        </div>
      )}

      <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>

          {/* ── HEADER ── */}
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {FIXED_COLS.map(col => (
                <th key={col.key} style={thBase}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span onClick={() => toggleSort(col.key)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {col.label} {sortIcon(col.key)}
                    </span>
                    {filterTrigger(col)}
                  </div>
                </th>
              ))}
              {sortedGrades.map(g => {
                const key = `grade_${g.id}`
                return (
                  <th key={key} style={thBase}>
                    <span onClick={() => toggleSort(key)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      {g.name} {sortIcon(key)}
                    </span>
                  </th>
                )
              })}
              {TAIL_COLS.map(col => (
                <th key={col.key} style={thBase}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span onClick={() => toggleSort(col.key)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {col.label} {sortIcon(col.key)}
                    </span>
                    {filterTrigger(col)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── BODY ── */}
          <tbody>
            {rows.map(({ event: e, field, supplier, kabala, total }) => {
              const rowBg = e.freshness_type === 'טרי' ? '#f0fdf4' : '#fff7ed'
              return (
                <tr key={e.id} style={{ background: rowBg }}>
                  <td style={tdStyle}>{field}</td>
                  <td style={{ ...tdStyle, fontWeight: 500, color: e.freshness_type === 'טרי' ? '#16a34a' : '#c2410c' }}>
                    {e.freshness_type}
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280' }}>{fmtDate(e.sorted_date)}</td>
                  <td style={tdStyle}>{supplier}</td>
                  <td style={{ ...tdStyle, color: '#6b7280', fontFamily: 'monospace' }}>{kabala}</td>
                  <td style={tdStyle}>{e.length_type}</td>
                  {sortedGrades.map(g => {
                    const qty = e.sorting_quantities?.find(q => q.grade === g.name)?.quantity ?? 0
                    return (
                      <td key={g.id} style={{ ...tdStyle, textAlign: 'center', color: qty === 0 ? '#d1d5db' : undefined }}>
                        {qty === 0 ? '—' : qty.toLocaleString()}
                      </td>
                    )
                  })}
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{total.toLocaleString()}</td>
                  <td style={tdStyle}>
                    <span style={statusStyle(e.status_type)}>{statusLabel(e.status_type)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* ── TOTALS ROW ── */}
          <tfoot>
            <tr style={{ background: '#f3f4f6', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
              <td style={{ ...tdStyle, color: '#374151' }}>סה"כ ({rows.length})</td>
              <td style={tdStyle} /><td style={tdStyle} /><td style={tdStyle} /><td style={tdStyle} /><td style={tdStyle} />
              {sortedGrades.map(g => (
                <td key={g.id} style={{ ...tdStyle, textAlign: 'center', color: '#374151' }}>
                  {(totals.gradeMap[g.name] ?? 0) > 0 ? totals.gradeMap[g.name].toLocaleString() : '—'}
                </td>
              ))}
              <td style={{ ...tdStyle, color: '#374151' }}>{totals.grandTotal.toLocaleString()}</td>
              <td style={tdStyle} />
            </tr>
          </tfoot>

        </table>
      </div>

      {/* ── FILTER POPUP ── */}
      {openFilter && (() => {
        const colDef = [...FIXED_COLS, ...TAIL_COLS].find(c => c.key === openFilter.key)!
        const uniq = getUniqueVals(openFilter.key)
        const visible = filterSearch.trim()
          ? uniq.filter(v => v.toLowerCase().includes(filterSearch.trim().toLowerCase()))
          : uniq
        const active = colFilters[openFilter.key] ?? []
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
