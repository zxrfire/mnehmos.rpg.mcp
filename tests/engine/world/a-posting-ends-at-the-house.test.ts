/**
 * A house sent somebody to a town and never got them back.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `applyPostings` wrote `returnTo` as wherever the person was standing when the
 * post was dealt, so somebody posted from a village went back to the village.
 * That alone does not empty a house. What did was every OTHER writer of an away
 * activity doing the same over a posting that had not been brought home yet:
 * the yearly return runs on day 62 and postings are written on day 64, so every
 * posting spent most of a year in its town with the term over, free to be
 * drafted, and the party that drafted it wrote the town as home. The conclave's
 * walk to a door overwrote a posting still running the same way.
 *
 * Measured on six seeded worlds (`probe-does-a-posting-bring-anybody-home.ts`),
 * members standing at their own seat, summed:
 *
 *                     world open     25 years       100 years
 *   before            2634/3205      1035/2909       341/3050
 *   after             2634/3205      1212/2907       697/3054
 *
 * and houses that could not answer their own gate at a century, 80 of 236
 * before and 19 of 239 after. At two hundred years on `town-a` and `town-b`,
 * 3 and 4 in a hundred postings pointed home at the house, and 23 of 72 and 26
 * of 78 people who stood in the compound at world open were idle in some other
 * place. After, every posting and nobody.
 *
 * ── WHAT IS STILL TRUE ───────────────────────────────────────────────────
 *
 * An errand still ends where it began. A disciple who lives in a village and
 * goes out on a party comes back to the village - that is what `returnTo` was
 * added for. The rule is narrower: a POSTING ends at the house, and somebody
 * already away on something keeps the home that errand holds.
 *
 * Red-checked by reverting each half: the posting site turns the first two red,
 * `whereTheyGoBackTo` turns the drafted case red.
 */

import { describe, expect, it } from 'vitest';

import { applyPressure } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { takeThemWithYou } from '../../../src/engine/world/who-is-on-the-road-with-you.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;
const DAY = 200 * YEAR;
const SEAT = 'seat-a';
const VILLAGE = 'loc-village';
const TOWN = 'loc-town';

/**
 * One house, and every one of its people standing in a village rather than in
 * the compound - so a posting that went back to wherever somebody was standing
 * would send every one of them to the village.
 */
function build(): WorldState {
    const state = createWorld({ seed: 'a-posting-ends-at-the-house', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' }));
    state.locations.push(makeLocation({ id: SEAT, name: 'The Hall', kind: 'sect_seat', parentId: 'loc-region' }));
    state.locations.push(makeLocation({ id: VILLAGE, name: 'Low Ford', kind: 'settlement', parentId: 'loc-region' }));
    state.locations.push(makeLocation({ id: TOWN, name: 'Salt Market', kind: 'settlement', parentId: 'loc-region' }));
    state.factions.push(makeFaction({
        id: 'house-a', name: 'house-a', seatLocationId: SEAT, foundedOnDay: 0,
        resources: { spirit_stones: 50_000, power_ordinal: 24, reliable_ordinal: 16 }
    }));
    for (let i = 0; i < 10; i++) {
        let npc = createNpc(state.seed, {
            id: `npc-${i}`,
            bornOnDay: DAY - 60 * YEAR,
            onDay: DAY,
            locationId: VILLAGE,
            occupation: 'disciple'
        });
        npc = setRealm(npc, 14, DAY);
        state.npcs.push({ ...npc, factionId: 'house-a', factionRankIndex: 1 });
    }
    return state;
}

const stationed = (state: WorldState) =>
    state.npcs.filter(n => n.status === 'alive' && n.activity?.kind === 'stationed');

describe('a posting ends at the house', () => {
    it('is written with the house as home, wherever the person was standing', () => {
        const state = build();
        applyPressure(state, DAY, DAY + YEAR, { intensity: 0 });
        const posted = stationed(state);
        expect(posted.length, 'the precondition: somebody was posted').toBeGreaterThan(0);
        for (const who of posted) {
            expect(who.activity!.returnTo, `${who.id} was posted from ${VILLAGE}`).toBe(SEAT);
        }
    });

    it('and once the term is over they are at the house, or away from it on its business', () => {
        const state = build();
        applyPressure(state, DAY, DAY + YEAR, { intensity: 0 });
        const posted = new Set(stationed(state).map(n => n.id));
        expect(posted.size).toBeGreaterThan(0);

        // Past the longest term a posting can be dealt, and the year the return
        // pass takes to reach one.
        applyPressure(state, DAY + YEAR, DAY + 26 * YEAR, { intensity: 0 });

        let checked = 0;
        for (const who of state.npcs) {
            if (!posted.has(who.id) || who.status !== 'alive' || who.factionId !== 'house-a') continue;
            checked++;
            const away = who.activity?.kind === 'stationed' || who.activity?.kind === 'out_with_a_party';
            if (away) {
                expect(who.activity!.returnTo, `${who.id} is away with somewhere else as home`).toBe(SEAT);
            } else {
                expect(who.locationId, `${who.id} came off a posting and is not at the house`).toBe(SEAT);
            }
        }
        expect(checked, 'somebody who was posted is still alive and on the roll').toBeGreaterThan(0);
    });
});

describe('somebody already away keeps the home that errand holds', () => {
    /** Standing in a town on a posting whose term ran out before anybody brought them back. */
    function aLapsedPosting(): NpcRecord {
        const npc = createNpc('lapsed', {
            id: 'npc-lapsed', bornOnDay: DAY - 60 * YEAR, onDay: DAY, locationId: TOWN, occupation: 'disciple'
        });
        return {
            ...npc,
            factionId: 'house-a',
            factionRankIndex: 3,
            activity: {
                kind: 'stationed',
                note: 'Holding the house\'s interest at Salt Market.',
                withIds: [],
                sinceDay: DAY - 12 * YEAR,
                untilDay: DAY - 30,
                returnTo: SEAT
            }
        };
    }

    it('so a party that takes them out of the town brings them back to the house', () => {
        const [taken] = takeThemWithYou([aLapsedPosting()], {
            leaderId: 'somebody',
            party: [{ id: 'npc-lapsed', name: 'Lapsed' }],
            note: 'On the road.',
            onDay: DAY,
            untilDay: DAY + 40
        });
        expect(taken!.locationId).toBe(TOWN);
        expect(taken!.activity!.returnTo).toBe(SEAT);
    });

    it('and somebody who lives in a village still comes back to the village', () => {
        const villager = createNpc('villager', {
            id: 'npc-villager', bornOnDay: DAY - 30 * YEAR, onDay: DAY, locationId: VILLAGE, occupation: 'disciple'
        });
        const [taken] = takeThemWithYou([{ ...villager, factionId: 'house-a', factionRankIndex: 0 }], {
            leaderId: 'somebody',
            party: [{ id: 'npc-villager', name: 'Villager' }],
            note: 'On the road.',
            onDay: DAY,
            untilDay: DAY + 40
        });
        expect(taken!.activity!.returnTo).toBe(VILLAGE);
    });
});
