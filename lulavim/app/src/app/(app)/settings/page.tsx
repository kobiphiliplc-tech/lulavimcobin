'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSeason } from '@/lib/context/SeasonContext'
import { useTheme } from '@/lib/context/ThemeContext'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { AlertTriangle, Plus, Pencil, Trash2, Check, X, ChevronDown, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Grade, GradeGroup } from '@/lib/types'

const GRADE_GROUPS: { key: GradeGroup; label: string; defaultColor: string; headerCls: string }[] = [
  { key: 'high',   label: 'רמה גבוהה', defaultColor: '#C0C0C0', headerCls: 'bg-gray-50 border-gray-200' },
  { key: 'mid',    label: 'רמה ביניים', defaultColor: '#FF9800', headerCls: 'bg-orange-50 border-orange-200' },
  { key: 'low',    label: 'רמה נמוכה',  defaultColor: '#2196F3', headerCls: 'bg-blue-50 border-blue-200' },
  { key: 'reject', label: 'בלאי',       defaultColor: '#795548', headerCls: 'bg-red-50 border-red-200' },
]

export default function SettingsPage() {
  const { fontSize, darkMode, setFontSize, setDarkMode } = useTheme()
  const { activeSeason, setActiveSeason, allSeasons, allSeasonRecords, startNewSeason, loading, refetchSeasons } = useSeason()
  const supabase = createClient()
  const [newSeasonName, setNewSeasonName] = useState('')
  const [newSeasonStart, setNewSeasonStart] = useState('')
  const [newSeasonEnd, setNewSeasonEnd] = useState('')
  const [saving, setSaving] = useState(false)

  // Collapsible cards state — only 'active-season' open by default
  const [openCards, setOpenCards] = useState<Set<string>>(new Set(['active-season']))

  function toggleCard(id: string) {
    setOpenCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  // Season-specific settings
  const [vatRate, setVatRate] = useState<number>(18)
  const [freshnessDate, setFreshnessDate] = useState<string>('')
  const [savingSeasonSettings, setSavingSeasonSettings] = useState(false)

  // Grade management
  const [grades, setGrades] = useState<Grade[]>([])
  const [gradesMissing, setGradesMissing] = useState(false)
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null)
  const [editingGradeName, setEditingGradeName] = useState('')
  const [addingInGroup, setAddingInGroup] = useState<GradeGroup | null>(null)
  const [newGradeName, setNewGradeName] = useState('')
  const [gradeBusy, setGradeBusy] = useState(false)

  useEffect(() => {
    async function fetchGrades() {
      const { data, error } = await supabase.from('grades').select('*').order('sort_order')
      if (error) { setGradesMissing(true); return }
      setGrades((data ?? []) as Grade[])
    }
    fetchGrades()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchSeasonSettings() {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [`vat_rate_${activeSeason}`, `freshness_date_${activeSeason}`])
      if (!data) return
      data.forEach(row => {
        if (row.key === `vat_rate_${activeSeason}`)      setVatRate(Number(row.value) || 18)
        if (row.key === `freshness_date_${activeSeason}`) setFreshnessDate(row.value ?? '')
      })
    }
    fetchSeasonSettings()
  }, [activeSeason]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSeasonChange(season: string) {
    setSaving(true)
    await setActiveSeason(season)
    setSaving(false)
    toast.success(`עונה פעילה עודכנה ל-${season}`)
  }

  async function handleStartNewSeason() {
    const name = newSeasonName.trim()
    if (!name) { toast.error('יש להזין שם עונה'); return }
    if (allSeasons.includes(name)) { toast.error('עונה זו כבר קיימת'); return }
    setSaving(true)
    await startNewSeason(name, newSeasonStart || undefined, newSeasonEnd || undefined)
    setSaving(false)
    setNewSeasonName('')
    setNewSeasonStart('')
    setNewSeasonEnd('')
    toast.success(`עונה ${name} הופעלה! המלאי הקודם נשמר.`)
  }

  async function handleDeleteSeason(year: string) {
    if (!confirm(`למחוק את עונה ${year}? הנתונים (מיון, קבלות) יישמרו.`)) return
    setSaving(true)
    await supabase.from('seasons').delete().eq('year', year)
    await refetchSeasons()
    setSaving(false)
    toast.success(`עונה ${year} נמחקה`)
  }

  async function saveGradeName(id: number) {
    if (!editingGradeName.trim()) return
    setGradeBusy(true)
    const { error } = await supabase.from('grades').update({ name: editingGradeName.trim() }).eq('id', id)
    setGradeBusy(false)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    setGrades(prev => prev.map(g => g.id === id ? { ...g, name: editingGradeName.trim() } : g))
    setEditingGradeId(null)
  }

  async function addGradeToGroup(group: GradeGroup) {
    if (!newGradeName.trim()) return
    setGradeBusy(true)
    const maxOrder = grades.filter(g => g.group_name === group).reduce((m, g) => Math.max(m, g.sort_order), 0)
    const meta = GRADE_GROUPS.find(g => g.key === group)!
    const { data, error } = await supabase.from('grades').insert({
      name: newGradeName.trim(),
      color: meta.defaultColor,
      text_color: '#ffffff',
      group_name: group,
      sort_order: maxOrder + 1,
    }).select().single()
    setGradeBusy(false)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    setGrades(prev => [...prev, data as Grade])
    setNewGradeName('')
    setAddingInGroup(null)
  }

  async function deleteGrade(id: number) {
    setGradeBusy(true)
    const { error } = await supabase.from('grades').delete().eq('id', id)
    setGradeBusy(false)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    setGrades(prev => prev.filter(g => g.id !== id))
  }

  async function handleSaveSeasonSettings() {
    setSavingSeasonSettings(true)
    const { error } = await supabase.from('settings').upsert([
      { key: `vat_rate_${activeSeason}`,      value: String(vatRate) },
      { key: `freshness_date_${activeSeason}`, value: freshnessDate  },
    ], { onConflict: 'key' })
    setSavingSeasonSettings(false)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    toast.success('הגדרות עונה נשמרו')
  }

  function CollapsibleCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    const isOpen = openCards.has(id)
    return (
      <Card>
        <button
          onClick={() => toggleCard(id)}
          className="w-full text-right"
          type="button"
        >
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
            <CardTitle className="text-base">{title}</CardTitle>
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0', isOpen && 'rotate-180')} />
          </CardHeader>
        </button>
        {isOpen && <CardContent>{children}</CardContent>}
      </Card>
    )
  }

  return (
    <div className="space-y-3 max-w-lg" dir="rtl">
      <div>
        <h1 className="text-xl font-bold">הגדרות</h1>
        <p className="text-xs text-gray-400 mt-0.5">ניהול עונות ומערכת</p>
      </div>

      {/* Appearance */}
      <CollapsibleCard id="appearance" title="מראה ותצוגה">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>גודל טקסט</Label>
            <div className="flex gap-2">
              {([
                { value: 'normal', label: 'רגיל' },
                { value: 'medium', label: 'בינוני' },
                { value: 'large',  label: 'גדול' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFontSize(opt.value)}
                  className={cn(
                    'flex-1 py-1.5 text-sm rounded-md border transition-colors',
                    fontSize === opt.value
                      ? 'bg-green-600 text-white border-green-600 font-medium'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-green-400'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {darkMode
                ? <Moon className="h-4 w-4 text-gray-500" />
                : <Sun className="h-4 w-4 text-gray-500" />
              }
              <Label htmlFor="dark-mode-switch" className="cursor-pointer">מצב כהה</Label>
            </div>
            <Switch
              id="dark-mode-switch"
              checked={darkMode}
              onCheckedChange={setDarkMode}
            />
          </div>
        </div>
      </CollapsibleCard>

      {/* Active season selector */}
      <CollapsibleCard id="active-season" title="עונה פעילה">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            כל הנתונים מוצגים ונשמרים לפי העונה הפעילה. ניתן לעבור בין עונות בכל עת.
          </p>
          <div className="space-y-1">
            <Label>בחר עונה</Label>
            {loading ? (
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
            ) : (
              <Select value={activeSeason} onValueChange={v => v && handleSeasonChange(v)} disabled={saving}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allSeasons.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <p className="text-xs text-green-700 font-medium">עונה נוכחית: {activeSeason}</p>
        </div>
      </CollapsibleCard>

      {/* Season-specific settings */}
      <CollapsibleCard id="season-settings" title={`הגדרות עונה — ${activeSeason}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="vat-rate">אחוז מע״מ (%)</Label>
              <Input
                id="vat-rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={vatRate}
                onChange={e => setVatRate(Number(e.target.value) || 0)}
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="freshness-date">תאריך גבול טרי/מוקדם</Label>
              <Input
                id="freshness-date"
                type="date"
                value={freshnessDate}
                onChange={e => setFreshnessDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            קטיף מתאריך זה ואילך — <strong>טרי</strong>. לפני תאריך זה — <strong>מוקדם</strong>.
          </p>
          <Button
            onClick={handleSaveSeasonSettings}
            disabled={savingSeasonSettings}
            className="bg-green-600 hover:bg-green-700"
          >
            {savingSeasonSettings ? 'שומר...' : 'שמור הגדרות עונה'}
          </Button>
        </div>
      </CollapsibleCard>

      {/* Start new season */}
      <CollapsibleCard id="new-season" title="התחל עונה חדשה">
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>מלאי קיים נשאר בעונה הנוכחית. העונה החדשה מתחילה ממלאי אפס.</span>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-season-name">שם העונה החדשה</Label>
            <Input
              id="new-season-name"
              placeholder="לדוגמה: 2026"
              value={newSeasonName}
              onChange={e => setNewSeasonName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleStartNewSeason() }}
              className="w-48"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="new-season-start">תאריך פתיחה</Label>
              <Input
                id="new-season-start"
                type="date"
                value={newSeasonStart}
                onChange={e => setNewSeasonStart(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-season-end">תאריך סיום</Label>
              <Input
                id="new-season-end"
                type="date"
                value={newSeasonEnd}
                onChange={e => setNewSeasonEnd(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">תאריכי הפתיחה והסיום משמשים לחישוב תזכורות במשימות.</p>
          <Button
            onClick={handleStartNewSeason}
            disabled={saving || !newSeasonName.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? 'שומר...' : 'התחל עונה חדשה'}
          </Button>
        </div>
      </CollapsibleCard>

      {/* Season history */}
      <CollapsibleCard id="season-history" title="היסטוריית עונות">
        <div className="space-y-1">
          {allSeasons.map(s => {
            const record = allSeasonRecords.find(r => r.year === s)
            return (
              <div key={s} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium">{s}</span>
                  {record?.start_date && (
                    <span className="text-xs text-gray-400">
                      {record.start_date}{record.end_date ? ` — ${record.end_date}` : ''}
                    </span>
                  )}
                </div>
                {s === activeSeason ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">פעילה</span>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      className="text-xs text-gray-400 hover:text-green-700 transition-colors"
                      onClick={() => handleSeasonChange(s)}
                      disabled={saving}
                    >
                      עבור לעונה
                    </button>
                    <button
                      className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                      onClick={() => handleDeleteSeason(s)}
                      disabled={saving}
                      title="מחק עונה"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CollapsibleCard>

      {/* Grade management */}
      <CollapsibleCard id="grades" title="ניהול רמות מיון">
        <div>
          {gradesMissing && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
              טבלת הרמות לא קיימת במסד הנתונים. יש להריץ את ה-SQL Migration תחילה.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {GRADE_GROUPS.map(group => (
              <div key={group.key} className={`border rounded-lg p-3 ${group.headerCls}`}>
                <p className="text-xs font-semibold mb-2">{group.label}</p>
                <div className="space-y-1">
                  {grades.filter(g => g.group_name === group.key).map(grade => (
                    <div key={grade.id} className="flex items-center gap-2 group/row">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: grade.color }} />
                      {editingGradeId === grade.id ? (
                        <>
                          <input
                            className="flex-1 text-sm border rounded px-1 h-6 bg-white"
                            value={editingGradeName}
                            onChange={e => setEditingGradeName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveGradeName(grade.id)
                              if (e.key === 'Escape') setEditingGradeId(null)
                            }}
                            autoFocus
                          />
                          <button onClick={() => saveGradeName(grade.id)} disabled={gradeBusy}>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </button>
                          <button onClick={() => setEditingGradeId(null)}>
                            <X className="h-3.5 w-3.5 text-gray-400" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{grade.name}</span>
                          <button
                            className="opacity-0 group-hover/row:opacity-100 transition-opacity"
                            onClick={() => { setEditingGradeId(grade.id); setEditingGradeName(grade.name) }}
                          >
                            <Pencil className="h-3 w-3 text-gray-400 hover:text-blue-500" />
                          </button>
                          <button
                            className="opacity-0 group-hover/row:opacity-100 transition-opacity"
                            onClick={() => deleteGrade(grade.id)}
                            disabled={gradeBusy}
                          >
                            <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {addingInGroup === group.key ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        className="flex-1 text-sm border rounded px-1 h-6 bg-white"
                        placeholder="שם רמה"
                        value={newGradeName}
                        onChange={e => setNewGradeName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') addGradeToGroup(group.key)
                          if (e.key === 'Escape') setAddingInGroup(null)
                        }}
                        autoFocus
                      />
                      <button onClick={() => addGradeToGroup(group.key)} disabled={gradeBusy}>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      </button>
                      <button onClick={() => setAddingInGroup(null)}>
                        <X className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-700 mt-1 transition-colors"
                      onClick={() => { setAddingInGroup(group.key); setNewGradeName('') }}
                    >
                      <Plus className="h-3 w-3" /> הוסף רמה
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleCard>
    </div>
  )
}
