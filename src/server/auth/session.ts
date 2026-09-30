import { headers } from 'next/headers'
import { getAuth } from './index'

/**
 * Request-scoped session access for server components, route handlers and
 * server actions. Returns null when there is no valid session.
 *
 * This is the REAL authorization check. The optimistic cookie test in
 * src/proxy.ts only decides whether to redirect early; it must never be the
 * only gate on a protected route (see the warning in the Better Auth docs and
 * the forged-cookie e2e test).
 *
 * A lookup failure (database down, misconfigured connection) fails CLOSED:
 * the caller sees no session and sends the visitor to sign in, rather than
 * erroring or - worse - being treated as authenticated. The error is logged
 * loudly so a misconfiguration is still visible instead of silently becoming
 * "everyone is logged out".
 */
export async function getServerSession() {
  try {
    const auth = await getAuth()
    return await auth.api.getSession({ headers: await headers() })
  } catch (error) {
    console.error(
      `[auth] session lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
    return null
  }
}
