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
 * The 120s animation duration in globals.css is coupled to this number: 3
 * groups per 120s cycle = one group per 40s, the speed the original 2-copy
 * track moved at. Change one, change both.
 */
export const MARQUEE_COPIES = 6
