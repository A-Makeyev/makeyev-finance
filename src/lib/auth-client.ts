import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

/**
 * Browser auth client. No baseURL: it defaults to the current origin, so the
 * same bundle works for localhost, previews and production without another
 * environment variable.
 *
 * The emailOTP client plugin mirrors the server plugin in src/server/auth, so
 * the password-reset calls (`emailOtp.requestPasswordReset` /
 * `emailOtp.resetPassword`) exist and are typed. Only public client methods
 * (signIn, signUp, signOut, useSession, emailOtp) are used; nothing here holds
 * a secret.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
})
