'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      toast.error('שגיאה בשליחת הקישור: ' + error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4" dir="rtl">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="text-4xl mb-2">🌿</div>
          <CardTitle className="text-xl">ניהול לולבים</CardTitle>
          <CardDescription>מערכת מלאי סוכות</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center py-4 space-y-2">
              <div className="text-3xl">📧</div>
              <p className="font-medium text-gray-800">נשלח קישור כניסה!</p>
              <p className="text-sm text-gray-500">בדוק את תיבת הדוא&quot;ל שלך: <strong>{email}</strong></p>
              <button
                className="text-xs text-green-600 underline mt-2"
                onClick={() => setSent(false)}
              >
                שלח שוב
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">כתובת דוא&quot;ל</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
                {loading ? 'שולח...' : 'שלח קישור כניסה'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
