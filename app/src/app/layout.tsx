import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ניהול לולבים',
  description: 'מערכת ניהול מלאי לולבים לחג הסוכות',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased bg-gray-50 text-gray-900 font-sans">
        {children}
      </body>
    </html>
  )
}
