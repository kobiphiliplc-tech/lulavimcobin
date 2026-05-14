'use client'

import { buildCardHtml } from '@/components/miuinim/WhatsAppShare'
import type { SortingEvent, Grade } from '@/lib/types'

const MOCK_GRADES: Grade[] = [
  { id: 1, name: 'לבן',   color: '#F8F0DC', text_color: '#333', group_name: 'high',   sort_order: 1 },
  { id: 2, name: 'ירוק',  color: '#4CAF50', text_color: '#fff', group_name: 'high',   sort_order: 2 },
  { id: 3, name: 'כסף',   color: '#C0C0C0', text_color: '#333', group_name: 'high',   sort_order: 3 },
  { id: 4, name: 'כסף2',  color: '#A0A0A0', text_color: '#fff', group_name: 'mid',    sort_order: 4 },
  { id: 5, name: 'כתום',  color: '#FF9800', text_color: '#fff', group_name: 'mid',    sort_order: 5 },
  { id: 6, name: 'כשר',   color: '#2196F3', text_color: '#fff', group_name: 'low',    sort_order: 6 },
  { id: 7, name: 'שחור',  color: '#333333', text_color: '#fff', group_name: 'low',    sort_order: 7 },
  { id: 8, name: 'עובש',  color: '#9E1010', text_color: '#fff', group_name: 'reject', sort_order: 8 },
  { id: 9, name: 'ענף',   color: '#795548', text_color: '#fff', group_name: 'reject', sort_order: 9 },
]

const MOCK_EVENT: SortingEvent = {
  id: 1,
  sort_serial: 42,
  receiving_serial: null,
  warehouse_code: 'א',
  sorted_date: '2026-10-05',
  field_id: 1,
  field_name: 'שדה הדגמה',
  length_type: 'ארוך',
  freshness_type: 'טרי',
  supplier_id: null,
  status_type: 'מהדרין',
  notes: null,
  created_at: '',
  sorting_quantities: [
    { grade: 'לבן',  quantity: 320 },
    { grade: 'ירוק', quantity: 180 },
    { grade: 'כסף',  quantity: 210 },
    { grade: 'כסף2', quantity: 95  },
    { grade: 'כתום', quantity: 60  },
    { grade: 'כשר',  quantity: 45  },
    { grade: 'שחור', quantity: 30  },
    { grade: 'עובש', quantity: 18  },
    { grade: 'ענף',  quantity: 42  },
  ],
}

const MOCK_FIELDS  = [{ id: 1, name: 'שדה הדגמה', supplier_id: null, created_at: '' }]
const MOCK_SUPPLIERS: never[] = []

export default function CardPreviewPage() {
  const html = buildCardHtml(MOCK_EVENT, MOCK_SUPPLIERS as never, MOCK_FIELDS as never, MOCK_GRADES)

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-12 px-4" dir="ltr">
      <div className="mb-6 text-center" dir="rtl">
        <h1 className="text-xl font-bold text-gray-700">תצוגה מקדימה — כרטיס שיתוף ווצאפ</h1>
        <p className="text-sm text-gray-400 mt-1">זהה 1:1 לתמונה המשותפת. ערוך את WhatsAppShare.tsx ורענן.</p>
      </div>

      <div
        className="shadow-2xl rounded-xl overflow-hidden"
        style={{ width: 380 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="mt-8 text-xs text-gray-400 dir-rtl" dir="rtl">
        הכרטיס מרונדר ישירות מ-<code className="bg-gray-200 px-1 rounded">buildCardHtml</code> — ללא html2canvas
      </div>
    </div>
  )
}
