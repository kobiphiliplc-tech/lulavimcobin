'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Customer } from '@/lib/types'

const METHODS = ['העברה בנקאית', 'שיק', 'מזומן', 'מטבע חוץ'] as const

function nanToUndef(v: unknown) {
  return typeof v === 'number' && isNaN(v) ? undefined : v
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const schema = z.object({
  customer_id:    z.preprocess(nanToUndef, z.number({ message: 'חובה' })),
  payment_date:   z.string().min(1, 'חובה'),
  method:         z.enum(METHODS),
  amount:         z.preprocess(nanToUndef, z.number({ message: 'חובה' }).positive('חייב להיות חיובי')),
  currency:       z.string().default('ILS'),
  check_number:   z.string().optional(),
  check_due_date: z.string().optional(),
  notes:          z.string().optional(),
})
export type PaymentFormData = z.infer<typeof schema>

const selectCls = "w-full rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm h-9 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: PaymentFormData) => Promise<void>
  customers: Customer[]
  defaultCustomerId?: number
  defaultCurrency?: string
  orderId?: number
}

export function PaymentFormDialog({ open, onClose, onSave, customers, defaultCustomerId, defaultCurrency }: Props) {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<PaymentFormData>({
    resolver: zodResolver(schema) as Resolver<PaymentFormData>,
    defaultValues: {
      payment_date: todayISO(),
      method: 'העברה בנקאית',
      currency: defaultCurrency ?? 'ILS',
      customer_id: defaultCustomerId,
    },
  })

  const method = watch('method')

  useEffect(() => {
    reset({
      payment_date: todayISO(),
      method: 'העברה בנקאית',
      currency: defaultCurrency ?? 'ILS',
      customer_id: defaultCustomerId,
    })
  }, [open, reset, defaultCustomerId, defaultCurrency])

  const onSubmit = async (data: PaymentFormData) => {
    await onSave(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>רישום תשלום</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!defaultCustomerId && (
            <div className="space-y-1">
              <Label>לקוח *</Label>
              <select {...register('customer_id', { valueAsNumber: true })} className={selectCls}>
                <option value="">בחר לקוח...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.customer_id && <p className="text-xs text-destructive">{errors.customer_id.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>תאריך תשלום *</Label>
              <Input type="date" {...register('payment_date')} />
              {errors.payment_date && <p className="text-xs text-destructive">{errors.payment_date.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>שיטת תשלום *</Label>
              <select {...register('method')} className={selectCls}>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>סכום *</Label>
              <Input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} placeholder="0" dir="ltr" />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>מטבע</Label>
              <select {...register('currency')} className={selectCls}>
                <option value="ILS">₪ שקל</option>
                <option value="USD">$ דולר</option>
                <option value="EUR">€ אירו</option>
              </select>
            </div>
          </div>

          {method === 'שיק' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>מספר שיק</Label>
                <Input {...register('check_number')} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label>תאריך פירעון</Label>
                <Input type="date" {...register('check_due_date')} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>הערות</Label>
            <Textarea {...register('notes')} rows={2} placeholder="הערות..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'שומר...' : 'שמור'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
