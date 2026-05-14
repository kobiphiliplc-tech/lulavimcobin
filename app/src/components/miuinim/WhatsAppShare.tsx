'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { SortingEvent, Supplier, Field, Grade } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  events: SortingEvent[]
  suppliers: Supplier[]
  fields: Field[]
  grades: Grade[]
}

const GROUP_RANK: Record<string, number> = { high: 0, mid: 1, low: 2, reject: 3 }

function sortGrades(grades: Grade[]) {
  return [...grades].sort(
    (a, b) => (GROUP_RANK[a.group_name] ?? 9) - (GROUP_RANK[b.group_name] ?? 9) || a.sort_order - b.sort_order
  )
}

function grpSum(qtys: Array<{ grade: string; quantity: number }>, names: string[]) {
  return qtys.filter(q => names.includes(q.grade)).reduce((s, q) => s + q.quantity, 0)
}

function buildCardHtml(
  event: SortingEvent,
  suppliers: Supplier[],
  fields: Field[],
  gradesList: Grade[],
): string {
  const qtys     = event.sorting_quantities ?? []
  const total    = qtys.reduce((s, q) => s + q.quantity, 0)
  const allG     = sortGrades(gradesList)
  const mainG    = allG.filter(g => g.group_name !== 'reject')
  const rejectG  = allG.filter(g => g.group_name === 'reject')
  const highG    = allG.filter(g => g.group_name === 'high')
  const midG     = allG.filter(g => g.group_name === 'mid')
  const lowG     = allG.filter(g => g.group_name === 'low')

  const getQ  = (name: string) => qtys.find(q => q.grade === name)?.quantity ?? 0
  const pct   = (n: number)    => total > 0 ? Math.round((n / total) * 100) : 0

  const topTotal    = grpSum(qtys, highG.map(g => g.name))
  const midTotal    = grpSum(qtys, midG.map(g => g.name))
  const lowTotal    = grpSum(qtys, lowG.map(g => g.name))
  const rejectTotal = grpSum(qtys, rejectG.map(g => g.name))
  const netTotal    = total - rejectTotal

  const fieldName    = fields.find(f => f.id === event.field_id)?.name ?? event.field_name ?? '—'
  const supplierName = suppliers.find(s => s.id === event.supplier_id)?.name ?? ''
  const dateStr      = event.sorted_date
    ? new Date(event.sorted_date + 'T00:00:00').toLocaleDateString('he-IL')
    : '—'

  const topLabel = highG.slice(0, 2).map(g => g.name).join('+') || 'רמה גבוהה'
  const midLabel = midG.slice(0,  2).map(g => g.name).join('+') || 'רמה ביניים'
  const lowLabel = lowG.slice(0,  2).map(g => g.name).join('+') || 'רמה נמוכה'

  // RTL flex: first DOM child = rightmost visual. Row: name | dot | bar | qty | pct%
  const gradeRow = (g: Grade) => {
    const qty = getQ(g.name)
    const p   = pct(qty)
    const barW = qty > 0 ? Math.max(p, 2) : 0
    return `<div style="display:flex;align-items:center;height:22px;direction:rtl;">
      <span style="font-size:12px;font-weight:500;color:#1f2937;width:48px;text-align:right;flex-shrink:0;white-space:nowrap;overflow:hidden;">${g.name}</span>
      <span style="display:block;width:8px;height:8px;border-radius:50%;background:${g.color};flex-shrink:0;margin:0 6px;border:1px solid rgba(0,0,0,0.1);"></span>
      <div style="flex:1;height:3px;background:#efefef;border-radius:2px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;right:0;height:100%;width:${barW}%;background:${g.color};border-radius:2px;min-width:${qty>0?'3px':'0'};"></div>
      </div>
      <span style="font-size:13px;font-weight:700;color:#111;width:50px;text-align:right;flex-shrink:0;">${qty.toLocaleString('he-IL')}</span>
      <span style="font-size:11px;color:#aaa;width:32px;text-align:left;flex-shrink:0;">${p}%</span>
    </div>`
  }

  const rejectActive   = rejectG.filter(g => getQ(g.name) > 0)
  const rejectRowsHtml = rejectActive.map(g => `${g.name} ${getQ(g.name).toLocaleString('he-IL')}`).join('، ')

  const statusBg    = !event.status_type || event.status_type === 'בסיסי' ? '#dcfce7' : '#fef9c3'
  const statusColor = !event.status_type || event.status_type === 'בסיסי' ? '#166534' : '#713f12'

  return `
<div style="width:380px;font-family:Arial,Helvetica,sans-serif;direction:rtl;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.16);">

  <div style="background:#1a5c2a;color:#fff;padding:16px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:20px;font-weight:700;line-height:1.3;word-break:break-word;">${fieldName}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;white-space:nowrap;">${dateStr} · ${event.length_type} · ${event.freshness_type}</div>
        ${supplierName ? `<div style="font-size:10px;opacity:0.65;margin-top:2px;">${supplierName}</div>` : ''}
      </div>
      <div style="flex-shrink:0;text-align:center;padding-top:2px;">
        <div style="background:rgba(134,239,172,0.3);border:1px solid rgba(134,239,172,0.5);border-radius:6px;padding:3px 8px;font-family:monospace;font-size:12px;letter-spacing:0.5px;white-space:nowrap;">#${event.sort_serial}</div>
        ${event.warehouse_code ? `<div style="font-size:11px;opacity:0.75;margin-top:4px;text-align:center;">גוף ${event.warehouse_code}</div>` : ''}
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:#f8faf8;border-bottom:1px solid #e5e7eb;">
    <div style="padding:9px 4px;text-align:center;border-left:1px solid #e5e7eb;">
      <div style="font-size:9px;color:#888;letter-spacing:0.2px;margin-bottom:2px;">${topLabel}</div>
      <div style="font-size:20px;font-weight:700;color:#16a34a;line-height:1;">${pct(topTotal)}%</div>
    </div>
    <div style="padding:9px 4px;text-align:center;border-left:1px solid #e5e7eb;">
      <div style="font-size:9px;color:#888;letter-spacing:0.2px;margin-bottom:2px;">${midLabel}</div>
      <div style="font-size:20px;font-weight:700;color:#ea580c;line-height:1;">${pct(midTotal)}%</div>
    </div>
    <div style="padding:9px 4px;text-align:center;">
      <div style="font-size:9px;color:#888;letter-spacing:0.2px;margin-bottom:2px;">${lowLabel}</div>
      <div style="font-size:20px;font-weight:700;color:#9ca3af;line-height:1;">${pct(lowTotal)}%</div>
    </div>
  </div>

  <div style="padding:10px 14px 8px;">
    ${mainG.map(g => gradeRow(g)).join('')}
    ${rejectTotal > 0 ? `
      <div style="border-top:1px dashed #ddd;margin:8px 0 6px;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;direction:rtl;">
        <span style="font-size:11px;color:#555;">${rejectRowsHtml}</span>
        <span style="font-size:10px;color:#bbb;flex-shrink:0;white-space:nowrap;">${pct(rejectTotal)}% · פסולים</span>
      </div>
    ` : ''}
  </div>

  <div style="border-top:1px solid #eee;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;background:#f8faf8;direction:rtl;">
    <div style="text-align:right;">
      <div style="font-size:9px;color:#16a34a;letter-spacing:0.5px;margin-bottom:2px;">סה&quot;כ לולבים</div>
      <div style="font-size:22px;font-weight:800;color:#16a34a;line-height:1;">${netTotal.toLocaleString('he-IL')}</div>
    </div>
    <div style="background:${statusBg};color:${statusColor};border-radius:999px;padding:4px 12px;font-size:11px;font-weight:600;white-space:nowrap;">
      ${event.status_type || 'בסיסי'} ✓
    </div>
  </div>

</div>`
}

