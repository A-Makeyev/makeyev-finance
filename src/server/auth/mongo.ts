import { MongoClient, type Db } from 'mongodb'
import { getAuthConfig } from './config'

/**
 * The single cached MongoClient for the auth (and, later, CRM) data.
 *
 * Cached on globalThis rather than in a module variable so Next's dev
 * hot-reload does not open a new connection pool on every edit - the standard
 * MongoClient-in-Next pattern.
 */
const globalForMongo = globalThis as unknown as {
  __authMongoClientPromise?: Promise<MongoClient>
}

function createClientPromise(): Promise<MongoClient> {
  const { MONGODB_URI } = getAuthConfig()
  if (!MONGODB_URI) {
    throw new Error(
      '[auth] MONGODB_URI is not set. Add it to .env (server-only; see SECURITY.md).',
    )
  }
  return new MongoClient(MONGODB_URI).connect()
}

export function getMongoClient(): Promise<MongoClient> {
  if (!globalForMongo.__authMongoClientPromise) {
    // Do not cache a rejected promise: a failed first connection must be
    // retryable on the next request instead of poisoning the process.
    globalForMongo.__authMongoClientPromise = createClientPromise().catch((error: unknown) => {
      globalForMongo.__authMongoClientPromise = undefined
      throw error
    })
  }
  return globalForMongo.__authMongoClientPromise
}

/** The database named in MONGODB_URI (the URI must carry a database name). */
export async function getDb(): Promise<Db> {
  const client = await getMongoClient()
  return client.db()
}
