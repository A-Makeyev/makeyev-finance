/**
 * TEMPORARY helper (deleted after use):
 *   node --env-file-if-exists=.env scripts/tmp-delete-signedout.mjs
 *
 * Creates a real account, requests the deletion with its password, and writes
 * the session cookie plus the token the mail would carry (read straight from
 * Mongo, since no mail leaves this machine). Nothing here is a test; the spec
 * uses the two files.
 *
 * Run modes:
 *   - Manually against a dev server:
 *       node --env-file-if-exists=.env scripts/tmp-delete-signedout.mjs
 *       (set BASE_URL=http://localhost:3200 if the dev server is on that port)
 *   - By the e2e harness's beforeAll() against the already-booted e2e server,
 *     inheriting MONGODB_URI + BASE_URL from the test process (which loaded .env
 *     via the playwright config's loadEnvConfig).
 * Either way the process must have MONGODB_URI available (inherited or via
 * --env-file-if-exists), and BASE_URL points at the server that serves the
 * sign-up / sign-in / delete-user API calls.
 */
import { writeFileSync } from 'node:fs'
import { MongoClient, ObjectId } from 'mongodb'

const base = process.env.BASE_URL ?? 'http://localhost:3100'
const mongoUri = process.env.MONGODB_URI
if (!mongoUri) throw new Error(
  '[tmp] MONGODB_URI is not set. Run with --env-file-if-exists=.env or from the e2e harness.\n',
)
const client = new MongoClient(mongoUri)
await client.connect()
const db = client.db()

const stem = `tmp-signedout-${Date.now()}@example.test`
const password = 'password123'

// Remove any leftover tmp-signedout accounts from earlier runs so the fixture
// is always fresh (the e2e test deletes the account at the end of the scenario).
const stale = await db.collection('user').find({ email: /^tmp-signedout-/ }).toArray()
for (const user of stale) {
  const ids = [user._id, String(user._id)]
  await db.collection('account').deleteMany({ userId: { $in: ids } })
  await db.collection('session').deleteMany({ userId: { $in: ids } })
  await db.collection('saved_mixes').deleteMany({ userId: { $in: ids } })
  await db.collection('verification').deleteMany({ value: { $in: ids } })
  await db.collection('user').deleteOne({ _id: user._id })
}

const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ name: 'Tmp Signed Out', email: stem, password }),
})
const created = await signUp.json()
if (!created?.user?.id) throw new Error(`[tmp] sign-up failed: ${JSON.stringify(created)}`)

// The e2e server inherits RESEND_API_KEY from the repo .env, so it requires
// email verification. Sign-up therefore creates an UNVERIFIED account, which
// better-auth will not sign in (EMAIL_NOT_VERIFIED) and will not hand back a
// usable session cookie for. Mark it verified in the database, then sign in with
// the credential we created it with to obtain a REAL session cookie for the
// deletion request (the modal's first step uses the account's own password).
await db.collection('user').updateOne(
  { email: stem },
  { $set: { emailVerified: true } },
)

// Sign in to get a valid session cookie. With the account now verified, this
// succeeds and returns a cookie the delete-user endpoint will accept.
const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ email: stem, password }),
})
const signInBody = await signIn.json()
if (signIn.status !== 200 || signInBody?.error) {
  throw new Error(`[tmp] sign-in failed: ${signIn.status} ${JSON.stringify(signInBody)}`)
}
const cookies = (signIn.headers.getSetCookie?.() ?? [signIn.headers.get('set-cookie') ?? ''])
  .map((value) => value.split(';')[0])
  .filter(Boolean)
  .join('; ')
if (!cookies) throw new Error('[tmp] no session cookie from sign-in')

// Step one, exactly as the modal does it: the endpoint verifies the password
// and then mails the link, so the token lands in the verification collection.
const request = await fetch(`${base}/api/auth/delete-user`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base, cookie: cookies },
  body: JSON.stringify({ password }),
})
const requested = await request.json()
if (requested?.message !== 'Verification email sent') {
  throw new Error(`[tmp] deletion request failed: ${JSON.stringify(requested)}`)
}

const row = await db
  .collection('verification')
  .find({ identifier: /^delete-account-/, value: created.user.id })
  .sort({ expiresAt: -1 })
  .limit(1)
  .toArray()
if (!row[0]) throw new Error('[tmp] no deletion token in the database')
const token = String(row[0].identifier).replace('delete-account-', '')

await client.close()
writeFileSync(
  '.tmp-signedout.json',
  JSON.stringify({ email: stem, password, token, cookie: cookies }),
)
console.log(`[tmp] ${stem} asked for deletion; token ready`)
void ObjectId
