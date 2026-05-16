'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/lib/context/SeasonContext'
import { GRADES, getGradeColor, getGradeTextColor } from '@/lib/constants'

interface InventoryRow {
  id: number
  season: string
  grade: string
  length_type: string
  freshness_type: string
  quantity: number
  warehouse_id: number | null
  updated_at: string
  warehouse?: { name: string } | null
}

function fmtNum(n: number) {
  return n.toLocaleString('he-IL')
}

function GradeDot({ grade }: { grade: string }) {
  return (
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: getGradeColor(grade), flexShrink: 0, display: 'inline-block' }} />
  )
}

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: getGradeColor(grade), color: getGradeTextColor(grade) }}>
      {grade}
    </span>
  )
}

export default function InventoryPage() {
  const supabase = createClient()
  const { activeSeason } = useSeason()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inventory')
      .select('*, warehouse:warehouses(name)')
      .eq('season', activeSeason)
      .gt('quantity', 0)
      .order('grade')
      .order('length_type')
      .order('freshness_type')
    setRows((data as InventoryRow[]) ?? [])
    setLoading(false)
  }, [activeSeason]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  const totalUnits = rows.reduce((s, r) => s + r.quantity, 0)

  const byGrade = GRADES.map(g => ({
    ...g,
    total: rows.filter(r => r.grade === g.name).reduce((s, r) => s + r.quantity, 0),
  })).filter(g => g.total > 0)

  return (
    <div dir="rtl" className="p-4 max-w-6xl mx-auto">

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">מלאי חי</h1>
          <p className="text-xs text-gray-400 mt-0.5">עונה {activeSeason}</p>
        </div>
        <button onClick={fetchData} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
          רענן
        </button>
      </div>

      <div className="mb-4 bg-green-50 border border-green-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <span className="text-sm text-green-700">{'סה"כ מלאי'}</span>
        <span className="text-2xl font-bold text-green-700">{fmtNum(totalUnits)}</span>
        <span className="text-sm text-green-600">יח׳</span>
      </div>

      {byGrade.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {byGrade.map(g => (
            <div key={g.name} style={{ borderRadius: 8, padding: '8px 12px', border: `1px solid ${g.color}22`, background: `${g.color}18` }}>
              <div className="flex items-center gap-2 mb-1">
                <GradeDot grade={g.name} />
                <span className="text-xs font-medium text-gray-700">{g.name}</span>
              </div>
              <div className="text-lg font-bold text-gray-800">{fmtNum(g.total)}</div>
              <div className="text-xs text-gray-400">יח׳</div>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-8">טוען...</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-gray-400 text-center py-8">אין מלאי בעונה זו</p>}

      {!loading && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['רמה', 'טריות', 'אורך', 'מחסן', 'כמות (יח׳)', 'עדכון אחרון'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <GradeDot grade={row.grade} />
                      <GradeBadge grade={row.grade} />
                    </div>
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #e5e7eb' }}>{row.freshness_type}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #e5e7eb' }}>{row.length_type}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #e5e7eb', color: '#6b7280' }}>{row.warehouse?.name ?? '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #e5e7eb', fontWeight: 600, fontSize: 14 }}>{fmtNum(row.quantity)}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #e5e7eb', color: '#9ca3af', fontSize: 11 }}>
                    {new Date(row.updated_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
