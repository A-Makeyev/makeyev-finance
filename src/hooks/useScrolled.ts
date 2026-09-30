import { useEffect, useState } from 'react'

/** Returns true once the page is scrolled away from the top. */
export function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return scrolled
}

/**
 * Reactive matchMedia hook used for the legacy 770px/800px color branches.
 *
 * SSR note: server renders have no window, and a first client render that
 * guessed `matches` could disagree with the markup React just hydrated.
 * This port waits for mount before consulting matchMedia (the Vite app was
 * client-only and never faced this), then tracks the query live. The one-
 * frame conservative false is exactly what useScrolled already shipped on
 * first paint, so the navbar behavior is unchanged.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const listener = () => setMatches(mediaQuery.matches)
    listener()
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [query])

  return matches
}
