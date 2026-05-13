import { AppShell } from '@/components/layout/AppShell'
import { SyncProvider } from '@/components/providers/SyncProvider'
import { SeasonProvider } from '@/lib/context/SeasonContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SeasonProvider>
      <SyncProvider>
        <AppShell>{children}</AppShell>
      </SyncProvider>
    </SeasonProvider>
  )
}
