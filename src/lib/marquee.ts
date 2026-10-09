/**
 * How many times each top strip (Indexes + Markets) repeats its content group
 * in the compact (<=1200px) marquee tier.
 *
 * The loop animates the track by -50% (three groups with six in the track), so
 * the frame at the loop point is pixel-identical to the frame at the start and
 * the infinite cycle never jumps. Coverage is the constraint that actually
 * fixes the "stops and starts over" bug: at the loop point the track must
 * still cover the whole viewport, which needs HALF the track (3 groups) to be
 * at least the widest compact viewport (1200px), i.e. every group at least
 * 400px wide. Six copies clear that with margin for the narrowest state
 * (the Indexes skeletons measure ~630px per group; the loaded strips are far
 * wider), where the previous two-copy track let blank space eat in from the
 * right whenever one group was narrower than the screen.
 *
 * The animation durations in globals.css are coupled to this number: the loop
 * shifts by half the track (3 groups) per cycle, so one group per
 * (duration / 3). Markets runs the original 120s (one group per 40s); Indexes
 * runs 240s - one group per 80s - because the two strips are deliberately
 * paced differently. Change the copy count, change those durations.
 *
 * The tracks must NOT flex-shrink below this content width (globals.css pins
 * `flex: 0 0 auto`): the loop travel is a percentage of the track box, so a
 * track squeezed to its min-content width wraps mid-group instead of on the
 * third group, and the strip visibly snaps back every cycle.
 */
export const MARQUEE_COPIES = 6
