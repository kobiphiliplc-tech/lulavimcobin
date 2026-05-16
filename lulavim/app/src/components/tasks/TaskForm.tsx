'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HebrewDatePicker } from './HebrewDatePicker'
import { DeepLinkPicker } from './DeepLinkPicker'
import { ChecklistEditor } from './ChecklistEditor'
import type { Task, TeamMember, ChecklistItem } from '@/lib/types'
import { isChecklist, parseChecklist, serializeChecklist, newItem, textToChecklist } from '@/lib/checklist'

const schema = z.object({
  title:                       z.string().min(1, 'כותרת חובה'),
  description:                 z.string().optional(),
  status:                      z.enum(['open', 'in_progress', 'done']),
  priority:                    z.enum(['normal', 'urgent']),
  task_type:                   z.enum(['task', 'note']),
  date_mode:                   z.enum(['specific', 'reminder', 'none']),
  due_date:                    z.string().optional(),
  due_time:                    z.string().optional(),
  reminder_days_before_season: z.number().optional(),
  season_context:              z.enum(['current', 'next', 'timeless']),
  entity_mode:                 z.enum(['none', 'entity', 'record']),
  linked_entity_type:          z.string().optional(),
  linked_entity_id:            z.string().optional(),
  linked_entity_name:          z.string().optional(),
  linked_module:               z.string().optional(),
  linked_sub_module:           z.string().optional(),
  linked_record_id:            z.string().optional(),
  linked_record_label:         z.string().optional(),
  linked_deep_link_path:       z.string().optional(),
  assigned_to_member_id:       z.number().optional(),
  assigned_to_name:            z.string().optional(),
  is_recurring:                z.boolean(),
  recurring_expires_year:      z.number().optional(),
  is_private:                  z.boolean(),
})

type FormData = z.infer<typeof schema>

function toFormData(task: Task): Partial<FormData> {
  const date_mode: 'specific' | 'reminder' | 'none' = task.due_date
    ? 'specific'
    : task.reminder_days_before_season != null
      ? 'reminder'
      : 'none'
  const entity_mode: 'none' | 'entity' | 'record' = task.linked_entity_type === 'screen_record'
    ? 'record'
    : task.linked_entity_type
      ? 'entity'
      : 'none'
  return {
    title:                       task.title,
    description:                 task.description ?? undefined,
    status:                      task.status,
    priority:                    task.priority,
    task_type:                   task.task_type,
    date_mode,
    due_date:                    task.due_date ?? undefined,
    due_time:                    task.due_time ?? undefined,
    reminder_days_before_season: task.reminder_days_before_season ?? undefined,
    season_context:              task.season_context,
    entity_mode,
    linked_entity_type:          task.linked_entity_type ?? undefined,
    linked_entity_id:            task.linked_entity_id ?? undefined,
    linked_entity_name:          task.linked_entity_name ?? undefined,
    linked_module:               task.linked_module ?? undefined,
    linked_sub_module:           task.linked_sub_module ?? undefined,
    linked_record_id:            task.linked_record_id ?? undefined,
    linked_record_label:         task.linked_record_label ?? undefined,
    linked_deep_link_path:       task.linked_deep_link_path ?? undefined,
    assigned_to_member_id:       task.assigned_to_member_id ?? undefined,
    is_recurring:                task.is_recurring,
    recurring_expires_year:      task.recurring_expires_year ?? undefined,
    is_private:                  task.is_private,
  }
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by_user_id'>) => Promise<boolean>
  task?: Task | null
  members: TeamMember[]
  defaultDate?: string
}

const ENTITY_OPTIONS = [
  { value: 'customer',  label: 'לקוח' },
  { value: 'supplier',  label: 'ספק' },
  { value: 'product',   label: 'מוצר' },
  { value: 'payment',   label: 'תשלום' },
  { value: 'general',   label: 'כללי' },
]

const selectCls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500'
const radioCls = 'flex items-center gap-2 text-sm cursor-pointer'

