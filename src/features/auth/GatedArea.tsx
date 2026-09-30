'use client'

import { useTranslation } from 'react-i18next'
import { authClient } from '@/lib/auth-client'
import { useRouter } from '@/router'

/**
 * The placeholder body of a gated segment. This phase proves the gate works
 * (server-side role check in the page, optimistic check in src/proxy.ts); the
 * real advisor dashboard and client area are later phases.
 */
export function GatedArea({ area, email }: { area: 'advisor' | 'client'; email: string }) {
  const { t } = useTranslation()
  const router = useRouter()

  const title = area === 'advisor' ? t('auth.advisorTitle') : t('auth.clientTitle')
  const body = area === 'advisor' ? t('auth.advisorBody') : t('auth.clientBody')

  async function signOut() {
    await authClient.signOut()
    router.push('/')
  }

  return (
    // Same shell as the auth screens: clear of the fixed chrome, filling the
    // viewport so the footer stays below the fold, over the faint backdrop.
    <main className="below-chrome auth-page flex min-h-screen items-center justify-center px-4 pb-16">
      <div className="w-full max-w-2xl rounded-2xl border border-line-soft bg-surface-card p-6 shadow-[0_10px_30px_-15px_rgba(15,15,15,0.35)] sm:p-8">
        <h1 className="mb-3 text-2xl font-semibold text-ink" data-testid="gated-title">
          {title}
        </h1>
        <p className="mb-6 text-ink-muted" data-testid="gated-body">
          {body}
        </p>
        <p className="mb-6 text-sm text-ink-muted" data-testid="gated-session">
          {t('auth.signedInAs', { email })}
        </p>
        <button
          type="button"
          data-testid="gated-sign-out"
          onClick={signOut}
          className="rounded-lg border border-line-strong bg-surface-page px-4 py-2 font-medium text-ink transition-colors hover:border-ink hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
        >
          {t('auth.signOut')}
        </button>
      </div>
    </main>
  )
}
