/**
 * The market that is people rather than stalls.
 *
 * The guards here are the two that decide whether this is a market or a
 * clearance sale of the world:
 *
 *   NOBODY SELLS THE ROAD THEY ARE WALKING - without it a thin purse puts
 *   every working manual in the world on a counter, and 56% of living NPCs
 *   have a thin purse.
 *   RUNGS 2 AND 3 DO NOT MOVE - `betrayalOfSelling`'s own scale, which is what
 *   keeps the deep half of the world's shelf off the market entirely.
 *
 * Both are decisions rather than tuning, which is why they are pinned by name.
 */

import { describe, it, expect } from 'vitest';
import {
    whatThisPersonWouldPartWith,
    whyThisOneWouldGo,
    itIsTheThingTheyAreStillUsing,
    theirPurseIsThin,
    HOW_BADLY_THEY_WANT_IT_GONE,
    WHY_THEY_ARE_SELLING,
    WHY_IT_STAYS_WHERE_IT_IS,
    type AThingInSomebodysHands,
    type SomebodyStandingHere
} from '../../../src/engine/world/what-somebody-standing-here-would-part-with.js';
import { earningsPerYear } from '../../../src/engine/cultivation/origin.js';

function person(over: Partial<SomebodyStandingHere> = {}): SomebodyStandingHere {
    return {
        id: 'npc-1',
        name: 'Yun Minkuan',
        ordinal: 13,
        // Comfortably above a year of their own income unless a test says
        // otherwise, so the thin-purse reading never fires by accident.
        spiritStones: Math.ceil(earningsPerYear(13) * 5),
        factionId: 'sect-a',
        ...over
    };
}

function thing(over: Partial<AThingInSomebodysHands> = {}): AThingInSomebodysHands {
    return {
        id: 'tech-primer',
        name: 'Lesser Qi-Gathering Manual',
        usableFrom: 0,
        usefulUntil: 13,
        listStones: 8,
        awkwardToHold: 0,
        whoWouldWantAWord: null,
        ...over
    };
}

describe('nobody sells the road they are walking', () => {
    it('withholds a thing the holder is standing in the middle of', () => {
        const who = person({ ordinal: 6 });
        const held = thing({ usableFrom: 0, usefulUntil: 13 });
        expect(itIsTheThingTheyAreStillUsing(who, held)).toBe(true);

        const read = whatThisPersonWouldPartWith(who, [held]);
        expect(read.offers).toHaveLength(0);
        expect(read.withheld.map(w => w.why)).toEqual(['they_are_going_to_need_it']);
    });

    it('withholds it even when the purse is empty', () => {
        // The case the guard exists for. Half the living world is under the
        // thin-purse line, and without this rule every one of them would be
        // selling the manual their next two centuries depend on.
        const who = person({ ordinal: 6, spiritStones: 0 });
        expect(theirPurseIsThin(who)).toBe(true);

        const read = whatThisPersonWouldPartWith(who, [thing({ usefulUntil: 13 })]);
        expect(read.offers).toHaveLength(0);
        expect(read.withheld[0].why).toBe('they_are_going_to_need_it');
    });

    it('offers it once they have climbed past where it stops', () => {
        const who = person({ ordinal: 13 });
        const read = whatThisPersonWouldPartWith(who, [thing({ usefulUntil: 13 })]);
        expect(read.withheld).toHaveLength(0);
        expect(read.offers.map(o => o.why)).toEqual(['they_have_outgrown_it']);
    });
});

describe('the deep half of the shelf is not on the market', () => {
    it('will not sell their own house\'s working manual at any price', () => {
        const read = whatThisPersonWouldPartWith(
            person({ ordinal: 21, spiritStones: 0 }),
            [thing({ usefulUntil: 17, awkwardToHold: 2, whoWouldWantAWord: 'sect-a' })]
        );
        expect(read.offers).toHaveLength(0);
        expect(read.withheld[0].why).toBe('it_is_their_own_house_s');
        // And the refusal names a way out that is not money.
        expect(WHY_IT_STAYS_WHERE_IT_IS.it_is_their_own_house_s).toContain('the house');
    });

    it('will not sell something nobody alive could write out again', () => {
        const read = whatThisPersonWouldPartWith(
            person({ ordinal: 33, spiritStones: 0, factionId: null }),
            [thing({ usefulUntil: 29, awkwardToHold: 3, whoWouldWantAWord: 'sect-b' })]
        );
        expect(read.offers).toHaveLength(0);
        expect(read.withheld[0].why).toBe('nobody_alive_could_replace_it');
    });

    it('leaves rung 0 and rung 1 as the only market there is', () => {
        const who = person({ ordinal: 21 });
        const shelf: AThingInSomebodysHands[] = [
            thing({ id: 'a', usefulUntil: 13, awkwardToHold: 0 }),
            thing({ id: 'b', usefulUntil: 17, awkwardToHold: 1, whoWouldWantAWord: 'sect-z' }),
            thing({ id: 'c', usefulUntil: 17, awkwardToHold: 2, whoWouldWantAWord: 'sect-a' }),
            thing({ id: 'd', usefulUntil: 17, awkwardToHold: 3, whoWouldWantAWord: 'sect-z' })
        ];
        const read = whatThisPersonWouldPartWith(who, shelf);
        expect(read.offers.map(o => o.thingId).sort()).toEqual(['a', 'b']);
        expect(read.offers.every(o => o.awkwardToHold <= 1)).toBe(true);
    });
});

