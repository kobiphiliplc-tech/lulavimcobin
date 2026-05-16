import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ניהול לולבים',
  description: 'מערכת ניהול מלאי לולבים לחג הסוכות',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var fs = localStorage.getItem('lulab_font_size');
            var dm = localStorage.getItem('lulab_dark_mode');
            if (fs === 'medium') document.documentElement.classList.add('font-medium');
            if (fs === 'large')  document.documentElement.classList.add('font-large');
            if (dm === 'true')   document.documentElement.classList.add('dark');
          } catch(e) {}
        `}} />
      </head>
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  )
}
