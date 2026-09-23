/**
 * A pair of communication jade is two linked halves, whichever way it arrives.
 *
 *   A COMMISSION   asked for, placed and made on its day: one half is the
 *                  commissioner's, the twin is the maker's when they were asked
 *                  to keep it, and both are made by the jade module's own pair
 *                  maker, naming each other
 *   A BESTOWAL     a house with nothing in its stores worth giving has its jade
 *                  maker make a pair: a half to the person it marked, the twin kept
 *
 * THE WORLD IS PINNED for the commission, because the maker is one of its people.
 */

import { describe, expect, it } from 'vitest';
import { refiningOrdinalFor } from '../../src/engine/cultivation/who-can-refine-a-grade-of-medicine';
import {
    aPairOfCommunicationJade,
    isAJadeHalf,
    theJadeBetween,
    theirJadeBreaks
} from '../../src/engine/world/a-pair-of-communication-jade';
import { whatEachHouseGivesAsAPairOfJade } from '../../src/engine/world/a-house-bestows-a-thing-on-somebody-who-earned-it';
import { THE_PAIRED_COMMUNICATION_JADE } from '../../src/data/cultivation/communication-talismans';
import { createNpc } from '../../src/engine/world/npc-state';
import { makeFaction, createWorld } from '../../src/engine/world/world-state';
import { makeLocation } from '../../src/engine/world/locations';

const WORLD = 'a-pair-of-jade';

describe('a pair of jade, bestowed', () => {
    it('is made for the marked person by the house\'s jade maker, who keeps the twin', () => {
        const state = createWorld({ seed: 'bestowed-jade', skipPriorAges: true, regionCount: 1, presentYear: 0 });
        const seat = makeLocation({ id: 'loc-seat', name: 'The Seat', kind: 'sect_seat', parentId: null });
        state.locations.push(seat);
        // A house the draw lets give something, found rather than assumed.
        let houseId = '';
        for (let i = 0; i < 50 && houseId === ''; i++) {
            const id = `house-jade-${i}`;
            const trial = { ...state, factions: [makeFaction({ id, name: 'A House', seatLocationId: seat.id, ranks: ['outer', 'inner', 'core', 'elder', 'head'] })] };
            const maker = createNpc('jade', { id: 'maker', name: 'Maker', bornOnDay: 0, onDay: 0, locationId: seat.id, factionId: id, factionRankIndex: 4, cultivation: { realmOrdinal: refiningOrdinalFor('earth') + 5 } });
            const marked = { ...createNpc('jade', { id: 'marked', name: 'Marked', bornOnDay: 0, onDay: 0, locationId: seat.id, factionId: id, factionRankIndex: 1 }), tags: ['chosen'] };
            trial.npcs = [maker, marked];
            if (whatEachHouseGivesAsAPairOfJade(trial, [], 0).length > 0) { houseId = id; Object.assign(state, trial); }
        }
        expect(houseId, 'no house in fifty drew a gift').not.toBe('');

        const [gift] = whatEachHouseGivesAsAPairOfJade(state, [], 0);
        expect(gift!.toNpcId).toBe('marked');
        const keyed = gift!.halves.map(half => half.data.keyedTo).sort();
        expect(keyed).toEqual(['maker', 'marked']);

        // And a house with something tracked in its stores gives that instead.
        const stores = [{ id: 'a-sword', kind: 'artifact', significance: 'notable', ownerId: houseId, possessorId: null }];
        expect(whatEachHouseGivesAsAPairOfJade(state, stores, 0)).toEqual([]);

        // Unless the person it marked is away from its seat, when a line kept open
        // to them is the gift, whatever the stores hold.
        const away = { ...state, npcs: state.npcs.map(n => (n.id === 'marked' ? { ...n, locationId: 'somewhere-else' } : n)) };
        expect(whatEachHouseGivesAsAPairOfJade(away, stores, 0).map(gift => gift.toNpcId)).toEqual(['marked']);
    });
});

describe('a pair whose holder is gone', () => {
    /**
     * IT WAS A LEAK, AND IT GOT SLOWER AS THE WORLD GOT OLD.
     *
     * A half used to be marked `broken` and left in `state.objects` forever, so
     * the count grew with everybody who had ever held a pair rather than with
     * everybody who holds one, and the reads walk the objects. A pair answers to
     * nothing once one end of it is gone, and the design owner ruled the
     * parallel case: destroy them or leave them, *"honestly for simplicity"*.
     */
    function aPair(one: string, two: string) {
        return aPairOfCommunicationJade({
            maker: { id: one, name: one, ordinal: 20 },
            keeps: { id: one, name: one },
            gives: { id: two, name: two },
            onDay: 1000
        });
    }

    it('is collected, and the pairs beside it are left alone', () => {
        const objects = [...aPair('elder', 'student'), ...aPair('other-a', 'other-b')];
        expect(objects.filter(isAJadeHalf)).toHaveLength(4);

        const collected = theirJadeBreaks(objects, 'student', 1200);

        expect(collected, 'both halves of the one pair').toBe(2);
        expect(objects.filter(isAJadeHalf), 'and nothing of it is left behind').toHaveLength(2);
        expect(objects.every(o => o.data.keyedTo !== 'student' && o.data.keyedTo !== 'elder'))
            .toBe(true);
    });
});
