/**
 * Somebody who joined a house after the world opened never held its plate.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `issueTo` had one caller, `seedTreasuries`, which runs at world open. So the
 * founding roll carried tokens and nobody who joined later ever did. And
 * `applyRecruitment` enrols people where they stand, which is right by the
 * ruling - *"technically you do join, you just don't get your ID and ID plate
 * till you get there, so you don't really have proof. You don't get your uniform
 * either"* - with nothing that ever brought them to the house.
 *
 * Measured on six seeded worlds (`probe-does-a-recruit-reach-the-house.ts`),
 * summed, people on a roll they were not on at world open:
 *
 *                                 25 years           100 years
 *   before  robed                   0 of 980           0 of 2178
 *           owed a token, hold      0 of 369           0 of 1278
 *   after   robed                 889 of 977        2108 of 2196
 *           owed a token, hold    241 of 377        1065 of 1263
 *
 * Robes in the year somebody joins at the median, a year later at p90. A token
 * a median of twelve years after joining by a century, which is the climb from
 * rung 0 to the first rung that carries one rather than the road.
 *
 * AND THE TRIP IS THERE AND BACK. The first cut moved recruits into the
 * compound for good, and on the `demography` seed at 80 years that took people
 * in settlements from 557 to 338 and emptied one. Joining where you stand is
 * right, and so is living where you live.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 * Joining is not proof: until they have been to the house a doorway finds no
 * token. Going there robes them and, at a rung that carries one where the house
 * can cut plates, gives them a token with a plate on the wall - and then they go
 * home. The founding roll is not walked to its own gate; a founder promoted onto
 * the token rung is, which is the same trip for the same reason. Somebody who
 * leaves hands back what they were issued, and a robe in a stranger's hands
 * stays there.
 *
 * Red-checked three ways: with the pass off, with `travelling` taken out of
 * `isAwayOnSomething` (nobody comes home), and with the hand-back disabled.
 */

import { describe, expect, it } from 'vitest';

import { applyPressure } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import {
    carriesATokenAt,
    issueTo,
    platesAreCutAt,
    plateIdFor,
    theHouseTheirTokenNames,
    tokenIdFor,
    whatTheTwoSay
} from '../../../src/engine/world/a-house-knows-its-own-by-a-plate-and-a-token.js';
import {
    aUniformFor,
    enterWhoeverHasReachedTheHouse,
    wearsTheRobesOf
} from '../../../src/engine/world/a-recruit-is-given-their-plate-at-the-house.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { linkLocations, makeLocation } from '../../../src/engine/world/locations.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;
const DAY = 200 * YEAR;
const HOUSE = 'house-a';
const HOUSE_NAME = 'Stone Gate Sect';
const SEAT = 'seat-a';
const HALL = 'seat-a-ancestral-hall';
const VILLAGE = 'loc-village';

function person(state: WorldState, id: string, at: string, rankIndex: number, ordinal: number): NpcRecord {
    const npc = setRealm(createNpc(state.seed, {
        id, bornOnDay: DAY - 60 * YEAR, onDay: DAY, locationId: at, occupation: 'disciple'
    }), ordinal, DAY);
    return { ...npc, factionId: HOUSE, factionRankIndex: rankIndex, activity: null };
}

/**
 * A house with a Foundation elder at home, so it can cut plates, and three
 * people in a village a few days off: a founding member entered before the world
 * opened, and two who have just joined - one at a rung that carries a token, one
 * below it.
 */
