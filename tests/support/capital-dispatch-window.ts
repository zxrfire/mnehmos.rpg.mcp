/** Observe actual dispatches before routine completed dockets are swept away. */
import type { HistoricalFact } from '../../src/engine/world/history.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { factsWithData } from '../../src/engine/world/witness-reaction-index.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';

export function capitalDispatchesDuring(world: WorldState, days: number,
    advance: typeof advanceWorldForPlay = advanceWorldForPlay): HistoricalFact[] {
    const seen = new Map<string, HistoricalFact>();
    const observe = (state: WorldState): void => {
        for (const fact of factsWithData(state, 'capitalMission')) {
            if (fact.data.capitalMission === true) seen.set(fact.id, fact);
        }
    };
    observe(world);
    const result = advance(world, { days, stopOnInterrupt: false, atWorldBoundary: observe });
    if (result.daysAdvanced !== days) throw new Error('The observed dispatch window ended early');
    observe(world);
    return [...seen.values()];
}
