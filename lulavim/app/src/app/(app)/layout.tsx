import { AppShell } from '@/components/layout/AppShell'
import { SyncProvider } from '@/components/providers/SyncProvider'
import { SeasonProvider } from '@/lib/context/SeasonContext'
import { ThemeProvider } from '@/lib/context/ThemeContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SeasonProvider>
        <SyncProvider>
          <AppShell>{children}</AppShell>
        </SyncProvider>
      </SeasonProvider>
    </ThemeProvider>
  )
}
