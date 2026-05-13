'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SeasonContextValue {
  activeSeason: string
  setActiveSeason: (s: string) => Promise<void>
  allSeasons: string[]
  loading: boolean
  startNewSeason: (newSeason: string) => Promise<void>
}

const SeasonContext = createContext<SeasonContextValue>({
  activeSeason: '2025',
  setActiveSeason: async () => {},
  allSeasons: ['2025'],
  loading: true,
  startNewSeason: async () => {},
})

export function SeasonProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [activeSeason, setActiveSeasonState] = useState<string>(
    () => (typeof window !== 'undefined' ? localStorage.getItem('active_season') ?? '2025' : '2025')
  )
  const [allSeasons, setAllSeasons] = useState<string[]>([activeSeason])
  const [loading, setLoading] = useState(true)

  const fetchSeason = useCallback(async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'active_season')
      .maybeSingle()

    if (data?.value) {
      setActiveSeasonState(data.value)
      localStorage.setItem('active_season', data.value)
    }

    // collect all known seasons from events + orders
    const [ev, ro] = await Promise.all([
      supabase.from('sorting_events').select('season').order('season', { ascending: false }),
      supabase.from('receiving_orders').select('season').order('season', { ascending: false }),
    ])
    const seasons = new Set<string>([data?.value ?? '2025'])
    ev.data?.forEach(r => seasons.add(r.season))
    ro.data?.forEach(r => seasons.add(r.season))
    setAllSeasons(Array.from(seasons).sort((a, b) => b.localeCompare(a)))
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchSeason() }, [fetchSeason])

  async function setActiveSeason(season: string) {
    setActiveSeasonState(season)
    localStorage.setItem('active_season', season)
    await supabase.from('settings').upsert({ key: 'active_season', value: season }, { onConflict: 'key' })
    if (!allSeasons.includes(season)) setAllSeasons(prev => [season, ...prev].sort((a, b) => b.localeCompare(a)))
  }

  async function startNewSeason(newSeason: string) {
    // Set as active
    await setActiveSeason(newSeason)
    // Note: inventory rows for new season start at 0 naturally (no rows yet)
    // Old inventory rows remain untouched for history
  }

  return (
    <SeasonContext.Provider value={{ activeSeason, setActiveSeason, allSeasons, loading, startNewSeason }}>
      {children}
    </SeasonContext.Provider>
  )
}

export function useSeason() {
  return useContext(SeasonContext)
}
