'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/lib/context/SeasonContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskForm } from '@/components/tasks/TaskForm'
import { TabToday } from '@/components/tasks/TabToday'
import { TabAllTasks } from '@/components/tasks/TabAllTasks'
import { TabCalendar } from '@/components/tasks/TabCalendar'
import { TabTimeline } from '@/components/tasks/TabTimeline'
import { TabNotes } from '@/components/tasks/TabNotes'
import type { Task, TeamMember } from '@/lib/types'

function TasksInner() {
  const supabase = createClient()
  const { activeSeason, currentSeasonDates, nextSeasonDates } = useSeason()

  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState('today')
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>()

  const daysToNextSeason = nextSeasonDates?.start_date
    ? Math.ceil((new Date(nextSeasonDates.start_date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    const [tasksRes, membersRes] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('team_members').select('*').order('name'),
    ])

    if (tasksRes.data) setTasks(tasksRes.data as Task[])
    if (membersRes.data) setMembers(membersRes.data as TeamMember[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleSave(payload: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by_user_id'>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    const full = { ...payload, season_year: payload.season_context === 'timeless' ? undefined : activeSeason, created_by_user_id: user?.id }

    if (editingTask) {
      const { data, error } = await supabase
        .from('tasks')
        .update(full)
        .eq('id', editingTask.id)
        .select()
        .single()
      if (error) { toast.error('שגיאה בשמירה: ' + error.message); return false }
      setTasks(prev => prev.map(t => t.id === editingTask.id ? data as Task : t))
      toast.success('משימה עודכנה')
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .insert(full)
        .select()
        .single()
      if (error) { toast.error('שגיאה בשמירה: ' + error.message); return false }
      setTasks(prev => [data as Task, ...prev])
      toast.success('משימה נוצרה')
    }
    setEditingTask(null)
    return true
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setDefaultDate(undefined)
    setFormOpen(true)
  }

  function openNew(date?: string) {
    setEditingTask(null)
    setDefaultDate(date)
    setFormOpen(true)
  }

  async function handleToggleStatus(task: Task) {
    const newStatus = task.status === 'done' ? 'open' : 'done'
    const { data, error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id)
      .select()
      .single()
    if (error) { toast.error('שגיאה בעדכון: ' + error.message); return }

    setTasks(prev => prev.map(t => t.id === task.id ? data as Task : t))

    if (newStatus === 'done') {
      let undone = false
      const undoToast = toast('משימה הושלמה', {
        action: {
          label: 'ביטול',
          onClick: async () => {
            undone = true
            await supabase.from('tasks').update({ status: 'open' }).eq('id', task.id)
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'open' } : t))
          },
        },
        duration: 3000,
        onDismiss: () => { if (!undone) {} },
      })
      void undoToast
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) { toast.error('שגיאה במחיקה: ' + error.message); return }
    setTasks(prev => prev.filter(t => t.id !== id))
    toast.success('משימה נמחקה')
  }

  async function handleInlineEdit(id: string, title: string) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ title })
      .eq('id', id)
      .select()
      .single()
    if (error) { toast.error('שגיאה בעריכה: ' + error.message); return }
    setTasks(prev => prev.map(t => t.id === id ? data as Task : t))
  }

  async function handleQuickAdd(title: string, dueDate?: string) {
    const payload = {
      title,
      status: 'open' as const,
      priority: 'normal' as const,
      task_type: 'task' as const,
      season_context: 'current' as const,
      season_year: activeSeason,
      is_recurring: false,
      is_private: false,
      due_date: dueDate,
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...payload, created_by_user_id: user?.id })
      .select()
      .single()
    if (error) { toast.error('שגיאה ביצירת משימה: ' + error.message); return }
    setTasks(prev => [data as Task, ...prev])
  }

  async function handleSaveNote(id: string, title: string, description: string) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ title, description })
      .eq('id', id)
      .select()
      .single()
    if (error) { toast.error('שגיאה בשמירת הערה: ' + error.message); return }
    setTasks(prev => prev.map(t => t.id === id ? data as Task : t))
  }

  async function handleCreateNote(title: string, description: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title, description,
        status: 'open', priority: 'normal', task_type: 'note',
        season_context: 'timeless', is_recurring: false, is_private: false,
        created_by_user_id: user?.id,
      })
      .select()
      .single()
    if (error) { toast.error('שגיאה ביצירת הערה: ' + error.message); return }
    setTasks(prev => [data as Task, ...prev])
  }

  const openTaskCount = tasks.filter(t => t.status !== 'done' && t.task_type === 'task').length

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">משימות</h1>
            <span className="text-sm bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
              🌿 עונת {activeSeason}
            </span>
            {openTaskCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {openTaskCount} פתוחות
              </span>
            )}
            {daysToNextSeason !== null && daysToNextSeason > 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                ⏱ {daysToNextSeason} ימים לפתיחת עונה הבאה
              </span>
            )}
            {daysToNextSeason === null && (
              <span className="text-xs text-gray-400">עונה הבאה טרם הוגדרה</span>
            )}
          </div>
          <Button onClick={() => openNew()} className="gap-2">
            <Plus className="h-4 w-4" />
            משימה חדשה
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex w-full overflow-x-auto gap-1 bg-white border border-gray-200 p-1 rounded-xl h-auto flex-wrap sm:flex-nowrap">
              <TabsTrigger value="today" className="flex-1 min-w-fit text-sm rounded-lg">היום</TabsTrigger>
              <TabsTrigger value="all" className="flex-1 min-w-fit text-sm rounded-lg">כל המשימות</TabsTrigger>
              <TabsTrigger value="calendar" className="flex-1 min-w-fit text-sm rounded-lg">לוח שנה</TabsTrigger>
              <TabsTrigger value="timeline" className="flex-1 min-w-fit text-sm rounded-lg">ציר עונה</TabsTrigger>
              <TabsTrigger value="notes" className="flex-1 min-w-fit text-sm rounded-lg">הערות</TabsTrigger>
            </TabsList>

            <TabsContent value="today">
              <TabToday
                tasks={tasks}
                members={members}
                currentUserId={currentUserId}
                nextSeasonStart={nextSeasonDates?.start_date}
                onToggleStatus={handleToggleStatus}
                onEdit={openEdit}
                onDelete={handleDelete}
                onInlineEdit={handleInlineEdit}
                onQuickAdd={handleQuickAdd}
              />
            </TabsContent>

            <TabsContent value="all">
              <TabAllTasks
                tasks={tasks}
                members={members}
                currentUserId={currentUserId}
                onToggleStatus={handleToggleStatus}
                onEdit={openEdit}
                onDelete={handleDelete}
                onInlineEdit={handleInlineEdit}
              />
            </TabsContent>

            <TabsContent value="calendar">
              <TabCalendar
                tasks={tasks}
                seasonStart={currentSeasonDates?.start_date}
                seasonEnd={currentSeasonDates?.end_date}
                onTaskClick={openEdit}
                onDateClick={date => openNew(date)}
              />
            </TabsContent>

            <TabsContent value="timeline">
              <TabTimeline
                tasks={tasks}
                seasonStart={currentSeasonDates?.start_date}
                seasonEnd={currentSeasonDates?.end_date}
                onTaskClick={openEdit}
              />
            </TabsContent>

            <TabsContent value="notes">
              <TabNotes
                tasks={tasks}
                onSaveNote={handleSaveNote}
                onCreateNote={handleCreateNote}
                onDelete={handleDelete}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* FAB — mobile */}
      <button
        onClick={() => openNew()}
        className="fixed bottom-6 left-4 sm:hidden w-14 h-14 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-green-700 transition-colors z-40"
        aria-label="משימה חדשה"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Task form modal */}
      <TaskForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingTask(null) }}
        onSave={handleSave}
        task={editingTask}
        members={members}
        defaultDate={defaultDate}
      />
    </div>
  )
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    }>
      <TasksInner />
    </Suspense>
  )
}
