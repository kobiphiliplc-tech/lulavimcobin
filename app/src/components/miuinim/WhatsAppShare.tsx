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
  const fieldName = fields.find(f => f.id === event.field_id)?.name ?? event.field_name ?? '—'
  const dateStr   = event.sorted_date
    ? new Date(event.sorted_date + 'T00:00:00').toLocaleDateString('he-IL')
    : '—'

  const rejectActive     = rejectG.filter(g => getQ(g.name) > 0)
  const gradeRows        = mainG.map(g => ({ name: g.name, color: g.color, count: getQ(g.name), pct: pct(getQ(g.name)) }))
  const whitesilverPct   = pct(topTotal)
  const silver2orangePct = pct(midTotal)
  const kosherblackPct   = pct(lowTotal)
  const rejectsPct       = pct(rejectTotal)

  return `
<div style="width:380px;min-width:380px;max-width:380px;font-family:Arial,sans-serif;background:#fff;border-radius:12px;overflow:hidden;border:0.5px solid #ddd;direction:ltr;">

  <!-- HEADER -->
  <div style="background:#1a5c2a;padding:16px 16px;display:table;width:100%;box-sizing:border-box;">
    <div style="display:table-cell;width:90px;vertical-align:middle;">
      <div style="background:rgba(134,239,172,0.3);color:#bbf7d0;font-size:13px;font-weight:700;padding:4px 10px;border-radius:8px;display:inline-block;">#${event.sort_serial}</div>
      ${event.warehouse_code ? `<div style="font-size:11px;color:rgba(255,255,255,0.75);">גוף ${event.warehouse_code}</div>` : ''}
    </div>
    <div style="display:table-cell;vertical-align:middle;text-align:right;">
      <div style="font-size:20px;font-weight:700;color:#fff;">${fieldName}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;">${dateStr} · ${event.length_type} · ${event.freshness_type}</div>
    </div>
  </div>

  <!-- 3 חתכים -->
  <div style="display:table;width:100%;border-bottom:1px solid #eee;table-layout:fixed;">
    <div style="display:table-cell;padding:10px 12px;text-align:center;border-left:1px solid #eee;">
      <div style="font-size:11px;color:#777;margin-bottom:4px;">כשר+שחור</div>
      <div style="font-size:18px;font-weight:700;color:#6b7280;">${kosherblackPct}%</div>
    </div>
    <div style="display:table-cell;padding:10px 12px;text-align:center;border-left:1px solid #eee;">
      <div style="font-size:11px;color:#777;margin-bottom:4px;">כסף2+כתום</div>
      <div style="font-size:18px;font-weight:700;color:#ea580c;">${silver2orangePct}%</div>
    </div>
    <div style="display:table-cell;padding:10px 12px;text-align:center;">
      <div style="font-size:11px;color:#777;margin-bottom:4px;">לבן+כסף</div>
      <div style="font-size:18px;font-weight:700;color:#16a34a;">${whitesilverPct}%</div>
    </div>
  </div>

  <!-- שורות רמות -->
  <div style="padding:8px 0;">
    ${gradeRows.map(grade => `
    <table style="width:100%;border-collapse:collapse;padding:0 12px;" cellpadding="0" cellspacing="0"><tr>
      <td style="width:52px;font-size:13px;color:#222;text-align:right;padding:4px 12px 4px 0;white-space:nowrap;">${grade.name}</td>
      <td style="width:12px;padding:0 2px;"><div style="width:8px;height:8px;border-radius:50%;background:${grade.color};margin:auto;"></div></td>
      <td style="padding:0 4px;"><div style="height:6px;background:#f0f0f0;border-radius:3px;"><div style="float:right;width:${grade.pct}%;height:6px;background:${grade.color};border-radius:3px;"></div></div></td>
      <td style="width:54px;font-size:13px;font-weight:700;color:#222;text-align:left;padding:4px 0 4px 4px;">${grade.count.toLocaleString()}</td>
      <td style="width:34px;font-size:12px;color:#888;text-align:left;padding:4px 0;">${grade.pct}%</td>
    </tr></table>`).join('')}
  </div>

  <!-- פסולים (רק אם יש) -->
  ${rejectActive.length > 0 ? `
  <div style="padding:6px 12px 10px;border-top:1px solid #f0f0f0;overflow:hidden;">
    <div style="float:right;font-size:12px;color:#888;">פסולים · <span style="color:#ea580c;font-weight:600;">${rejectsPct}%</span></div>
    <div style="font-size:12px;color:#555;text-align:left;">
      ${rejectActive.map((r, i) => `${r.name} ${getQ(r.name).toLocaleString()}${i < rejectActive.length - 1 ? ' · ' : ''}`).join('')}
    </div>
  </div>` : ''}

  <!-- FOOTER -->
  <div style="padding:12px 16px;display:table;width:100%;box-sizing:border-box;border-top:1px solid #eee;background:#fafafa;">
    <div style="display:table-cell;vertical-align:middle;width:120px;">
      <div style="background:#dcfce7;color:#15803d;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;margin-top:4px;">
      &#10003; ${event.status_type || 'בסיסי'}
    </div></div>
    <div style="display:table-cell;vertical-align:middle;text-align:right;">
      <div style="font-size:12px;color:#777;">סה&quot;כ לולבים</div>
      <div style="font-size:26px;font-weight:700;color:#16a34a;line-height:1.1;">${total.toLocaleString()}</div>
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
