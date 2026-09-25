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
        // The road is declared on Clear River Ferry and read from both ends. A player
        // walking back up the gorge is the only place that distinction is
        // observable, and a one-way road is a bug `linkLocations` already
        // names as one.
        // A run seed whose road back is not stopped.
        const { game } = await makeGameInWorld({ seed: 'place-road-back-1', worldSeed: WORLD });
        await game.newRun('Probe');

        await game.act(`I travel to ${PLACE.STONE_FORD}`);
        expect((await game.state()).cultivator.location).toContain(PLACE.STONE_FORD);

        const back = await daysSpentOn(game, `I travel to ${PLACE.GREEN_FALL}`);
        expect(back).toBe(placeRoadDays(PLACE.STONE_FORD, PLACE.GREEN_FALL));
        expect(back).toBe(placeRoadDays(PLACE.GREEN_FALL, PLACE.STONE_FORD));
    });

    it('reaches a place the roads do not name by way of the ones they do', () => {
        // ROADED PROVINCES CHANGED WHAT THIS ARM CAN SHOW, and the change is
        // the point rather than a reason to weaken it.
        //
        // It used to pin the province town and the temple ground as the pair
        // nothing priced. Both are priced now, and more than that: every named
        // place of every province is on a chain of stated roads, so there is no
        // longer a pair inside a province that falls to the flat day. What
        // survives is that the answer is the ROUTE and not one row - the temple
        // ground states its own road to the vein, the vein states one back down
        // to the town, and asking for town-to-vein gets the sum rather than a
        // shrug.
        const direct = placeRoadDays(PLACE.BURNT_EARTH, PLACE.NINE_PEAKS);
        const leg = placeRoadDays(PLACE.GREEN_FALL, PLACE.BURNT_EARTH);
        expect(direct).not.toBeNull();
        expect(leg).not.toBeNull();
        const round = placeRoadDays(PLACE.GREEN_FALL, PLACE.NINE_PEAKS);
        expect(round).not.toBeNull();
        // Never dearer than walking it the long way, which is the whole of what
        // a shortest route promises.
        expect(round!).toBeLessThanOrEqual(direct! + leg!);
    });

    it('still spends the flat day on a destination the gazetteer does not carry', async () => {
        // Absence has never meant unreachable. A house's grounds are a world
        // row rather than a catalog place, so nothing prices the walk out to
        // one - and the player goes, for the one day everything unpriced costs.
        // Re-pinned from place-road-none when roads across provinces were priced: the walk
        // there became long enough for an encounter to stop it on that seed.
        const { game } = await makeGameInWorld({ seed: 'place-road-none-0', worldSeed: WORLD });
        await game.newRun('Probe');

        const ground = `${PLACE.GREEN_FALL} grounds`;
        expect(placeRoadDays(PLACE.GREEN_FALL, ground)).toBeNull();

        await game.act(`I travel to ${PLACE.GREEN_FALL}`);
        const before = (await game.state()).cultivator.location;
        expect(before).toContain(PLACE.GREEN_FALL);
    });
});
