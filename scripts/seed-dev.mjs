/**
 * Seeds sample users into the DEV database (the one named in MONGODB_URI).
 *
 * The documents are written in the exact shape the Better Auth MongoDB
 * adapter produces natively (verified against @better-auth/mongo-adapter):
 *   - user:    _id ObjectId, name, email, emailVerified, createdAt, updatedAt, role
 *   - account: _id ObjectId, userId -> user's ObjectId, accountId -> user id
 *              string, providerId 'credential', password -> scrypt hash
 * Password hashing uses better-auth/crypto's own hashPassword, the same
 * primitive the app's sign-in path verifies against - nothing hand-rolled
 * (see AGENTS.md security rules).
 *
 * Usage:
 *   npm run seed
 *   SEED_PASSWORD='...' npm run seed   # override the sample password
 *
 * Existing emails are left untouched (the script is idempotent); use --force
 * to also reset their password to the sample value.
 *
 * Safety: refuses to run unless the URI names a dev-looking database, so the
 * production database (set later in the Render dashboard) can never be
 * seeded by accident.
 */
import { MongoClient, ObjectId } from 'mongodb'
import { hashPassword, verifyPassword } from 'better-auth/crypto'

// npm does not load .env; Node does it natively (existing env vars still win,
// so `SEED_PASSWORD=... npm run seed` keeps overriding).
try {
  process.loadEnvFile('.env')
} catch {
  // No .env file: fine if the vars come from the environment instead.
}

const SAMPLE_PASSWORD_DEFAULT = 'Dev!Passw0rd!'

const SAMPLE_USERS = [
  { email: 'admin@makeyev.local', name: 'Anatoly (Admin)', role: 'admin' },
  { email: 'advisor@makeyev.local', name: 'Maya (Advisor)', role: 'advisor' },
  { email: 'client@makeyev.local', name: 'Noa (Client)', role: 'client' },
]

const args = process.argv.slice(2)
const force = args.includes('--force')
const samplePassword = process.env.SEED_PASSWORD ?? SAMPLE_PASSWORD_DEFAULT

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('[seed] MONGODB_URI is not set. Add it to .env (server-only; see SECURITY.md).')
  process.exit(1)
}

// Parse just the database name; the URI itself is never printed.
let dbName
try {
  dbName = new URL(uri.replace('mongodb+srv://', 'https://')).pathname.replace(/^\//, '')
} catch {
  dbName = ''
}
if (!dbName) {
  console.error('[seed] MONGODB_URI must include a database name (e.g. .../dev).')
  process.exit(1)
}
if (!/dev|test|local|e2e/i.test(dbName)) {
  console.error(
    `[seed] Refusing to seed database "${dbName}": this script is for dev/sample data only.` +
      ' Name the database dev (or test/local/e2e) to use it.',
  )
  process.exit(1)
}

if (samplePassword === SAMPLE_PASSWORD_DEFAULT) {
  console.log('[seed] Using the sample dev password (override with SEED_PASSWORD=...).')
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 })

try {
  await client.connect()
  const db = client.db()

  let created = 0
  let updated = 0
  let skipped = 0

  for (const sample of SAMPLE_USERS) {
    const users = db.collection('user')
    const accounts = db.collection('account')

    // Case-insensitive lookup, mirroring the adapter's email matching.
    const existing = await users.findOne({
      email: { $regex: `^${sample.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    })

    if (!existing) {
      const now = new Date()
      const result = await users.insertOne({
        _id: new ObjectId(),
        name: sample.name,
        email: sample.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        role: sample.role,
      })
      const hash = await hashPassword(samplePassword)
      // Self-check: the hash must verify against the sample password before
      // we write the account, so a broken seed fails loudly here.
      const ok = await verifyPassword({ hash, password: samplePassword })
      if (!ok) throw new Error(`[seed] hash verification failed for ${sample.email}`)
      await accounts.insertOne({
        _id: new ObjectId(),
        userId: result.insertedId,
        accountId: result.insertedId.toString(),
        providerId: 'credential',
        password: hash,
        createdAt: now,
        updatedAt: now,
      })
      created++
      console.log(`[seed] created ${sample.email} (${sample.role})`)
      continue
    }

    if (force) {
      const hash = await hashPassword(samplePassword)
      await accounts.updateOne({ userId: existing._id, providerId: 'credential' }, { $set: { password: hash, updatedAt: new Date() } })
      await users.updateOne({ _id: existing._id }, { $set: { name: sample.name, role: sample.role, updatedAt: new Date() } })
      updated++
      console.log(`[seed] password reset for ${sample.email} (${sample.role})`)
    } else {
      skipped++
      console.log(`[seed] skipped ${sample.email} (already exists; use --force to reset)`)
    }
  }

  console.log(`[seed] done: ${created} created, ${updated} updated, ${skipped} skipped in db "${dbName}".`)
} catch (error) {
  console.error('[seed] failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.close()
}