async function captureHtml(html: string): Promise<Blob> {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:fixed;top:-9999px;left:-9999px;padding:16px;background:#f3f4f6;'
  wrap.innerHTML = html
  document.body.appendChild(wrap)
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(wrap.firstElementChild as HTMLElement, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: '#f3f4f6',
      logging: false,
      onclone: (clonedDoc) => {
        // Remove all external/global stylesheets — card uses only inline styles.
        // This prevents html2canvas from choking on oklch() colors from Tailwind v4.
        clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach(el => el.remove())
      },
    })
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
    )
  } finally {
    document.body.removeChild(wrap)
  }
}

export function WhatsAppShareDialog({ open, onClose, events, suppliers, fields, grades }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (open && events.length > 0) {
      setSelectedIds(new Set([events[0].id]))
    }
  }, [open, events])

  function toggle(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) } return n })
  }

  async function handleShare() {
    const toShare = events.filter(e => selectedIds.has(e.id))
    if (toShare.length === 0) { toast.error('יש לבחור לפחות מיון אחד'); return }
    setSharing(true)
    try {
      const files: File[] = []
      for (const event of toShare) {
        const html = buildCardHtml(event, suppliers, fields, grades)
        const blob = await captureHtml(html)
        files.push(new File([blob], `miun-${event.sort_serial}.png`, { type: 'image/png' }))
      }

      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, title: 'מיון לולבים' })
      } else {
        files.forEach(file => {
          const url = URL.createObjectURL(file)
          const a   = document.createElement('a')
          a.href = url; a.download = file.name; a.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        })
        toast.success('הקבצים הורדו')
      }
      onClose()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('שגיאה בשיתוף: ' + (err as Error).message)
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm bg-white text-gray-900" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" style={{ fill: '#25D366' }}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            שתף מיונים בוואטסאפ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="max-h-72 overflow-y-auto space-y-0.5 border rounded-lg divide-y">
            {events.slice(0, 50).map(event => {
              const fieldName    = fields.find(f => f.id === event.field_id)?.name ?? event.field_name ?? '—'
              const supplierName = suppliers.find(s => s.id === event.supplier_id)?.name ?? ''
              const total        = (event.sorting_quantities ?? []).reduce((s, q) => s + q.quantity, 0)
              const dateStr      = event.sorted_date
                ? new Date(event.sorted_date + 'T00:00:00').toLocaleDateString('he-IL')
                : '—'
              return (
                <label key={event.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded flex-shrink-0"
                    checked={selectedIds.has(event.id)}
                    onChange={() => toggle(event.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-gray-400">#{event.sort_serial}</span>
                      <span className="text-sm font-medium truncate">{fieldName}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {dateStr}{supplierName ? ` · ${supplierName}` : ''} · {total.toLocaleString()} יח׳
                    </div>
                  </div>
                </label>
              )
            })}
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 text-white font-medium"
              style={{ background: sharing ? '#86efac' : '#25D366' }}
              disabled={sharing || selectedIds.size === 0}
              onClick={handleShare}
            >
              {sharing
                ? <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> מכין תמונה...</span>
                : `שתף ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`
              }
            </Button>
            <Button variant="outline" onClick={onClose} disabled={sharing}>ביטול</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
