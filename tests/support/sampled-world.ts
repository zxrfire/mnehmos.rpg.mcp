/** Acceptance samples read genuinely aged checkpoints; long exploration runs outside CI. */
import type { WorldState } from '../../src/engine/world/world-state.js';
import { preBakedWorld, soakedWorld } from './soaked-world.js';

export async function sampledWorld(seed: string, options: { years: number }): Promise<WorldState> {
    // Opening and decade controls remain inexpensive ordinary walks.
    if (options.years <= 10) return soakedWorld(seed, options);
    const world = preBakedWorld(seed, options.years);
    if (!world) throw new Error(`Missing current-source ${seed}@${options.years}. Run the background regenerator through heavy-run: node scripts/regenerate-world-fixtures.mjs --seed ${seed} --years ${options.years}`);
    return world;
}
