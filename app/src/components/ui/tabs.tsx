import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (v: string) => void
}
const TabsContext = React.createContext<TabsContextValue>({ value: '', onValueChange: () => {} })

function Tabs({ value, onValueChange, children, className, ...props }: {
  value: string
  onValueChange: (v: string) => void
  children: React.ReactNode
  className?: string
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('', className)} {...props}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('inline-flex h-9 items-center rounded-lg bg-gray-100 p-1 text-gray-500 gap-1', className)}
      {...props}
    >
      {children}
    </div>
  )
}

function TabsTrigger({ value, children, className, ...props }: { value: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(TabsContext)
  const active = ctx.value === value
  return (
    <button
      type="button"
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        active ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({ value, children, className, ...props }: { value: string } & React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(TabsContext)
  if (ctx.value !== value) return null
  return (
    <div
      className={cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
