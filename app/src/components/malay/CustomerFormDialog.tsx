'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Customer } from '@/lib/types'

const schema = z.object({
  name:     z.string().min(1, 'חובה'),
  phone:    z.string().optional(),
  market:   z.enum(['ישראל', 'חו"ל']),
  currency: z.enum(['ILS', 'USD', 'EUR']),
  notes:    z.string().optional(),
})
type FormData = z.infer<typeof schema>

const selectCls = "w-full rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm h-9 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: FormData) => Promise<void>
  customer?: Customer | null
}

export function CustomerFormDialog({ open, onClose, onSave, customer }: Props) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { market: 'ישראל', currency: 'ILS' },
  })

  const market = watch('market')

  useEffect(() => {
    if (market === 'ישראל') setValue('currency', 'ILS')
  }, [market, setValue])

  useEffect(() => {
    if (customer) {
      reset({
        name:     customer.name,
        phone:    customer.phone ?? '',
        market:   customer.market,
        currency: customer.currency,
        notes:    customer.notes ?? '',
      })
    } else {
      reset({ market: 'ישראל', currency: 'ILS' })
    }
  }, [customer, open, reset])

  const onSubmit = async (data: FormData) => {
    await onSave(data)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{customer ? 'עריכת לקוח' : 'לקוח חדש'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>שם לקוח *</Label>
            <Input {...register('name')} placeholder="שם הלקוח" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>טלפון</Label>
            <Input {...register('phone')} placeholder="05X-XXXXXXX" dir="ltr" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>שוק</Label>
              <select {...register('market')} className={selectCls}>
                <option value="ישראל">ישראל</option>
                <option value='חו"ל'>חו&quot;ל</option>
              </select>
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
