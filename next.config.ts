import type { NextConfig } from 'next'
import { parseSocialProviders } from './src/server/auth/config'

/**
 * Client-side env vars under their clean (non-prefixed) names.
 *
 * Next only inlines NEXT_PUBLIC_* automatically; anything else read in
 * browser code would be `undefined` in the production bundle. These five are
 * public-by-design (they ship in the client bundle either way), so `env`
 * inlining is the supported way to expose the clean spellings. All values
 * here MUST come from server-side env only - never hardcode them.
 *
 * src/config/env.ts is the validation/fallback layer on top of these.
 */
const clientEnv = {
  EMAILJS_SERVICE_ID:
    process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? process.env.EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID:
    process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? process.env.EMAILJS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY:
    process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? process.env.EMAILJS_PUBLIC_KEY,
  BOI_INTEREST_URL: process.env.NEXT_PUBLIC_BOI_INTEREST_URL ?? process.env.BOI_INTEREST_URL,
  CBS_API_BASE: process.env.NEXT_PUBLIC_CBS_API_BASE ?? process.env.CBS_API_BASE,
  /**
   * Which social sign-in providers this deployment has credentials for. Only
   * the ENABLED LIST is public (a comma-joined string); the client ids and
   * secrets themselves stay server-only (see src/server/auth/config.ts). The
   * auth page renders one button per enabled provider and none otherwise, so
   * the buttons can never advertise a provider that would 500 at the OAuth
   * handshake.
   */
  AUTH_SOCIAL_PROVIDERS: parseSocialProviders({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  }).join(','),
}

const nextConfig: NextConfig = {
  env: clientEnv,
  // Images are plain static files under public/images, referenced by URL
  // exactly like the legacy app did (see lib/articles.ts). Switching on the
  // image optimizer is a later, separate decision.
  images: {
    unoptimized: true,
  },
  // Pin the workspace root so Turbopack does not guess (and warn) on every build.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
