'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type FontSize = 'normal' | 'medium' | 'large'

interface ThemeContextValue {
  fontSize: FontSize
  darkMode: boolean
  setFontSize: (size: FontSize) => void
  setDarkMode: (dark: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  fontSize: 'normal',
  darkMode: false,
  setFontSize: () => {},
  setDarkMode: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>('normal')
  const [darkMode, setDarkModeState] = useState(false)

  useEffect(() => {
    const fs = (localStorage.getItem('lulab_font_size') as FontSize) || 'normal'
    const dm = localStorage.getItem('lulab_dark_mode') === 'true'
    setFontSizeState(fs)
    setDarkModeState(dm)
  }, [])

  function setFontSize(size: FontSize) {
    setFontSizeState(size)
    localStorage.setItem('lulab_font_size', size)
    const html = document.documentElement
    html.classList.remove('font-medium', 'font-large')
    if (size === 'medium') html.classList.add('font-medium')
    if (size === 'large')  html.classList.add('font-large')
  }

  function setDarkMode(dark: boolean) {
    setDarkModeState(dark)
    localStorage.setItem('lulab_dark_mode', String(dark))
    if (dark) document.documentElement.classList.add('dark')
    else      document.documentElement.classList.remove('dark')
  }

  return (
    <ThemeContext.Provider value={{ fontSize, darkMode, setFontSize, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
