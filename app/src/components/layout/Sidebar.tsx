'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ArrowDownToLine, SlidersHorizontal, Package, PackageOpen, Warehouse, Settings, LogOut, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/lib/context/SeasonContext'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/',           label: 'דאשבורד',      icon: LayoutDashboard },
  { href: '/miuinim',    label: 'מיונים',        icon: SlidersHorizontal },
  { href: '/kabala',     label: 'קבלת סחורה',   icon: ArrowDownToLine },
  { href: '/arizot',     label: 'אריזות',         icon: PackageOpen },
  { href: '/inventory',  label: 'מלאי חי',       icon: Warehouse },
  { href: '/malay',      label: 'מכירות',        icon: Package },
  { href: '/suppliers',  label: 'ספקים',         icon: Users },
  { href: '/settings',      label: 'הגדרות',        icon: Settings },
]

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { activeSeason } = useSeason()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col h-full bg-white border-l border-gray-200 w-64" dir="rtl">
      <div className="px-6 py-5 border-b border-gray-100">
        <h1 className="text-lg font-bold text-green-700">🌿 ניהול לולבים</h1>
        <p className="text-xs text-gray-400 mt-0.5">מערכת מלאי סוכות</p>
        <span className="inline-block mt-1.5 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          עונה {activeSeason}
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-green-50 text-green-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          יציאה
        </button>
      </div>
    </aside>
  )
}
