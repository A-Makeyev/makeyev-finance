import { useEffect, useState } from 'react'

/**
 * Intro loader - preserves the legacy loading screen (loader.js + loader.css):
 * body scroll-lock until loaded, 1s fade, then removal; also resets scroll
 * position and cleans `?fbclid=` URLs.
 */
export function Loader() {
  const [fading, setFading] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    document.documentElement.scrollTop = 0

    if (window.location.search.includes('fbclid=')) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    // Legacy: body lock from initial HTML, released the moment the fade
    // starts; screen removed after the full 1000ms transition.
    document.body.classList.add('stop-scrolling')
    const fadeTimer = window.setTimeout(() => {
      setFading(true)
      document.body.classList.remove('stop-scrolling')
    }, 350)
    const hideTimer = window.setTimeout(() => {
      setHidden(true)
      document.body.classList.remove('stop-scrolling')
    }, fadeTimer + 1000)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(hideTimer)
      document.body.classList.remove('stop-scrolling')
    }
  }, [])

  if (hidden) return null

  return (
    <div
      id="loading-screen"
      data-testid="loading-screen"
      aria-hidden="true"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <div id="loader" />
    </div>
  )
}

/** Triple-ring spinner markup, port of #loader (styles/loader.css). */
export function LoaderSpinner({ className }: { className?: string }) {
  return <div id="loader" className={className} />
}
