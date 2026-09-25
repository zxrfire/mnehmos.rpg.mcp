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
import { makeGameInWorld } from './harness';
import type { WorldState } from '../../src/engine/world/world-state';
import type { Cultivator } from '../../src/schema/cultivation';
import { refiningOrdinalFor } from '../../src/engine/cultivation/who-can-refine-a-grade-of-medicine';
import { addToPouch, readJsonFlag } from '../../src/server/consolidated/cultivation-support';
import { WHAT_AN_ARTIFACT_IS_MADE_OF, whatWouldFill } from '../../src/data/cultivation/what-an-artifact-is-made-of';
import { askingSomebodyToMakeYouSomething } from '../../src/engine/social-leverage/commissioning-a-craft';
import { whatTheyWereAskedToMake } from '../../src/web/what-somebody-was-asked-to-make';
import {
    FLAG_COMMISSIONS_PLACED,
    placeTheCommission,
    settleWhatWasPlacedWithAMaker,
    whoTheTwinIsFor
} from '../../src/web/a-commission-placed-with-a-maker';
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
import type { GameService } from '../../src/web/turn-engine';

const WORLD = 'a-pair-of-jade';

describe('a pair of jade, commissioned', () => {
    it('reads who the twin is for off what was said', () => {
        const maker = { id: 'm', name: 'Maker' };
        const world = { npcs: [createNpc('jade', { id: 'npc-lin', name: 'Lin Ya', bornOnDay: 0, onDay: 0 })] };
        expect(whoTheTwinIsFor('make me a pair of communication jade and keep the other half', maker, world)).toEqual(maker);
        expect(whoTheTwinIsFor('make me a pair of jade, the other half for Lin Ya', maker, world)?.id).toBe('npc-lin');
        expect(whoTheTwinIsFor('make me a pair of jade', maker, world)).toBeNull();
        expect(whatTheyWereAskedToMake('a pair of communication jade').grade).toBe(THE_PAIRED_COMMUNICATION_JADE.grade);
    });

    it('is made as two halves naming each other, one the commissioner\'s and the twin the maker\'s', async () => {
        const h = await makeGameInWorld({ seed: WORLD, worldSeed: WORLD, worldEnabled: true });
        const { cultivator } = await h.game.newRun('Asker');
        const game = h.game as unknown as GameService & { atHand: WorldState };
        await h.game.act('I look around');
        const world = game.atHand;
        const makers = world.npcs
            .filter(n => n.status === 'alive' && n.locationId !== null
                && n.cultivation.realmOrdinal >= refiningOrdinalFor('earth') + 8)
            .sort((a, b) => (a.id < b.id ? -1 : 1));
        expect(makers.length, 'nobody in this world can make jade').toBeGreaterThan(0);
        // The work is rolled, and a maker whose roll fails makes nothing: the first
        // of them whose work comes off whole is the one read.
        let maker = makers[0]!;
        let asker = h.repos.cultivators.getById(cultivator.id)! as Cultivator;
        let made = false;
        for (const candidate of makers.slice(0, 6)) {
            maker = candidate;
            const place = world.locations.find(l => l.id === maker.locationId)!;
            h.db.prepare('UPDATE cultivators SET location = ?, spirit_stones = 900000 WHERE id = ?').run(place.name, cultivator.id);
            for (const slot of WHAT_AN_ARTIFACT_IS_MADE_OF.earth) addToPouch(h.db, cultivator.id, whatWouldFill(slot)[0]!.id, 'herb', 1);
            asker = h.repos.cultivators.getById(cultivator.id)! as Cultivator;
            const said = `I pay ${maker.name} 900000 stones to make me a pair of communication jade and keep the other half`;
            const ask = whatTheyWereAskedToMake('a pair of communication jade');
            const answer = askingSomebodyToMakeYouSomething({
                ask, askerId: asker.id, maker: { id: maker.id, ordinal: maker.cultivation.realmOrdinal },
                stonesOffered: 900000, thingsPutDown: [], onDay: 0, readingOf: () => 1
            });
            expect(answer.agreed, answer.line).toBe(true);
            const placed = placeTheCommission({ game, cultivator: asker, makerId: maker.id, ask, answer, stonesOffered: 900000, said });
            expect(placed?.structure.join(' ')).toMatch(/placeTheCommission/);
            world.currentDay = world.npcs.find(n => n.id === maker.id)!.activity!.untilDay!;
            const settled = settleWhatWasPlacedWithAMaker(game, asker)!;
            if (/Made as a pair/.test(settled.structure.join(' '))) { made = true; break; }
        }
        expect(made, 'no maker in six brought the work off').toBe(true);

        const halves = world.objects.filter(o => isAJadeHalf(o) && o.data.madeBy === maker.id
            && [asker.id, maker.id].includes(String(o.data.keyedTo)));
        expect(halves).toHaveLength(2);
        expect(new Set(halves.map(o => o.data.twinId))).toEqual(new Set(halves.map(o => o.id)));
        expect(halves.find(o => o.data.keyedTo === maker.id)?.possessorId).toBe(maker.id);
        // Their half is in their hands, and the pair works; or the maker is holding
        // it for them until they come, and it is on the list to be handed over.
        const mine = halves.find(o => o.data.keyedTo === asker.id)!;
        if (mine.possessorId === asker.id) {
            expect(theJadeBetween(world, maker.id, asker.id, () => true)).not.toBeNull();
        } else {
            expect(mine.possessorId).toBe(maker.id);
            const kept = readJsonFlag<{ heldIds?: string[] }[]>(h.db, asker.id, FLAG_COMMISSIONS_PLACED) ?? [];
            expect(kept.some(one => one.heldIds?.includes(mine.id))).toBe(true);
        }
    }, 300_000);
});

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
            const marked = { ...createNpc('jade', { id: 'marked', name: 'Inscribed', bornOnDay: 0, onDay: 0, locationId: seat.id, factionId: id, factionRankIndex: 1 }), tags: ['chosen'] };
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
