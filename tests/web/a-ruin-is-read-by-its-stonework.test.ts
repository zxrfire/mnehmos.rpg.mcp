/**
 * A ruin is read by what is left of how it was built, against the houses the
 * reader knows.
 *
 * `survivingTags` and `attributionField` had no caller: a fallen seat kept its
 * house's full style stamp, and "I look at the stonework" at one either printed
 * that stamp as if the house still kept the place (ornament included) or fell
 * through to "nothing standing here was put up to one plan", which is false
 * about a seat.
 *
 * What is pinned: the weathered facets are what is said, the builder is named
 * only to a reader who already knows that house and only when no other known
 * house matches as well, and a reader who knows no house gets no name.
 *
 * RED-CHECKED: passing every house as known names the builder to the played
 * reader, and fails the played arm on the name appearing.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { ruinFromFallenSeat } from '../../src/engine/world/provenance';
import { styleTagsOf } from '../../src/engine/world/architecture';
import { whatTheStoneworkOfARuinSays } from '../../src/web/ruin-stonework';

const WORLD = 'a-ruin-read-by-its-stone';
const YEAR = 365;

describe('a ruin is read by its stonework', () => {
    it('names the builder to a reader who knows it, and to nobody else', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'stone-reader', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Reader');
        const world = (await game.loadWorld())!;
        expect(world, 'the run opened without a world').toBeTruthy();

        // A seated house the player has not heard of, asked of the world.
        const house = world.factions.find(row => {
            const seat = world.locations.find(l => l.id === row.seatLocationId);
            return seat && styleTagsOf(seat).length > 0
                && !game.knowledge.isAwareOf(cultivator.id, 'sect', row.id);
        });
        expect(house, 'no styled seat of an unknown house in this world').toBeTruthy();
        const seat = world.locations.find(l => l.id === house!.seatLocationId)!;

        // Its seat as it would stand five centuries after the house fell.
        const fell = ruinFromFallenSeat(
            { ...seat, id: 'loc-a-fallen-seat', name: 'Cinder Lattice Remains', changes: [] },
            {
                onDay: Math.floor(world.currentDay) - 500 * YEAR,
                houseName: house!.name,
                houseId: house!.id
            }
        ).location;
        world.locations.push(fell);

        // The engine arm: knowing only the builder names it; knowing nobody does not.
        const knowing = whatTheStoneworkOfARuinSays(world, fell, id => id === house!.id)!;
        expect(knowing.lines.join(' ')).toContain(`the way ${house!.name} builds`);
        const other = { ...house!, id: 'house-same-stone', name: 'Another House' };
        const ambiguous = whatTheStoneworkOfARuinSays({ ...world, factions: [house!, other] }, fell,
            id => id === house!.id || id === other.id)!;
        expect(ambiguous.lines.join(' ')).toContain('2 houses you know build this way');
        expect(ambiguous.lines.join(' ')).not.toContain(house!.name);
        expect(ambiguous.lines.join(' ')).not.toContain(other.name);
        const blind = whatTheStoneworkOfARuinSays(world, fell, () => false)!;
        expect(blind.lines.join(' ')).not.toContain(house!.name);
        expect(blind.lines.join(' ')).toMatch(/no house's way of building/);
        // Five centuries takes upkeep with the ornament.
        expect(knowing.structure).toMatch(/age old/);

        // The played arm: the player does not know the house and is not told it.
        repos.cultivators.update(cultivator.id, { location: fell.name });
        const turn = await game.act('I look at the stonework');
        const prose = turn.narration ?? '';
        expect(prose, 'the stonework of a ruin was not read').toMatch(/It is [a-z]/);
        expect(prose, 'a name was handed to somebody who never heard of the house').not.toContain(house!.name);
    }, 180_000);
});
