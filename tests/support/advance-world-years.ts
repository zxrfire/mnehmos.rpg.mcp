/**
 * `advanceWorldForPlay`, phrased in years.
 *
 * The game advances the world by days, from the turn that spent them; nothing
 * it runs asks for a span in years. Tests and probes do, a hundred of them, so
 * the wrapper lives here where they share it rather than in `driver.ts`, where
 * it read as a second way into the world.
 */

import { DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation.js';
import {
    advanceWorldForPlay,
    type AdvanceForPlayOptions,
    type PlayAdvanceResult
} from '../../src/engine/world/driver.js';
import type { WorldState } from '../../src/engine/world/world-state.js';

export function advanceWorldYears(
    state: WorldState,
    years: number,
    opts: Omit<AdvanceForPlayOptions, 'days'> = {}
): PlayAdvanceResult {
    return advanceWorldForPlay(state, { ...opts, days: Math.round(years * DAYS_PER_YEAR) });
}
