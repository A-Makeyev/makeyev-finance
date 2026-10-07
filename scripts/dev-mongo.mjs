/**
 * Local development MongoDB, on 127.0.0.1:27017, without installing a server.
 *
 * Why this exists: this machine's network discards outbound TCP 27017, so the
 * Atlas cluster cannot be reached from here at all (see the note in .env), and
 * no VM/container runtime is wanted. mongodb-memory-server downloads a mongod
 * binary (first run only, over HTTPS/443 which the network allows) and this
 * script keeps it running in the foreground.
 *
 * Data is NOT in memory despite the package name: it lives in .mongo/data
 * (git-ignored), so users, sessions and saved mixes survive a restart. Delete
 * that directory for a clean database.
 *
 * Dev only. It is a devDependency, so it never reaches the Render build, and
 * the mongod it runs accepts connections without a username or password, so
 * never expose this port beyond localhost.
 *
 * Usage:
 *   npm run dev:db              # in its own terminal, then npm run dev
 *   DEV_MONGO_PORT=27018 npm run dev:db
 *
 * Pair it with `npm run seed` for the sample accounts:
 *   admin@makeyev.local / Dev!Passw0rd!
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoMemoryServer } from 'mongodb-memory-server'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.DEV_MONGO_PORT ?? 27017)
const dbName = process.env.DEV_MONGO_DB ?? 'dev'
const dbPath = process.env.DEV_MONGO_DATA ?? join(repoRoot, '.mongo', 'data')

mkdirSync(dbPath, { recursive: true })

const mongod = await MongoMemoryServer.create({
  instance: { port, dbName, dbPath },
})

console.log(`[dev-mongo] mongod ready at ${mongod.getUri(dbName)}`)
console.log(`[dev-mongo] data directory: ${dbPath}`)
console.log('[dev-mongo] set MONGODB_URI to that URI in .env, then run `npm run seed`')
console.log('[dev-mongo] Ctrl+C to stop the database')

/** Stops mongod before exiting so the data files are flushed cleanly. */
async function shutdown(signal) {
  console.log(`\n[dev-mongo] ${signal} received, stopping mongod`)
  await mongod.stop().catch((error) => {
    console.error('[dev-mongo] failed to stop cleanly:', error)
  })
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
