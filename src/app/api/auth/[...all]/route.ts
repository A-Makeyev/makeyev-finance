import { toNextJsHandler } from 'better-auth/next-js'
import { getAuth } from '@/server/auth'

/**
 * Better Auth's catch-all API endpoint.
 *
 * runtime = nodejs: the handler talks to MongoDB through the driver, which is
 * not available on the edge runtime.
 *
 * force-dynamic: every request is a live auth operation; nothing here may be
 * cached or prerendered.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Lazy: the auth instance (and its Mongo connection) is created on the first
// request, so `next build` never needs MONGODB_URI or any other secret.
const { GET, POST } = toNextJsHandler((request) => getAuth().then((auth) => auth.handler(request)))

export { GET, POST }
