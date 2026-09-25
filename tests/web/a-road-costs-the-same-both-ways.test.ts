/**
 * A road costs the same both ways.
 *
 * Played: Cold Peak to the Tranquil Oasis grounds was a day, and the same
 * road back seventeen. The gazetteer does not name a house's grounds, so
 * `standingOf` put anybody standing there in the home province, and the road
 * out was priced from a province they were not in.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { HOME_REGION_ID, REGIONS } from '../../src/data/cultivation/regions.js';
import { getSect } from '../../src/data/cultivation/sects.js';
import { standingOf } from '../../src/server/consolidated/where-a-cultivator-is-standing.js';
import type { Cultivator } from '../../src/schema/cultivation.js';

const OASIS = 'Tranquil Oasis Sect';

describe('a house\'s grounds', () => {
    it('are in the province that holds the house', () => {
        const holds = REGIONS.find(region => region.factionIds.some(id => getSect(id)?.name === OASIS))!;
        // Not vacuous: the fall-through answer was the home province.
        expect(holds.id).not.toBe(HOME_REGION_ID);
        for (const said of [`${OASIS} grounds`, OASIS]) {
            expect(standingOf({ location: said } as Cultivator).regionId, said).toBe(holds.id);
        }
    });
});

describe('the road to a house and back', () => {
    it('costs the same days each way', async () => {
        const { game, repos } = await makeGameInWorld({
            worldSeed: 'walking-up-the-terraces-world', seed: 'a-road-both-ways'
        });
        const { cultivator } = await game.newRun('Shen Ruo');
        await game.act('I travel to Cold Peak');
        const days = () => repos.runs.getById(game.state().run.id)!.elapsedDays;

        const setOut = days();
        await game.act(`I walk to the ${OASIS}`);
        const there = days() - setOut;
        expect(repos.cultivators.getById(cultivator.id)!.location).toBe(`${OASIS} grounds`);

        const turnBack = days();
        const back = await game.act('I go to Cold Peak');
        const road = /Travel of (\d+) days?/.exec(back.narration);
        expect(road, back.narration).not.toBeNull();
        expect(Number(road![1])).toBe(Math.round(there));
        expect(days() - turnBack).toBeLessThanOrEqual(Math.round(there));
    }, 120_000);
});