describe('the reason is read off a column, not assigned', () => {
    it('holding somebody else\'s signature explains the sale before anything else', () => {
        const who = person({ ordinal: 21, spiritStones: 0, factionId: null });
        const held = thing({ usefulUntil: 17, awkwardToHold: 1, whoWouldWantAWord: 'sect-z' });
        // Thin purse AND outgrown are both true; the signature outranks both.
        expect(theirPurseIsThin(who)).toBe(true);
        expect(whyThisOneWouldGo(who, held, true)).toBe('not_theirs_to_be_seen_with');
        expect(WHY_THEY_ARE_SELLING.not_theirs_to_be_seen_with)
            .toContain('where it came from');
    });

    it('a thin purse explains a sale the rung alone would not', () => {
        const held = thing({ usefulUntil: 13 });
        const rich = person({ ordinal: 13 });
        const poor = person({ ordinal: 13, spiritStones: 0 });
        expect(whyThisOneWouldGo(rich, held, theirPurseIsThin(rich))).toBe('they_have_outgrown_it');
        expect(whyThisOneWouldGo(poor, held, theirPurseIsThin(poor))).toBe('they_need_stones');
    });

    it('something pitched above the holder is a different sentence again', () => {
        const who = person({ ordinal: 6 });
        const held = thing({ usableFrom: 13, usefulUntil: 17 });
        expect(whyThisOneWouldGo(who, held, false)).toBe('it_is_beyond_them');
    });

    it('reports nothing for somebody who is simply using the thing', () => {
        const who = person({ ordinal: 6 });
        expect(whyThisOneWouldGo(who, thing({ usefulUntil: 13 }), false)).toBeNull();
    });
});

describe('the ask is inside the band and nothing invents a price', () => {
    it('never asks more than list nor less than a counter would give', () => {
        const who = person({ ordinal: 21 });
        const read = whatThisPersonWouldPartWith(who, [
            thing({ id: 'a', usefulUntil: 13, listStones: 8 }),
            thing({ id: 'b', usefulUntil: 17, listStones: 15, awkwardToHold: 1,
                whoWouldWantAWord: 'sect-z' }),
            thing({ id: 'c', usableFrom: 29, usefulUntil: 33, listStones: 40 })
        ]);
        expect(read.offers.length).toBeGreaterThan(0);
        for (const offer of read.offers) {
            expect(offer.askStones).toBeGreaterThanOrEqual(
                Math.min(offer.counterStones, offer.listStones)
            );
            expect(offer.askStones).toBeLessThanOrEqual(
                Math.max(offer.counterStones, offer.listStones)
            );
            expect(offer.askStones).toBeGreaterThanOrEqual(1);
        }
    });

    it('somebody who has to sell today asks less than somebody who does not', () => {
        const held = thing({ usefulUntil: 13, listStones: 40 });
        const pressed = whatThisPersonWouldPartWith(
            person({ ordinal: 13, spiritStones: 0 }), [held]
        ).offers[0];
        const unpressed = whatThisPersonWouldPartWith(person({ ordinal: 13 }), [held]).offers[0];
        expect(pressed.why).toBe('they_need_stones');
        expect(unpressed.why).toBe('they_have_outgrown_it');
        expect(pressed.askStones).toBeLessThan(unpressed.askStones);
    });

    it('somebody in no hurry holds out for what the thing is worth', () => {
        // `it_is_beyond_them` sits at 0 on the eagerness scale, which is what
        // "they know it is worth something to somebody" means as a number.
        expect(HOW_BADLY_THEY_WANT_IT_GONE.it_is_beyond_them).toBe(0);
        const offer = whatThisPersonWouldPartWith(
            person({ ordinal: 6 }),
            [thing({ usableFrom: 13, usefulUntil: 17, listStones: 15 })]
        ).offers[0];
        expect(offer.why).toBe('it_is_beyond_them');
        expect(offer.askStones).toBe(offer.listStones);
    });
});

describe('the thin-purse line moves with the ladder', () => {
    it('prices the same purse differently at two rungs', () => {
        // A hundred stones is a comfortable year at the bottom of the ladder
        // and well under one higher up - 54 a year against 451. A flat number
        // would have said the two people were in the same situation.
        expect(theirPurseIsThin({ ...person({ ordinal: 0 }), spiritStones: 100 })).toBe(false);
        expect(theirPurseIsThin({ ...person({ ordinal: 21 }), spiritStones: 100 })).toBe(true);
    });

    it('reads the purse a run opens with as thin, which it is', () => {
        // Thirty stones at ordinal zero is under a year of even the gross
        // figure, and `origin.ts` says the same thing from the other side: a
        // farm child does not have a small budget, they have very nearly none.
        expect(theirPurseIsThin({ ...person({ ordinal: 0 }), spiritStones: 30 })).toBe(true);
    });
});

describe('a person holding nothing is answered rather than skipped', () => {
    it('returns two empty lists', () => {
        const read = whatThisPersonWouldPartWith(person(), []);
        expect(read.offers).toEqual([]);
        expect(read.withheld).toEqual([]);
        expect(read.who.name).toBe('Yun Minkuan');
    });
});