function build(opts: { canCut?: boolean } = {}): WorldState {
    const state = createWorld({ seed: 'a-recruit-is-given-their-plate', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    const region = makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' });
    const seat = makeLocation({ id: SEAT, name: 'The Hall', kind: 'sect_seat', parentId: region.id });
    const hall = makeLocation({
        id: HALL, name: 'The Ancestral Hall', kind: 'hall', parentId: SEAT,
        data: { purpose: 'ancestral_hall', factionId: HOUSE }
    });
    const village = makeLocation({ id: VILLAGE, name: 'Low Ford', kind: 'settlement', parentId: region.id });
    linkLocations(seat, village, 'road', 6);
    state.locations.push(region, seat, hall, village);
    state.factions.push(makeFaction({
        id: HOUSE, name: HOUSE_NAME, seatLocationId: SEAT, foundedOnDay: 0,
        resources: { spirit_stones: 50_000, power_ordinal: 4, reliable_ordinal: 4 }
    }));

    const cutter = opts.canCut === false ? platesAreCutAt() - 1 : platesAreCutAt() + 2;
    state.npcs.push(
        person(state, 'elder', SEAT, 4, cutter),
        person(state, 'founder', VILLAGE, 1, 6),
        person(state, 'recruit', VILLAGE, 1, 6),
        person(state, 'servant', VILLAGE, 0, 3)
    );
    // The founding member was entered before the world opened.
    const founded = issueTo({
        memberId: 'founder', memberName: 'Founder', houseId: HOUSE, houseName: HOUSE_NAME,
        plateRoomId: HALL, onDay: 0
    });
    state.objects.push(
        aUniformFor({ memberId: 'elder', houseId: HOUSE, houseName: HOUSE_NAME, onDay: 0 }),
        aUniformFor({ memberId: 'founder', houseId: HOUSE, houseName: HOUSE_NAME, onDay: 0 }),
        founded.token,
        founded.plate
    );
    return state;
}

const npc = (state: WorldState, id: string) => state.npcs.find(n => n.id === id)!;
const at = (state: WorldState, id: string) => state.npcs.findIndex(n => n.id === id);
const has = (state: WorldState, id: string) => state.objects.some(o => o.id === id);
const carries = (state: WorldState, objectId: string, holderId: string) =>
    state.objects.some(o => o.id === objectId && o.possessorId === holderId);

/** What somebody who knows a Stone Gate robe finds when they ask for the token. */
function atTheDoorway(state: WorldState, id: string) {
    return whatTheTwoSay({
        theAskerKnowsWhatItIs: true,
        theObjectNames: HOUSE,
        theTokenNames: theHouseTheirTokenNames(state.objects, { id, isAlive: npc(state, id).status === 'alive' })
    });
}

describe('a recruit joins where they stand and has nothing to show for it', () => {
    it('so a doorway finds no token to read', () => {
        const state = build();
        expect(atTheDoorway(state, 'recruit')).toBe('no token to read');
        expect(wearsTheRobesOf(state.objects, 'recruit', HOUSE)).toBe(false);
    });

    it('until they go to the house, are entered there, and set out for home', () => {
        const state = build();
        const done = enterWhoeverHasReachedTheHouse(state, DAY);
        expect(done.sent).toBeGreaterThan(0);
        const recruit = npc(state, 'recruit');
        expect(recruit.locationId).toBe(SEAT);
        expect(recruit.activity?.kind).toBe('travelling');
        expect(recruit.activity?.returnTo, 'home is where they live, not the house').toBe(VILLAGE);
        expect(typeof recruit.activity?.untilDay).toBe('number');
        expect(wearsTheRobesOf(state.objects, 'recruit', HOUSE)).toBe(true);
        expect(atTheDoorway(state, 'recruit')).toBe('they agree');
    });

    it('but somebody in a scene with another person is not pulled out of it', () => {
        const state = build();
        const i = at(state, 'recruit');
        state.npcs[i] = {
            ...state.npcs[i]!,
            activity: { kind: 'talking', note: 'Talking.', withIds: ['somebody'], sinceDay: DAY }
        };
        enterWhoeverHasReachedTheHouse(state, DAY);
        expect(npc(state, 'recruit').activity?.kind).toBe('talking');
        expect(atTheDoorway(state, 'recruit')).toBe('no token to read');
    });

    it('and the founding roll is not walked to its own gate', () => {
        const state = build();
        enterWhoeverHasReachedTheHouse(state, DAY);
        expect(npc(state, 'founder').activity).toBeNull();
        expect(npc(state, 'founder').locationId).toBe(VILLAGE);
    });

    it('though a founder promoted onto the token rung makes the same trip', () => {
        const state = build();
        const token = state.objects.findIndex(o => o.id === tokenIdFor('founder'));
        state.objects.splice(token, 1);
        enterWhoeverHasReachedTheHouse(state, DAY);
        expect(npc(state, 'founder').activity?.kind).toBe('travelling');
        expect(carries(state, tokenIdFor('founder'), 'founder')).toBe(true);
    });

    it('and somebody who left hands back what they were issued, and is entered again if taken back', () => {
        // Measured on `town-b`: a member walked out in year 188, was taken back
        // onto the same roll at a dao ground in 192 still wearing the robes from
        // world open, and was never sent to the house.
        const state = build();
        const i = at(state, 'founder');
        state.npcs[i] = { ...state.npcs[i]!, factionId: null, factionRankIndex: -1 };
        enterWhoeverHasReachedTheHouse(state, DAY);
        expect(wearsTheRobesOf(state.objects, 'founder', HOUSE)).toBe(false);
        expect(carries(state, tokenIdFor('founder'), 'founder')).toBe(false);

        state.npcs[i] = { ...state.npcs[i]!, factionId: HOUSE, factionRankIndex: 0 };
        enterWhoeverHasReachedTheHouse(state, DAY + YEAR);
        expect(npc(state, 'founder').activity?.kind).toBe('travelling');
        expect(wearsTheRobesOf(state.objects, 'founder', HOUSE)).toBe(true);
    });

    it('but a robe in somebody else\'s hands stays there, which is the seam a disguise works', () => {
        const state = build();
        const robe = state.objects.findIndex(o => o.tags.includes('uniform') && o.possessorId === 'founder');
        state.npcs.push({ ...person(state, 'stranger', VILLAGE, -1, 6), factionId: null });
        state.objects[robe] = { ...state.objects[robe]!, possessorId: 'stranger' };
        enterWhoeverHasReachedTheHouse(state, DAY);
        expect(state.objects[robe]!.possessorId).toBe('stranger');
    });
});

describe('lived through the world\'s own year', () => {
    /** Two world years: the pass sends and enters them, and the return pass that ends every term brings them home. */
    function lived(opts: { canCut?: boolean } = {}): WorldState {
        const state = build(opts);
        applyPressure(state, DAY, DAY + 2 * YEAR, { intensity: 0 });
        return state;
    }

    it('a recruit comes home robed, with a token, and a plate on the house\'s wall', () => {
        const state = lived();
        const recruit = npc(state, 'recruit');
        expect(recruit.status).toBe('alive');
        expect(recruit.factionId).toBe(HOUSE);
        const away = recruit.activity?.kind === 'stationed' || recruit.activity?.kind === 'out_with_a_party';
        if (!away) expect(recruit.locationId, 'the trip is there and back').toBe(VILLAGE);
        expect(wearsTheRobesOf(state.objects, 'recruit', HOUSE)).toBe(true);
        expect(carries(state, tokenIdFor('recruit'), 'recruit')).toBe(true);
        expect(state.objects.find(o => o.id === plateIdFor('recruit'))?.locationId).toBe(HALL);
        expect(atTheDoorway(state, 'recruit')).toBe('they agree');
    });

    it('below the token rung, robes and no token - and a token once they climb to it', () => {
        // Whichever rung the two years left them on: the promotion pass runs
        // too, and being promoted onto the first disciple rung is the same trip.
        const state = lived();
        const servant = npc(state, 'servant');
        expect(servant.factionId).toBe(HOUSE);
        expect(wearsTheRobesOf(state.objects, 'servant', HOUSE)).toBe(true);
        expect(carries(state, tokenIdFor('servant'), 'servant')).toBe(carriesATokenAt(servant.factionRankIndex));
    });

    it('and a house with nobody who can cut a plate robes them and cuts nothing', () => {
        const state = lived({ canCut: false });
        expect(wearsTheRobesOf(state.objects, 'recruit', HOUSE)).toBe(true);
        expect(has(state, tokenIdFor('recruit'))).toBe(false);
        expect(has(state, plateIdFor('recruit'))).toBe(false);
    });
});
