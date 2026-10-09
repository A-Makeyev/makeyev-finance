/**
 * Auth data doctor.
 *
 * Reports the account states that break sign-in in ways the UI cannot explain:
 *
 *  - ORPHANED accounts: an `account` row whose user no longer exists. This is
 *    what used to produce `?error=unable_to_link_account` on every later Google
 *    sign-in with that Google account: the row still owns the Google subject
 *    id, and Better Auth refuses to attach it to anyone else. The app now
 *    releases these rows itself before a social sign-in starts (see
 *    src/server/auth/orphanedAccounts.ts), so this report is for inspection -
 *    and `--repair` for a cleanup without going through a sign-in. Read-only
 *    unless `--repair` is passed.
 *  - DUPLICATE users on one address: two `user` rows with the same email, which
 *    means a sign-in may land on the wrong one.
 *  - The state of one address (`--email=`): whether it is verified and which
 *    providers are linked to it.
 *
 * Usage (the script reads MONGODB_URI from .env itself; nothing is printed):
 *   node --env-file=.env scripts/auth-doctor.mjs              # report, then comfort the user and prompt what to do next
 *   node --env-file=.env scripts/auth-doctor.mjs --email=<addr>
 *   node --env-file=.env scripts/auth-doctor.mjs --repair     # remove orphaned account rows only
 *
 * `--repair` deletes ONLY orphaned account rows (rows whose user is gone, so
 * they can never authenticate anyone). Nothing else is touched.
 */
import { pathToFileURL } from 'node:url'
import { MongoClient } from 'mongodb'

/**
 * Rows whose `userId` is not in `userIds`. Pure, so the selection rule is
 * unit-tested rather than only exercised against a live database.
 *
 * @param {Array<{ _id: unknown, userId: unknown, providerId?: unknown }>} accounts
 * @param {Array<unknown>} userIds
 * @returns {Array<{ _id: unknown, userId: unknown, providerId?: unknown }>}
 */
export function orphanAccounts(accounts, userIds) {
  const existing = new Set(userIds.map(String))
  return accounts.filter((account) => !existing.has(String(account.userId)))
}

/**
 * Addresses carried by more than one user row, case-insensitively.
 *
 * @param {Array<{ email?: unknown }>} users
 * @returns {Array<{ email: string, count: number }>}
 */
export function duplicateEmails(users) {
  const seen = new Map()
  for (const user of users) {
    const email = String(user.email ?? '').toLowerCase()
    if (!email) continue
    seen.set(email, (seen.get(email) ?? 0) + 1)
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([email, count]) => ({
    email,
    count,
  }))
}

function parseArgs(argv) {
  return {
    repair: argv.includes('--repair'),
    email: argv.find((arg) => arg.startsWith('--email='))?.slice('--email='.length) ?? null,
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { repair, email } = parseArgs(argv)
  if (!env.MONGODB_URI) {
    console.error(
      '[auth-doctor] MONGODB_URI is not set. Run with: node --env-file=.env scripts/auth-doctor.mjs',
    )
    return 1
  }

  const client = new MongoClient(env.MONGODB_URI)
  await client.connect()
  try {
    const db = client.db()
    const users = await db
      .collection('user')
      .find({}, { projection: { email: 1, emailVerified: 1 } })
      .toArray()
    const accounts = await db
      .collection('account')
      .find({}, { projection: { userId: 1, providerId: 1 } })
      .toArray()

    console.log(`[auth-doctor] database "${db.databaseName}"`)
    console.log(`[auth-doctor] users: ${users.length}, accounts: ${accounts.length}`)
    // Whether the app can send verification mail decides what a repeated
    // sign-up on an unverified address does: re-send the link, or refuse with
    // "already registered" (see src/server/auth). Only presence is printed.
    console.log(
      `[auth-doctor] verification mailer: ${
        env.RESEND_API_KEY ? 'configured (RESEND_API_KEY is set)' : 'NOT configured'
      }`,
    )

    const orphans = orphanAccounts(accounts, users.map((user) => user._id))
    if (orphans.length === 0) {
      console.log('[auth-doctor] no orphaned accounts')
    } else {
      console.log(`[auth-doctor] ORPHANED accounts: ${orphans.length}`)
      const byProvider = new Map()
      for (const account of orphans) {
        byProvider.set(account.providerId, (byProvider.get(account.providerId) ?? 0) + 1)
      }
      for (const [providerId, count] of byProvider) {
        console.log(`[auth-doctor]   ${providerId}: ${count}`)
      }
      console.log(
        '[auth-doctor]   effect: signing in with one of these provider accounts fails with "unable_to_link_account" until the row is released',
      )
      if (repair) {
        const result = await db
          .collection('account')
          .deleteMany({ _id: { $in: orphans.map((account) => account._id) } })
        console.log(`[auth-doctor] repaired: removed ${result.deletedCount} orphaned account row(s)`)
      } else if (orphans.some((account) => account.providerId === 'google')) {
        console.log(
          '[auth-doctor]   Google account(s) are stuck against a missing user - the next Google sign-in releases them automatically; --repair removes them now',
        )
      } else {
        console.log('[auth-doctor]   re-run with --repair to remove them')
      }
    }

    const duplicates = duplicateEmails(users)
    if (duplicates.length === 0) {
      console.log('[auth-doctor] no duplicate addresses')
    } else {
      for (const { email: address, count } of duplicates) {
        console.log(`[auth-doctor] DUPLICATE address: ${address} (${count} users)`)
      }
    }

    if (email) {
      const lower = email.toLowerCase()
      const matches = users.filter((user) => String(user.email).toLowerCase() === lower)
      if (matches.length === 0) {
        console.log(`[auth-doctor] ${email}: no user`)
      } else {
        for (const user of matches) {
          const linked = accounts
            .filter((account) => String(account.userId) === String(user._id))
            .map((account) => account.providerId)
          console.log(
            `[auth-doctor] ${email}: emailVerified=${user.emailVerified} providers=[${[...new Set(linked)].join(',')}]`,
          )
        }
      }
    }
  } finally {
    await client.close()
  }
  return 0
}

// Only run when invoked directly, so the pure helpers above stay importable
// from the unit tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main()
}
