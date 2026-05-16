'use client'

import { useState, useMemo } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { TaskCard } from './TaskCard'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { Task, TeamMember } from '@/lib/types'

interface Props {
  tasks: Task[]
  members: TeamMember[]
  currentUserId?: string
  onToggleStatus: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onInlineEdit: (id: string, title: string) => void
  onChecklistItemToggle?: (task: Task, itemId: string) => void
}

type FilterPill = 'all' | 'open' | 'mine' | 'urgent' | 'next'
type SortBy = 'date' | 'priority' | 'entity'

interface Filters {
  season: string
  entity: string
  member: string
}

const pillLabels: Record<FilterPill, string> = {
  all: 'הכל', open: 'פתוחות', mine: 'שלי', urgent: 'דחוף', next: 'עונה הבאה',
}

export function TabAllTasks({ tasks, members, currentUserId, onToggleStatus, onEdit, onDelete, onInlineEdit, onChecklistItemToggle }: Props) {
  const [pill, setPill] = useState<FilterPill>('all')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [filters, setFilters] = useState<Filters>({ season: 'all', entity: 'all', member: 'all' })
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filteredTasks = useMemo(() => {
    let list = tasks.filter(t => t.task_type === 'task')

    // pill filters
    if (pill === 'open') list = list.filter(t => t.status !== 'done')
    if (pill === 'mine') list = list.filter(t => t.created_by_user_id === currentUserId || t.assigned_to_member_id?.toString() === currentUserId)
    if (pill === 'urgent') list = list.filter(t => t.priority === 'urgent' && t.status !== 'done')
    if (pill === 'next') list = list.filter(t => t.season_context === 'next')

    // side filters
    if (filters.season !== 'all') list = list.filter(t => t.season_context === filters.season)
    if (filters.entity !== 'all') list = list.filter(t => t.linked_entity_type === filters.entity)
    if (filters.member !== 'all') list = list.filter(t => t.assigned_to_member_id === Number(filters.member))

    // sort: done always last, then by chosen criterion
    list = [...list].sort((a, b) => {
      const doneDiff = (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0)
      if (doneDiff !== 0) return doneDiff
      if (sortBy === 'date') return (a.due_date ?? 'z').localeCompare(b.due_date ?? 'z')
      if (sortBy === 'priority') return (a.priority === 'urgent' ? -1 : 1) - (b.priority === 'urgent' ? -1 : 1)
      if (sortBy === 'entity') return (a.linked_entity_type ?? 'z').localeCompare(b.linked_entity_type ?? 'z')
      return 0
    })

    return list
  }, [tasks, pill, filters, sortBy, currentUserId])

  const activeFilterCount = [
    filters.season !== 'all', filters.entity !== 'all', filters.member !== 'all',
  ].filter(Boolean).length

  const FilterPanel = () => (
    <div className="space-y-5 py-2" dir="rtl">
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">לפי עונה</p>
        {[['all','כולן'],['current','נוכחית'],['next','הבאה'],['timeless','קבועות']].map(([v,l]) => (
          <label key={v} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
            <input type="radio" name="season" checked={filters.season === v} onChange={() => setFilters(f => ({...f, season: v}))} />
            {l}
          </label>
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">לפי שיוך</p>
        {[['all','הכל'],['customer','לקוחות'],['supplier','ספקים'],['product','מוצרים'],['payment','תשלומים'],['general','כללי']].map(([v,l]) => (
          <label key={v} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
            <input type="radio" name="entity" checked={filters.entity === v} onChange={() => setFilters(f => ({...f, entity: v}))} />
            {l}
          </label>
        ))}
      </div>
      {members.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">לפי אחראי</p>
          {[{id:'all',name:'כולם'}, ...members].map(m => (
            <label key={m.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
              <input type="radio" name="member" checked={filters.member === String(m.id)} onChange={() => setFilters(f => ({...f, member: String(m.id)}))} />
              {m.name}
            </label>
          ))}
        </div>
      )}
      {activeFilterCount > 0 && (
        <button onClick={() => setFilters({season:'all',entity:'all',member:'all'})} className="text-xs text-red-500 hover:underline">
          נקה סינון
        </button>
      )}
    </div>
  )

  return (
    <div className="flex gap-6">
      {/* Sidebar — desktop */}
      <aside className="hidden md:block w-48 flex-shrink-0 border-l border-gray-100 pl-4">
        <p className="text-xs font-bold text-gray-500 mb-3">סינון</p>
        <FilterPanel />
      </aside>

      <div className="flex-1 min-w-0 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          {/* Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 flex-wrap">
            {(Object.entries(pillLabels) as [FilterPill, string][]).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setPill(k)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${pill === k ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            >
              <option value="date">לפי תאריך</option>
              <option value="priority">לפי עדיפות</option>
              <option value="entity">לפי שיוך</option>
            </select>

            {/* Mobile filter sheet */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger>
                <span className="md:hidden flex items-center gap-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white relative cursor-pointer">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  סינון
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -left-1 w-4 h-4 bg-green-600 text-white text-[9px] rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </span>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh] overflow-y-auto" dir="rtl">
                <SheetHeader>
                  <SheetTitle>סינון</SheetTitle>
                </SheetHeader>
                <FilterPanel />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {filters.season !== 'all' && (
              <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                עונה: {filters.season}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(f => ({...f, season:'all'}))} />
              </span>
            )}
            {filters.entity !== 'all' && (
              <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                שיוך: {filters.entity}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(f => ({...f, entity:'all'}))} />
              </span>
            )}
            {filters.member !== 'all' && (
              <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {members.find(m => String(m.id) === filters.member)?.name}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(f => ({...f, member:'all'}))} />
              </span>
            )}
          </div>
        )}

        {/* Task list */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">אין משימות התואמות את הסינון</div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(t => (
              <TaskCard
                key={t.id}
                task={t}
                members={members}
                currentUserId={currentUserId}
                onToggleStatus={onToggleStatus}
                onEdit={onEdit}
                onDelete={onDelete}
                onInlineEdit={onInlineEdit}
                onChecklistItemToggle={onChecklistItemToggle}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">{filteredTasks.length} משימות</p>
      </div>
    </div>
  )
}
