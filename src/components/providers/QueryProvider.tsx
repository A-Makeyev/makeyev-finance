'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * react-query provider for the ported calculator/compare pages and the live
 * market/CBS strips. Mirrors the legacy App.tsx defaults: external data fails
 * silently and never blocks the UI.
 *
 * The client is created per mounted tree (useState initializer), so a server
 * render never shares one cache between users - the same reason the legacy
 * single-client App was safe behind its own process.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