export function TaskForm({ open, onClose, onSave, task, members, defaultDate }: Props) {
  const [descMode, setDescMode] = useState<'text' | 'checklist'>('text')
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', description: '', status: 'open', priority: 'normal',
      task_type: 'task', date_mode: defaultDate ? 'specific' : 'none',
      due_date: defaultDate, season_context: 'current',
      entity_mode: 'none', is_recurring: false, is_private: false,
    },
  })

  useEffect(() => {
    if (task) {
      reset(toFormData(task) as FormData)
      if (isChecklist(task.description)) {
        setDescMode('checklist')
        setChecklistItems(parseChecklist(task.description))
      } else {
        setDescMode('text')
        setChecklistItems([])
      }
    } else {
      reset({
        title: '', description: '', status: 'open', priority: 'normal',
        task_type: 'task', date_mode: defaultDate ? 'specific' : 'none',
        due_date: defaultDate ?? undefined, season_context: 'current',
        entity_mode: 'none', is_recurring: false, is_private: false,
      })
      setDescMode('text')
      setChecklistItems([])
    }
  }, [task, defaultDate, reset])

  const dateMode = watch('date_mode')
  const entityMode = watch('entity_mode')
  const isRecurring = watch('is_recurring')
  const taskType = watch('task_type')

  async function onSubmit(data: FormData) {
    const resolvedDescription = descMode === 'checklist'
      ? (checklistItems.some(i => i.text.trim())
          ? serializeChecklist(checklistItems.filter(i => i.text.trim()))
          : undefined)
      : data.description || undefined

    const payload: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by_user_id'> = {
      title: data.title,
      description: resolvedDescription,
      status: data.status,
      priority: data.priority,
      task_type: data.task_type,
      due_date: data.date_mode === 'specific' ? data.due_date : undefined,
      due_time: data.date_mode === 'specific' ? data.due_time : undefined,
      reminder_days_before_season: data.date_mode === 'reminder' ? data.reminder_days_before_season : undefined,
      season_context: data.season_context,
      is_recurring: data.is_recurring,
      recurring_expires_year: data.is_recurring ? data.recurring_expires_year : undefined,
      linked_entity_type: data.entity_mode === 'entity' ? data.linked_entity_type : data.entity_mode === 'record' ? 'screen_record' : undefined,
      linked_entity_id: data.entity_mode === 'entity' ? data.linked_entity_id : undefined,
      linked_entity_name: data.entity_mode === 'entity' ? data.linked_entity_name : data.linked_entity_name,
      linked_module: data.entity_mode === 'record' ? data.linked_module : undefined,
      linked_sub_module: data.entity_mode === 'record' ? data.linked_sub_module : undefined,
      linked_record_id: data.entity_mode === 'record' ? data.linked_record_id : undefined,
      linked_record_label: data.entity_mode === 'record' ? data.linked_record_label : undefined,
      linked_deep_link_path: data.entity_mode === 'record' ? data.linked_deep_link_path : undefined,
      assigned_to_member_id: data.assigned_to_member_id || undefined,
      assigned_to_name: members.find(m => m.id === data.assigned_to_member_id)?.name,
      is_private: data.is_private,
    }
    const success = await onSave(payload)
    if (success) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{task ? 'עריכת משימה' : 'משימה חדשה'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">

          {/* כותרת + תיאור */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">כותרת *</Label>
              <Input id="title" {...register('title')} placeholder="כותרת המשימה..." className="mt-1" dir="rtl" />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="description">תיאור</Label>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <button
                    type="button"
                    onClick={() => {
                      if (descMode !== 'text') {
                        setValue('description', checklistItems.map(i => i.text).filter(Boolean).join('\n'))
                      }
                      setDescMode('text')
                    }}
                    className={descMode === 'text' ? 'font-semibold text-green-700' : 'hover:text-gray-700 transition-colors'}
                  >
                    טקסט
                  </button>
                  <span className="text-gray-200">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (descMode !== 'checklist') {
                        const currentText = watch('description') || ''
                        setChecklistItems(currentText.trim() ? textToChecklist(currentText) : [newItem()])
                      }
                      setDescMode('checklist')
                    }}
                    className={descMode === 'checklist' ? 'font-semibold text-green-700' : 'hover:text-gray-700 transition-colors'}
                  >
                    ✓ רשימה
                  </button>
                </div>
              </div>
              {descMode === 'text' ? (
                <Textarea id="description" {...register('description')} placeholder="פרטים נוספים..." className="mt-1 resize-none" rows={2} dir="rtl" />
              ) : (
                <div className="mt-1">
                  <ChecklistEditor items={checklistItems} onChange={setChecklistItems} />
                </div>
              )}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* סוג */}
          <div className="flex gap-4">
            <Controller control={control} name="task_type" render={({ field }) => (
              <>
                <label className={radioCls}>
                  <input type="radio" {...field} value="task" checked={field.value === 'task'} onChange={() => field.onChange('task')} />
                  משימה
                </label>
                <label className={radioCls}>
                  <input type="radio" {...field} value="note" checked={field.value === 'note'} onChange={() => field.onChange('note')} />
                  הערה חופשית
                </label>
              </>
            )} />
          </div>

          {taskType === 'task' && (
            <>
              <hr className="border-gray-100" />

              {/* מתי? */}
              <div className="space-y-2">
                <Label>מתי?</Label>
                <Controller control={control} name="date_mode" render={({ field }) => (
                  <div className="space-y-2">
                    <label className={radioCls}>
                      <input type="radio" {...field} value="specific" checked={field.value === 'specific'} onChange={() => field.onChange('specific')} />
                      תאריך ספציפי
                    </label>
                    {dateMode === 'specific' && (
                      <div className="mr-5 flex gap-2">
                        <div className="flex-1">
                          <Controller control={control} name="due_date" render={({ field: f }) => (
                            <HebrewDatePicker value={f.value} onChange={f.onChange} />
                          )} />
                        </div>
                        <Input type="time" {...register('due_time')} className="w-28" />
                      </div>
                    )}
                    <label className={radioCls}>
                      <input type="radio" {...field} value="reminder" checked={field.value === 'reminder'} onChange={() => field.onChange('reminder')} />
                      ימים לפני פתיחת עונה הבאה
                    </label>
                    {dateMode === 'reminder' && (
                      <div className="mr-5 flex items-center gap-2">
                        <Input type="number" {...register('reminder_days_before_season', { valueAsNumber: true })} min={1} max={365} className="w-24" />
                        <span className="text-sm text-gray-500">ימים לפני</span>
                      </div>
                    )}
                    <label className={radioCls}>
                      <input type="radio" {...field} value="none" checked={field.value === 'none'} onChange={() => field.onChange('none')} />
                      ללא תאריך
                    </label>
                  </div>
                )} />
              </div>

              <hr className="border-gray-100" />

              {/* קשור ל */}
              <div className="space-y-2">
                <Label>קשור ל</Label>
                <Controller control={control} name="entity_mode" render={({ field }) => (
                  <div className="space-y-2">
                    <label className={radioCls}>
                      <input type="radio" {...field} value="none" checked={field.value === 'none'} onChange={() => field.onChange('none')} />
                      ללא קישור
                    </label>
                    <label className={radioCls}>
                      <input type="radio" {...field} value="entity" checked={field.value === 'entity'} onChange={() => field.onChange('entity')} />
                      ישות (לקוח / ספק / מוצר...)
                    </label>
                    {entityMode === 'entity' && (
                      <div className="mr-5 flex gap-2">
                        <Controller control={control} name="linked_entity_type" render={({ field: f }) => (
                          <select {...f} value={f.value ?? ''} onChange={e => f.onChange(e.target.value)} className={selectCls + ' flex-1'}>
                            <option value="">בחר סוג...</option>
                            {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        )} />
                        <Input {...register('linked_entity_name')} placeholder="שם..." className="flex-1" dir="rtl" />
                      </div>
                    )}
                    <label className={radioCls}>
                      <input type="radio" {...field} value="record" checked={field.value === 'record'} onChange={() => field.onChange('record')} />
                      רשומה ספציפית (קישור עמוק)
                    </label>
                    {entityMode === 'record' && (
                      <div className="mr-5">
                        <DeepLinkPicker
                          currentLabel={watch('linked_record_label')}
                          onSelect={data => {
                            setValue('linked_module', data.linked_module)
                            setValue('linked_sub_module', data.linked_sub_module)
                            setValue('linked_record_id', data.linked_record_id)
                            setValue('linked_record_label', data.linked_record_label)
                            setValue('linked_deep_link_path', data.linked_deep_link_path)
                            setValue('linked_entity_name', data.linked_entity_name)
                          }}
                          onClear={() => {
                            setValue('linked_module', undefined)
                            setValue('linked_record_id', undefined)
                            setValue('linked_record_label', undefined)
                            setValue('linked_deep_link_path', undefined)
                          }}
                        />
                      </div>
                    )}
                  </div>
                )} />
              </div>

              <hr className="border-gray-100" />

              {/* עונה + אחראי + עדיפות */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>עונה</Label>
                  <Controller control={control} name="season_context" render={({ field }) => (
                    <select {...field} className={selectCls + ' mt-1'}>
                      <option value="current">נוכחית</option>
                      <option value="next">הבאה</option>
                      <option value="timeless">ללא קשר לעונה</option>
                    </select>
                  )} />
                </div>
                <div>
                  <Label>אחראי</Label>
                  <Controller control={control} name="assigned_to_member_id" render={({ field }) => (
                    <select value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} onBlur={field.onBlur} name={field.name} ref={field.ref} className={selectCls + ' mt-1'}>
                      <option value="">כולם</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )} />
                </div>
              </div>

              <div>
                <Label>עדיפות</Label>
                <div className="flex gap-4 mt-1">
                  <Controller control={control} name="priority" render={({ field }) => (
                    <>
                      <label className={radioCls}>
                        <input type="radio" {...field} value="normal" checked={field.value === 'normal'} onChange={() => field.onChange('normal')} />
                        רגיל
                      </label>
                      <label className={radioCls + ' text-red-600'}>
                        <input type="radio" {...field} value="urgent" checked={field.value === 'urgent'} onChange={() => field.onChange('urgent')} />
                        דחוף
                      </label>
                    </>
                  )} />
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* אפשרויות נוספות */}
              <details className="group">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 list-none">
                  <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                  אפשרויות נוספות
                </summary>
                <div className="mt-3 space-y-3 pr-4 border-r-2 border-gray-100">
                  <div className="flex items-center gap-3">
                    <Controller control={control} name="is_recurring" render={({ field }) => (
                      <button
                        type="button"
                        onClick={() => field.onChange(!field.value)}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${field.value ? 'bg-green-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${field.value ? '-translate-x-4' : '-translate-x-0.5'}`} />
                      </button>
                    )} />
                    <span className="text-sm">↻ חוזרת כל עונה</span>
                  </div>
                  {isRecurring && (
                    <div className="flex items-center gap-2 mr-8">
                      <span className="text-sm text-gray-500">פג תוקף אחרי שנת:</span>
                      <Input type="number" {...register('recurring_expires_year', { valueAsNumber: true })} min={2025} max={2099} className="w-24" />
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Controller control={control} name="is_private" render={({ field }) => (
                      <button
                        type="button"
                        onClick={() => field.onChange(!field.value)}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${field.value ? 'bg-green-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${field.value ? '-translate-x-4' : '-translate-x-0.5'}`} />
                      </button>
                    )} />
                    <div>
                      <span className="text-sm">🔒 משימה פרטית</span>
                      <p className="text-xs text-gray-400">רק אתה תראה משימה זו</p>
                    </div>
                  </div>
                </div>
              </details>
            </>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'שומר...' : 'שמור'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
