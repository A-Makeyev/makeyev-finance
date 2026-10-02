'use client'

import NextLink from 'next/link'
import {
  useRouter as useNextRouter,
  usePathname as useNextPathname,
  useSearchParams as useNextSearchParams,
} from 'next/navigation'
import { createContext, useCallback, useContext, type ComponentProps, type ReactNode } from 'react'

/**
 * The react-router seams for the phase-1 migration.
 *
 * The ported components keep calling `Link to=...`, `router.push` and
 * `usePathname()` exactly as they did under react-router; only this file
 * knows the underlying implementation is Next's App Router. When the
 * calculator migrates (phase 2), swapping implementation happens here, not in
 * a dozen components.
 *
 * Paths passed by phase-1 components are unprefixed ("/services"); the
 * adapters map "/"-rooted paths into the CURRENT locale segment. That is why
 * the locale is context-driven rather than imported: the same component tree
 * serves /en/services and /services.
 */

const LocaleContext = createContext<'he' | 'en'>('he')

/**
 * A navigation block-guard registered by a page that has unsaved work (the
 * calculator's unsaved mix). It returns false to veto a client-side
 * navigation; the page that registered it is responsible for explaining why
 * and for clearing itself. Kept here, in the one seam every ported component
 * already routes through, rather than sprinkling checks into each caller.
 *
 * Serving both directions of navigation is deliberate: a browser back/forward
 * cannot be intercepted this way, so the calculator additionally warns on
 * unload (beforeunload), which does cover those.
 */
type BlockGuard = (to: string) => boolean

let blockGuard: BlockGuard | null = null

export function setNavigationBlockGuard(guard: BlockGuard | null): void {
  blockGuard = guard
}

function mayNavigate(to: string): boolean {
  return blockGuard === null || blockGuard(to)
}

export function LocaleContextProvider({
  segment,
  children,
}: {
  segment: 'he' | 'en'
  children: ReactNode
}) {
  return <LocaleContext.Provider value={segment}>{children}</LocaleContext.Provider>
}

function useLocaleSegment(): 'he' | 'en' {
  return useContext(LocaleContext)
}

/** Maps an app path ("/services") into the current locale segment. */
function hrefFor(segment: 'he' | 'en', to: string): string {
  if (to.startsWith('//') || /^(https?:|mailto:|tel:|#)/.test(to)) return to
  if (segment === 'he') return to
  if (to === '/') return '/en'
  return `/en${to}`
}

export interface LinkProps extends Omit<ComponentProps<typeof NextLink>, 'href'> {
  to: string
}

export function Link({ to, ...rest }: LinkProps) {
  const segment = useLocaleSegment()
  const href = hrefFor(segment, to)
  // Only in-app navigation is guarded; leaving the site is a full load, which
  // the page's own beforeunload warning already covers.
  const isInternal = href.startsWith('/') && !href.startsWith('//')
  const onClick: typeof rest.onClick = (event) => {
    if (isInternal && !mayNavigate(to)) {
      event.preventDefault()
      return
    }
    rest.onClick?.(event)
  }
  return <NextLink href={href} {...rest} onClick={onClick} />
}

export interface AppRouterLike {
  push(to: string): void
  replace(to: string): void
}

/** The `useNavigate()` shape the phase-1 components actually use. */
export function useRouter(): AppRouterLike {
  const router = useNextRouter()
  const segment = useLocaleSegment()
  return {
    push: (to) => {
      if (!mayNavigate(to)) return
      router.push(hrefFor(segment, to))
    },
    replace: (to) => {
      if (!mayNavigate(to)) return
      router.replace(hrefFor(segment, to))
    },
  }
}

/**
 * react-router's `useNavigate()` returns a callable, which is what the ported
 * calculator page calls (`navigate('/compare')`). Keep that shape here so the
 * component stays verbatim.
 */
export function useNavigate(): (to: string, options?: { replace?: boolean }) => void {
  const router = useNextRouter()
  const segment = useLocaleSegment()
  return useCallback(
    (to, options) => {
      if (!mayNavigate(to)) return
      const href = hrefFor(segment, to)
      if (options?.replace) router.replace(href)
      else router.push(href)
    },
    [router, segment],
  )
}

/**
 * react-router's `useSearchParams()` returns a `[params]` tuple; Next returns
 * the params object directly. The calculator reads the `?preset=` deep link
 * through the tuple destructure, so keep that shape.
 */
export function useSearchParams(): [URLSearchParams] {
  const params = useNextSearchParams()
  return [params as unknown as URLSearchParams]
}

/**
 * The app-space pathname WITHOUT the locale prefix: "/en/services" reports
 * "/services", matching what the react-router components compared against
 * ("/services", "/articles/prepayment-penalties"...). Active-link checks and
 * the language-switch target keep working unchanged.
 */
export function usePathname(): string {
  const pathname = useNextPathname() ?? '/'
  return pathname.startsWith('/en/') ? pathname.slice(3) : pathname === '/en' ? '/' : pathname
}
