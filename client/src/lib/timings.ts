// Shared UI timing constants, in a DOM-free module so e2e specs can import
// them and drive the same timings deterministically (page.clock) instead of
// duplicating hardcoded millisecond values that drift from the components.

/** HelpTooltip: hover-out grace before the hover-opened panel closes. */
export const HOVER_CLOSE_DELAY_MS = 300

/** HelpTooltip: how long the closed panel stays mounted for its exit animation. */
export const PANEL_EXIT_DURATION_MS = 150
