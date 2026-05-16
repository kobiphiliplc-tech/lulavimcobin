'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  message: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'default'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'מחק',
  cancelLabel = 'ביטול',
  variant = 'destructive',
  loading = false,
  onConfirm, onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel() }}>
      <DialogContent className="sm:max-w-sm bg-white text-gray-900" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-gray-600 mt-1">{message}</div>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>
            {loading ? 'מעבד...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
