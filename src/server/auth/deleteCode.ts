import { randomInt } from 'node:crypto'
import { DELETE_CODE_ALPHABET, DELETE_CODE_LENGTH } from '@/lib/deleteCode'

/**
 * Server-only half of the deletion code: minting it. The shape, the
 * normalisation and the identifier are shared with the modal in
 * src/lib/deleteCode.ts; this module is the part that needs node:crypto.
 *
 * The code IS the token Better Auth's own `/delete-user` endpoint consumes
 * (see `createAndSendDeleteCode` in ./index): the library still checks it
 * against the session that asked for it, spends it once, deletes the sessions,
 * account rows and the app's own data, and clears the cookie. Nothing about
 * the deletion is hand-rolled here.
 */
export function generateDeleteCode(
  pick: (maxExclusive: number) => number = randomInt,
): string {
  let code = ''
  for (let index = 0; index < DELETE_CODE_LENGTH; index += 1) {
    code += DELETE_CODE_ALPHABET[pick(DELETE_CODE_ALPHABET.length)]
  }
  return code
}

export {
  DELETE_ACCOUNT_PREFIX,
  DELETE_CODE_LENGTH,
  DELETE_CODE_TTL_SECONDS,
  deleteAccountIdentifier,
  normalizeDeleteCode,
} from '@/lib/deleteCode'
