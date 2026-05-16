'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Season } from '@/lib/types'

interface SeasonDates {
  start_date: string | null
  end_date: string | null
}

interface SeasonContextValue {
  activeSeason: string
  setActiveSeason: (s: string) => Promise<void>
  allSeasons: string[]
  loading: boolean
  startNewSeason: (newSeason: string, startDate?: string, endDate?: string) => Promise<void>
  currentSeasonDates: SeasonDates | null
  nextSeasonDates: SeasonDates | null
  allSeasonRecords: Season[]
  refetchSeasons: () => Promise<void>
}

const SeasonContext = createContext<SeasonContextValue>({
  activeSeason: '2025',
  setActiveSeason: async () => {},
  allSeasons: ['2025'],
  loading: true,
  startNewSeason: async () => {},
  currentSeasonDates: null,
  nextSeasonDates: null,
  allSeasonRecords: [],
  refetchSeasons: async () => {},
})

export function SeasonProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [activeSeason, setActiveSeasonState] = useState<string>('2025')
  const [allSeasons, setAllSeasons] = useState<string[]>([activeSeason])
  const [allSeasonRecords, setAllSeasonRecords] = useState<Season[]>([])
  const [currentSeasonDates, setCurrentSeasonDates] = useState<SeasonDates | null>(null)
  const [nextSeasonDates, setNextSeasonDates] = useState<SeasonDates | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSeason = useCallback(async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'active_season')
      .maybeSingle()

    const active = data?.value ?? '2025'
    if (data?.value) {
      setActiveSeasonState(data.value)
      localStorage.setItem('active_season', data.value)
    }

    const [ev, ro, seasonsRes] = await Promise.all([
      supabase.from('sorting_events').select('season').order('season', { ascending: false }),
      supabase.from('receiving_orders').select('season').order('season', { ascending: false }),
      supabase.from('seasons').select('*').order('year', { ascending: false }),
    ])

    const seasons = new Set<string>([active])
    ev.data?.forEach(r => seasons.add(r.season))
    ro.data?.forEach(r => seasons.add(r.season))
    seasonsRes.data?.forEach(s => seasons.add(s.year))
    const sorted = Array.from(seasons).sort((a, b) => b.localeCompare(a))
    setAllSeasons(sorted)

    if (seasonsRes.data) {
      setAllSeasonRecords(seasonsRes.data as Season[])
      const curr = seasonsRes.data.find(s => s.year === active)
      const nextYear = String(Number(active) + 1)
      const next = seasonsRes.data.find(s => s.year === nextYear)
      setCurrentSeasonDates(curr ? { start_date: curr.start_date, end_date: curr.end_date } : null)
      setNextSeasonDates(next ? { start_date: next.start_date, end_date: next.end_date } : null)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const cached = localStorage.getItem('active_season')
    if (cached) setActiveSeasonState(cached)
  }, [])

  useEffect(() => { fetchSeason() }, [fetchSeason])

  async function setActiveSeason(season: string) {
    setActiveSeasonState(season)
    localStorage.setItem('active_season', season)
    await supabase.from('settings').upsert({ key: 'active_season', value: season }, { onConflict: 'key' })
    if (!allSeasons.includes(season)) setAllSeasons(prev => [season, ...prev].sort((a, b) => b.localeCompare(a)))
  }

  async function startNewSeason(newSeason: string, startDate?: string, endDate?: string) {
    await setActiveSeason(newSeason)
    await supabase.from('seasons').upsert({
      year: newSeason,
      start_date: startDate || null,
      end_date: endDate || null,
    }, { onConflict: 'year' })
    await fetchSeason()
  }

  return (
    <SeasonContext.Provider value={{
      activeSeason, setActiveSeason, allSeasons, loading, startNewSeason,
      currentSeasonDates, nextSeasonDates, allSeasonRecords, refetchSeasons: fetchSeason,
    }}>
      {children}
    </SeasonContext.Provider>
  )
}

export function useSeason() {
  return useContext(SeasonContext)
}
