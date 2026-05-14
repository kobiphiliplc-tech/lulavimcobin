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

export function SortingTable({ events, suppliers, fields, receivingOrders, grades }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: string) {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  // ── build display rows ──────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const mapped = events.map(e => {
      const field    = fields.find(f => f.id === e.field_id)?.name ?? e.field_name ?? '—'
      const supplier = suppliers.find(s => s.id === e.supplier_id)?.name ?? '—'
      const kabala   = e.warehouse_code
        ? (receivingOrders.find(o => o.warehouse_code === e.warehouse_code)?.serial_no ?? '—')
        : '—'
      const total    = (e.sorting_quantities ?? []).reduce((s, q) => s + q.quantity, 0)
      return { event: e, field, supplier, kabala, total }
    })

    if (!sortCol) return mapped

    return [...mapped].sort((a, b) => {
      let av: string | number | null = null
      let bv: string | number | null = null

      if (sortCol === 'field')    { av = a.field;    bv = b.field    }
      else if (sortCol === 'freshness') { av = a.event.freshness_type; bv = b.event.freshness_type }
      else if (sortCol === 'date')     { av = a.event.sorted_date;     bv = b.event.sorted_date     }
      else if (sortCol === 'supplier') { av = a.supplier;              bv = b.supplier              }
      else if (sortCol === 'kabala')   { av = a.kabala;                bv = b.kabala               }
      else if (sortCol === 'length')   { av = a.event.length_type;     bv = b.event.length_type     }
      else if (sortCol === 'total')    { av = a.total;                 bv = b.total                 }
      else if (sortCol === 'status')   { av = a.event.status_type;     bv = b.event.status_type     }
      else {
        // grade column: key = `grade_${g.id}`
        const gid = parseInt(sortCol.replace('grade_', ''), 10)
        const g   = grades.find(gr => gr.id === gid)
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
  }, [events, fields, suppliers, receivingOrders, grades, sortCol, sortDir])

  // ── totals ──────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const gradeMap: Record<string, number> = {}
    for (const g of grades) gradeMap[g.name] = 0
    let grandTotal = 0
    for (const e of events) {
      for (const q of e.sorting_quantities ?? []) {
        if (gradeMap[q.grade] !== undefined) gradeMap[q.grade] += q.quantity
        grandTotal += q.quantity
      }
    }
    return { gradeMap, grandTotal }
  }, [events, grades])

  // ── fixed column headers ─────────────────────────────────────────────────────
  const FIXED_COLS = [
    { key: 'field',     label: 'שדה/חלקה' },
    { key: 'freshness', label: 'מיון'      },
    { key: 'date',      label: 'תאריך'     },
    { key: 'supplier',  label: 'ספק'       },
    { key: 'kabala',    label: 'קבלה'      },
    { key: 'length',    label: 'אורך'      },
  ]
  const TAIL_COLS = [
    { key: 'total',  label: 'סה"כ' },
    { key: 'status', label: 'סטטוס' },
  ]

  const thStyle = (key: string): CSSProperties => ({
    padding: '7px 10px',
    textAlign: 'right',
    borderBottom: '1px solid #e5e7eb',
    color: sortCol === key ? '#16a34a' : '#6b7280',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    cursor: 'pointer',
    position: 'sticky',
    top: 0,
    background: '#f9fafb',
    zIndex: 10,
  })

  const sortIndicator = (key: string) => (
    <span style={{ fontSize: 10, lineHeight: 1, color: sortCol === key ? '#16a34a' : '#d1d5db', marginRight: 2 }}>
      {sortCol === key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )

  const tdStyle: CSSProperties = { padding: '7px 10px', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }

  if (events.length === 0) {
    return <p style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>אין מיונים להצגה</p>
  }

  return (
    <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>

        {/* ── HEADER ── */}
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {FIXED_COLS.map(col => (
              <th key={col.key} style={thStyle(col.key)} onClick={() => toggleSort(col.key)}>
                {col.label} {sortIndicator(col.key)}
              </th>
            ))}
            {grades.map(g => {
              const key = `grade_${g.id}`
              return (
                <th key={key} style={{ ...thStyle(key), color: sortCol === key ? '#16a34a' : g.color || '#6b7280' }}
                  onClick={() => toggleSort(key)}>
                  {g.name} {sortIndicator(key)}
                </th>
              )
            })}
            {TAIL_COLS.map(col => (
              <th key={col.key} style={thStyle(col.key)} onClick={() => toggleSort(col.key)}>
                {col.label} {sortIndicator(col.key)}
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
                {grades.map(g => {
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
            <td style={{ ...tdStyle, color: '#374151' }}>סה"כ ({events.length})</td>
            <td style={tdStyle} />
            <td style={tdStyle} />
            <td style={tdStyle} />
            <td style={tdStyle} />
            <td style={tdStyle} />
            {grades.map(g => (
              <td key={g.id} style={{ ...tdStyle, textAlign: 'center', color: '#374151' }}>
                {(totals.gradeMap[g.name] ?? 0) > 0
                  ? totals.gradeMap[g.name].toLocaleString()
                  : '—'}
              </td>
            ))}
            <td style={{ ...tdStyle, color: '#374151' }}>{totals.grandTotal.toLocaleString()}</td>
            <td style={tdStyle} />
          </tr>
        </tfoot>

      </table>
    </div>
  )
}
