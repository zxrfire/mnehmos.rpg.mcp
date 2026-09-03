/**
 * How many days each verb spends.
 *
 * Split out of `actions.ts` because it is the one thing the reader, the plan
 * schema and the pattern table all need: `parseDuration` clamps to the ceiling
 * here, `PlannedActionSchema` bounds `days` by it, and the table reads the
 * defaults when a sentence names no span. Left in place it would have made
 * those three modules import each other in a circle.
 *
 * Single reason to change: what a verb costs in days.
 */

/** Longest stretch of seclusion that may be requested in one call: 100 years. */
export const MAX_CULTIVATION_DAYS = 36_500;

/** Days of seclusion assumed when the player says "cultivate" with no duration. */
export const DEFAULT_CULTIVATION_DAYS = 30;

/** Days a stretch of technique practice consumes. */
export const TRAINING_DAYS = 7;

/** Days a stretch of foraging consumes. */
export const GATHERING_DAYS = 7;

/**
 * Days a stretch of hunting consumes.
 *
 * Longer than foraging because the thing being looked for moves and most of
 * the work is finding it. `ESTIMATING_A_BEAST` in the catalog says the
 * reliable tell is absence - how far out the ordinary animals have gone -
 * and reading that is walking, not digging.
 */
export const HUNTING_DAYS = 10;

/** Days a burial takes when no duration is named. A week with a spade. */
export const DEFAULT_BURIAL_DAYS = 7;

/** Days sealed closed-door seclusion runs for when no duration is named. */
export const DEFAULT_SECLUSION_DAYS = 365;

/**
 * Days of work assumed when the player says "take work" with no duration.
 *
 * A season. Long enough to be worth the walk and short enough that a hungry
 * cultivator is not committing the rest of their life to a granary.
 */
export const DEFAULT_WORK_DAYS = 90;
