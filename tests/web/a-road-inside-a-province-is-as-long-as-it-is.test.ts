/**
 * The rate test for place adjacency: does a road inside a province cost what
 * the catalog says it costs, measured where the player would notice?
 *
 * `tests/data/places-can-be-next-to-places.test.ts` is the unit half - it says
 * what a place road IS and pins the rule that keeps it from being a second
 * distance. This is the other half AGENTS.md asks for: the thing happens at
 * all, at the point somebody playing would see it.
 *
 * WHAT WAS WRONG, AND IT WAS ONLY VISIBLE FROM INSIDE A TURN. `move` spent one
 * flat day for every journey to anywhere. `daysOnTheRoadTo` closed half of
 * that by reading `Region.connections`, so a crossing between provinces
 * started costing its stated eleven or thirty-four days - and the other half
 * stayed open, because nothing anywhere priced a road between two settlements
 * of ONE province. The game told a player that the ford was down the gorge
 * road from the province town and then put them there in the same day it would
 * have taken them to the far side of the world.
 *
 * MEASURED IN DAYS OFF THE RUN, NOT OUT OF THE PROSE. AGENTS.md: read state,
 * never narration. `run.elapsedDays` is what the world actually charged.
 *
 * WORLD PINNED. A played test that pins a run seed and not a world seed is
 * pinning a coincidence - the world is minted from `randomUUID()` otherwise,
 * and travel resolution consults it for whether a name is a place at all.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { PLACE } from '../../src/data/cultivation/place-names.js';
import { placeRoadDays } from '../../src/data/cultivation/regions.js';
import { SHORT_ACTION_DAYS } from '../../src/web/turn-constants.js';

const WORLD = 'place-road-probe-world';

/** Days the run actually spent over one act. */
async function daysSpentOn(
    game: Awaited<ReturnType<typeof makeGameInWorld>>['game'],
    sentence: string
): Promise<number> {
    const before = (await game.state()).run.elapsedDays;
    await game.act(sentence);
    const after = (await game.state()).run.elapsedDays;
    return after - before;
}

describe('a road inside a province costs what the catalog says', () => {
    it('spends the stated days walking from the province town to the ford', async () => {
        const stated = placeRoadDays(PLACE.GREEN_FALL, PLACE.STONE_FORD);
        expect(stated, 'the catalog states no road, so there is nothing to measure').not.toBeNull();
        // The claim is only interesting because it is NOT the flat day. If the
        // authored figure ever moved to one, this test would pass while
        // measuring nothing, so it says so out loud.
        expect(stated).toBeGreaterThan(SHORT_ACTION_DAYS);

        const { game } = await makeGameInWorld({ seed: 'place-road', worldSeed: WORLD });
        await game.newRun('Probe');

        // Stand at the province town first, whatever the birth dealt, so the
        // journey being measured is the one the catalog priced.
        await game.act(`I travel to ${PLACE.GREEN_FALL}`);
        expect((await game.state()).cultivator.location).toContain(PLACE.GREEN_FALL);

        const spent = await daysSpentOn(game, `I travel to ${PLACE.STONE_FORD}`);
        expect((await game.state()).cultivator.location).toContain(PLACE.STONE_FORD);
        expect(spent).toBe(stated);
    });

    it('walks it back for the same price, off the one row the catalog states', async () => {
        // The road is declared on Clear River Ford and read from both ends. A player
        // walking back up the gorge is the only place that distinction is
        // observable, and a one-way road is a bug `linkLocations` already
        // names as one.
        const { game } = await makeGameInWorld({ seed: 'place-road-back', worldSeed: WORLD });
        await game.newRun('Probe');

        await game.act(`I travel to ${PLACE.STONE_FORD}`);
        expect((await game.state()).cultivator.location).toContain(PLACE.STONE_FORD);

        const back = await daysSpentOn(game, `I travel to ${PLACE.GREEN_FALL}`);
        expect(back).toBe(placeRoadDays(PLACE.STONE_FORD, PLACE.GREEN_FALL));
        expect(back).toBe(placeRoadDays(PLACE.GREEN_FALL, PLACE.STONE_FORD));
    });

    it('still spends the flat day where the catalog prices nothing', async () => {
        // Sparse is the design, and absence has never meant unreachable. A
        // pair with no stated road falls through exactly as it did before this
        // existed - the player goes, and it costs the one day everything
        // unpriced costs.
        expect(placeRoadDays(PLACE.GREEN_FALL, PLACE.BURNT_EARTH)).toBeNull();

        const { game } = await makeGameInWorld({ seed: 'place-road-none', worldSeed: WORLD });
        await game.newRun('Probe');

        await game.act(`I travel to ${PLACE.GREEN_FALL}`);
        const spent = await daysSpentOn(game, `I travel to ${PLACE.BURNT_EARTH}`);
        expect((await game.state()).cultivator.location).toContain(PLACE.BURNT_EARTH);
        expect(spent).toBe(SHORT_ACTION_DAYS);
    });
});
