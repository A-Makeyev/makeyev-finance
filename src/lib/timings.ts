// Shared UI timing constants, in a DOM-free module so e2e specs can import
// them and drive the same timings deterministically (page.clock) instead of
// duplicating hardcoded millisecond values that drift from the components.

/** HelpTooltip: hover-out grace before the hover-opened panel closes. */
export const HOVER_CLOSE_DELAY_MS = 300

/** HelpTooltip: how long the closed panel stays mounted for its exit animation. */
export const PANEL_EXIT_DURATION_MS = 150

/**
 * Password reset: how long the "send a new code" action stays locked after a
 * code goes out - the first request and every re-send alike.
 *
 * 30s is what mainstream OTP / reset flows use (Supabase's default cooldown is
 * 60s, Firebase's email-link is 60s), and it is also the shortest cooldown the
 * CLIENT can afford here: the endpoint allows 3 requests per minute per IP
 * (src/server/auth), so a 10s client lock could spend the whole quota in 20s
 * and hand the user a 429 instead of a code.
 *
 * This is a UX floor, not the rate limit. The server counts every request
 * regardless of what the button shows, and a disabled button is never access
 * control - the 3/min limit is.
 */
export const RESEND_COOLDOWN_MS = 30_000
