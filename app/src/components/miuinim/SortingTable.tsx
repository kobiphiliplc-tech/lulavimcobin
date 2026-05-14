'use client'

import { useState, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { toast } from 'sonner'
import type { SortingEvent, Supplier, Field, ReceivingOrder, Grade } from '@/lib/types'

// ── exported type used by page.tsx ─────────────────────────────────────────
export interface ImportedSortingRow {
  sort_serial?: number
  field_name: string
  freshness_type: string
  sorted_date: string    // ISO yyyy-mm-dd
  supplier_name: string
  warehouse_code: string
  length_type: string
  status_type: string
  quantities: { grade: string; quantity: number }[]
}

interface Props {
  events: SortingEvent[]
  suppliers: Supplier[]
  fields: Field[]
  receivingOrders: ReceivingOrder[]
  grades: Grade[]
  onImportRows?: (rows: ImportedSortingRow[]) => Promise<{ success: number; errors: string[] }>
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
  { key: 'serial',    label: 'מס׳ מיון',  filterable: false },
  { key: 'field',     label: 'שדה/חלקה',  filterable: true  },
  { key: 'freshness', label: 'מיון',       filterable: true  },
  { key: 'date',      label: 'תאריך',      filterable: true  },
  { key: 'supplier',  label: 'ספק',        filterable: true  },
  { key: 'kabala',    label: 'קבלה',       filterable: true  },
  { key: 'length',    label: 'אורך',       filterable: true  },
]
const TAIL_COLS: { key: string; label: string; filterable: boolean }[] = [
  { key: 'total',  label: 'סה"כ',  filterable: false },
  { key: 'status', label: 'סטטוס', filterable: true  },
]

function getColValue(colKey: string, row: RowData): string {
  switch (colKey) {
    case 'serial':    return String(row.event.sort_serial)
    case 'field':     return row.field
    case 'freshness': return row.event.freshness_type
    case 'date':      return fmtDate(row.event.sorted_date)
    case 'supplier':  return row.supplier
    case 'kabala':    return row.kabala
    case 'length':    return row.event.length_type
    case 'status':    return statusLabel(row.event.status_type)
    default:          return ''
  }
}

export function SortingTable({ events, suppliers, fields, receivingOrders, grades, onImportRows }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<{ key: string; x: number; y: number } | null>(null)
  const [filterSearch, setFilterSearch] = useState('')
  const [importPreview, setImportPreview] = useState<{ rows: ImportedSortingRow[]; filename: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: next }
    })
  }

  // ── base rows ──────────────────────────────────────────────────────────────
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

  function getUniqueVals(colKey: string): string[] {
    const vals = new Set<string>()
    for (const row of baseRows) vals.add(getColValue(colKey, row))
    return Array.from(vals).sort((a, b) => a.localeCompare(b, 'he'))
  }

  // ── filtered + sorted rows ─────────────────────────────────────────────────
  const rows = useMemo<RowData[]>(() => {
    const filtered = baseRows.filter(row =>
      Object.entries(colFilters).every(([key, vals]) => {
        if (!vals.length) return true
        return vals.includes(getColValue(key, row))
      })
    )
    if (!sortCol) return filtered
    return [...filtered].sort((a, b) => {
      let av: string | number | null = null
      let bv: string | number | null = null
      if      (sortCol === 'serial')    { av = a.event.sort_serial;    bv = b.event.sort_serial    }
      else if (sortCol === 'field')     { av = a.field;                bv = b.field                }
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

  // ── export ─────────────────────────────────────────────────────────────────
  async function handleExport() {
    const XLSX = await import('xlsx')

    const headers = [
      'מס׳ מיון', 'שדה/חלקה', 'מיון', 'תאריך', 'ספק', 'קבלה', 'אורך',
      ...sortedGrades.map(g => g.name),
      'סה"כ', 'סטטוס',
    ]

    const dataRows = rows.map(({ event: e, field, supplier, kabala, total }) => [
      e.sort_serial,
      field,
      e.freshness_type,
      fmtDate(e.sorted_date),
      supplier,
      kabala,
      e.length_type,
      ...sortedGrades.map(g => e.sorting_quantities?.find(q => q.grade === g.name)?.quantity ?? 0),
      total,
      statusLabel(e.status_type),
    ])

    const totalsRow = [
      `סה"כ (${rows.length})`, '', '', '', '', '', '',
      ...sortedGrades.map(g => totals.gradeMap[g.name] ?? 0),
      totals.grandTotal, '',
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows, totalsRow])

    // column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 8 },
      ...sortedGrades.map(() => ({ wch: 8 })),
      { wch: 8 }, { wch: 12 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'מיונים')
    const dateStr = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `מיונים_${dateStr}.xlsx`)
  }

  // ── import parsing ─────────────────────────────────────────────────────────
  async function handleImportFile(file: File) {
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })

      if (raw.length < 2) { toast.error('הקובץ ריק או לא תקין'); return }

      const headers = (raw[0] as unknown[]).map(h => String(h ?? ''))
      const idxOf = (name: string) => headers.indexOf(name)

      const iSerial    = idxOf('מס׳ מיון')
      const iField     = idxOf('שדה/חלקה')
      const iFreshness = idxOf('מיון')
      const iDate      = idxOf('תאריך')
      const iSupplier  = idxOf('ספק')
      const iKabala    = idxOf('קבלה')
      const iLength    = idxOf('אורך')
      const iStatus    = idxOf('סטטוס')
      const gradeIdxMap = sortedGrades.map(g => ({ grade: g.name, idx: idxOf(g.name) }))

      const parsedRows: ImportedSortingRow[] = []

      for (let i = 1; i < raw.length; i++) {
        const row = raw[i] as unknown[]
        if (!row || row.length === 0) continue
        if (String(row[0] ?? '').startsWith('סה"כ')) continue

        // parse date
        let sortedDate = ''
        const rawDate = iDate >= 0 ? row[iDate] : undefined
        if (rawDate instanceof Date) {
          sortedDate = rawDate.toISOString().split('T')[0]
        } else if (typeof rawDate === 'string' && rawDate.includes('/')) {
          const [dd, mm, yyyy] = rawDate.split('/')
          sortedDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
        }
        if (!sortedDate) continue

        const rawFreshness = iFreshness >= 0 ? String(row[iFreshness] ?? '') : ''
        const freshness = isFreshness(rawFreshness) ? rawFreshness : ''
        const length = String(iLength >= 0 ? (row[iLength] ?? '') : '')
        if (!freshness || !length) continue

        const quantities = gradeIdxMap
          .filter(gi => gi.idx >= 0)
          .flatMap(gi => {
            const qty = Number(row[gi.idx])
            return isNaN(qty) || qty <= 0 ? [] : [{ grade: gi.grade, quantity: qty }]
          })

        const kabalaVal = iKabala >= 0 ? String(row[iKabala] ?? '') : ''
        parsedRows.push({
          sort_serial: iSerial >= 0 ? Number(row[iSerial]) || undefined : undefined,
          field_name: iField >= 0 ? String(row[iField] ?? '').replace('—', '').trim() : '',
          freshness_type: freshness,
          sorted_date: sortedDate,
          supplier_name: iSupplier >= 0 ? String(row[iSupplier] ?? '').replace('—', '').trim() : '',
          warehouse_code: kabalaVal === '—' ? '' : kabalaVal.trim(),
          length_type: length,
          status_type: iStatus >= 0 ? String(row[iStatus] ?? 'בסיסי') : 'בסיסי',
          quantities,
        })
      }

      if (parsedRows.length === 0) { toast.error('לא נמצאו שורות תקינות לייבוא'); return }
      setImportPreview({ rows: parsedRows, filename: file.name })
    } catch (err) {
      toast.error('שגיאה בקריאת הקובץ: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  function isFreshness(val: string) {
    return val === 'טרי' || val === 'מוקדם'
  }

  async function confirmImport() {
    if (!importPreview || !onImportRows) return
    setImporting(true)
    try {
      const { success, errors } = await onImportRows(importPreview.rows)
      if (errors.length > 0) {
        toast.warning(`יובאו ${success} מיונים. שגיאות: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`)
      } else {
        toast.success(`${success} מיונים יובאו בהצלחה`)
      }
      setImportPreview(null)
    } finally {
      setImporting(false)
    }
  }

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
  const activeFilterCount = Object.keys(colFilters).length

  if (events.length === 0) {
    return <p style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>אין מיונים להצגה</p>
  }

  return (
    <div dir="rtl">
      {/* ── toolbar ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={handleExport}
          style={{ fontSize: 12, padding: '4px 12px', border: '1px solid #86efac', borderRadius: 6, background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontWeight: 500 }}
        >
          ↓ ייצוא לאקסל
        </button>
        {onImportRows && (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: 12, padding: '4px 12px', border: '1px solid #bfdbfe', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontWeight: 500 }}
          >
            ↑ ייבוא מאקסל
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={async e => {
            const file = e.target.files?.[0]
            if (file) await handleImportFile(file)
            e.target.value = ''
          }}
        />
        {activeFilterCount > 0 && (
          <button
            onClick={() => setColFilters({})}
            style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #fed7aa', borderRadius: 6, background: '#fff7ed', color: '#c2410c', cursor: 'pointer' }}
          >
            נקה סינונים ({activeFilterCount})
          </button>
        )}
      </div>

      {/* ── table ── */}
      <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
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
          <tbody>
            {rows.map(({ event: e, field, supplier, kabala, total }) => {
              const rowBg = e.freshness_type === 'טרי' ? '#f0fdf4' : '#fff7ed'
              return (
                <tr key={e.id} style={{ background: rowBg }}>
                  <td style={{ ...tdStyle, color: '#6b7280', fontFamily: 'monospace' }}>{e.sort_serial}</td>
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
          <tfoot>
            <tr style={{ background: '#f3f4f6', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
              <td style={{ ...tdStyle, color: '#374151' }} colSpan={7}>{`סה"כ (${rows.length})`}</td>
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

      {/* ── filter popup ── */}
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

      {/* ── import preview modal ── */}
      {importPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setImportPreview(null)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#111827' }}>ייבוא מיונים</h3>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
              קובץ: <span style={{ fontWeight: 500 }}>{importPreview.filename}</span>
            </p>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
              נמצאו <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{importPreview.rows.length}</span> מיונים לייבוא.
            </p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 20 }}>
              המספרים הסידוריים יוקצו מחדש. שדות וספקים ישויכו לפי שם.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setImportPreview(null)}
                style={{ flex: 1, padding: '8px 0', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#6b7280', cursor: 'pointer' }}
              >
                ביטול
              </button>
              <button
                onClick={confirmImport}
                disabled={importing}
                style={{ flex: 1, padding: '8px 0', fontSize: 13, border: 'none', borderRadius: 8, background: '#1d4ed8', color: '#fff', cursor: importing ? 'wait' : 'pointer', fontWeight: 600, opacity: importing ? 0.7 : 1 }}
              >
                {importing ? 'מייבא...' : 'ייבא'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
