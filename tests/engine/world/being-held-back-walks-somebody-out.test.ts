/**
 * Being held back in a house is a reason to walk out of it, at any rung.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `promotion-inside-a-house.ts` says a cultivator who has outgrown their rank
 * and cannot be promoted has exactly one move: go somewhere else. Nothing let
 * them. `assessPromotions` computed who was blocked and why every year and threw
 * it away, and the one walk-out reason about having no place in a house,
 * `nothing in the hall is theirs`, fired only on the bottom rung with an empty
 * purse. An elder with no chair, about a hundred per world by the census, could
 * never walk out for being one.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 * The house's own assessment is the cause, never a rung: whoever `blocked`
 * names is held back, from the year it first named them, and it presses harder
 * the longer they wait and the further past the bar they stand, up to what four
 * grievances weigh. It starts at nothing, so a house that could not raise
 * somebody this year has not yet failed them. The other reasons are untouched.
 * The measured effect on the world - twice the departures at every rung and no
 * further thinning at the top - is in `being-held-back-in-a-house.ts`.
 *
 * Red-checked: dropping the reason from `whyTheyWouldLeave` turns the any-rung
 * and weight tests red; keeping `sinceDay` from being carried over turns the
 * since test red; not clearing the tag turns the cleared test red.
 */

import { describe, expect, it } from 'vitest';

import {
    BEING_HELD_BACK_WEIGHS_AT_MOST,
    YEARS_BEFORE_IT_WEIGHS_LIKE_A_REASON,
    howHardBeingHeldBackPresses,
    noteWhoIsHeldBack,
    whereTheyAreHeldBack,
    type HeldBack
} from '../../../src/engine/world/being-held-back-in-a-house.js';
import {
    howMuchTheirReasonsWeigh,
    whetherTheyGoThisYear,
    whyTheyWouldLeave,
    type WhatStayingIsCostingThem
} from '../../../src/engine/world/why-somebody-walks-out-of-a-compound.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { PLAYER_ROW_TAG, createNpc, isTheWorldsToMove, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import type { Blocked } from '../../../src/engine/world/promotion-inside-a-house.js';

const YEAR = DAYS_PER_YEAR;
const DAY = 500 * YEAR;
const THE_HOLD = 'the house has no room for them to rise';

/** An elder of a house with no chair and money in the purse: nothing else is wrong. */
const AN_ELDER_WITH_NO_CHAIR: WhatStayingIsCostingThem = {
    ordinal: 30,
    houseTeachingCeiling: 45,
    theHousePaidThem: true,
    peopleTheyKnewWhoDidNotComeBack: 0,
    factionRankIndex: 4,
    spiritStones: 5_000,
    aRoadAProvinceAway: false
};

const held = (over: Partial<HeldBack> = {}): HeldBack => ({
    houseId: 'house-a', atRank: 4, sinceDay: DAY, realmsPastTheBar: 0, reason: 'no_seat', ...over
});

describe('being held back is a reason at any rung', () => {
    it('moves an elder with no chair, where the bottom-rung reason never could', () => {
        const why = whyTheyWouldLeave({ ...AN_ELDER_WITH_NO_CHAIR, beingHeldBack: 1 });
        expect(why).toContain(THE_HOLD);
        expect(why).not.toContain('nothing in the hall is theirs');
    });

    it('and says nothing about somebody the house is not holding back', () => {
        expect(whyTheyWouldLeave({ ...AN_ELDER_WITH_NO_CHAIR, beingHeldBack: 0 })).toEqual([]);
        expect(whyTheyWouldLeave(AN_ELDER_WITH_NO_CHAIR)).toEqual([]);
    });

    it('comes after the teaching ceiling and before the rest, and leaves them all in place', () => {
        const everything = whyTheyWouldLeave({
            ordinal: 20, houseTeachingCeiling: 20, theHousePaidThem: false,
            peopleTheyKnewWhoDidNotComeBack: 2, factionRankIndex: 0, spiritStones: 0,
            aRoadAProvinceAway: true, beingHeldBack: 2
        });
        expect(everything[0]).toBe('the house cannot teach them further');
        expect(everything[1]).toBe(THE_HOLD);
        expect(everything).toContain('nothing in the hall is theirs');
        expect(everything.length).toBe(6);
    });
});

describe('how hard it presses is how long and how far, and never a rung', () => {
    it('is nothing in the year the house first could not raise them', () => {
        expect(howHardBeingHeldBackPresses(held(), DAY)).toBe(0);
        expect(howHardBeingHeldBackPresses(null, DAY)).toBe(0);
    });

    it('grows with the years they wait', () => {
        const early = howHardBeingHeldBackPresses(held(), DAY + 5 * YEAR);
        const later = howHardBeingHeldBackPresses(held(), DAY + 15 * YEAR);
        expect(early).toBeGreaterThan(0);
        expect(later).toBeGreaterThan(early);
        expect(howHardBeingHeldBackPresses(held(), DAY + YEARS_BEFORE_IT_WEIGHS_LIKE_A_REASON * YEAR))
            .toBeCloseTo(1, 5);
    });

    it('presses harder on somebody a realm past the bar than on somebody just at it', () => {
        const atIt = howHardBeingHeldBackPresses(held(), DAY + 10 * YEAR);
        const past = howHardBeingHeldBackPresses(held({ realmsPastTheBar: 1 }), DAY + 10 * YEAR);
        expect(past).toBeGreaterThan(atIt);
    });

    it('and never weighs more than four grievances', () => {
        expect(howHardBeingHeldBackPresses(held({ realmsPastTheBar: 5 }), DAY + 400 * YEAR))
            .toBe(BEING_HELD_BACK_WEIGHS_AT_MOST);
    });

    it('is the same for the bottom rung as for an elder', () => {
        expect(howHardBeingHeldBackPresses(held({ atRank: 0 }), DAY + 30 * YEAR))
            .toBe(howHardBeingHeldBackPresses(held({ atRank: 6 }), DAY + 30 * YEAR));
    });

    it('so somebody long held back walks out more often than somebody with one grievance', () => {
        const oneGrievance = whyTheyWouldLeave({ ...AN_ELDER_WITH_NO_CHAIR, aRoadAProvinceAway: true });
        const heldBack = howHardBeingHeldBackPresses(held({ realmsPastTheBar: 1 }), DAY + 60 * YEAR);
        const longHeld = whyTheyWouldLeave({ ...AN_ELDER_WITH_NO_CHAIR, beingHeldBack: heldBack });
        let one = 0, long = 0;
        for (let i = 0; i < 4_000; i++) {
            if (whetherTheyGoThisYear(oneGrievance, forStream('held-back', 'one', i))) one++;
            if (whetherTheyGoThisYear(longHeld, forStream('held-back', 'long', i),
                howMuchTheirReasonsWeigh(longHeld, heldBack))) long++;
        }
        expect(long).toBeGreaterThan(one * 2);
    });
});

describe('the house\'s own assessment is written down once, and moves when it does', () => {
    function aHouse(): WorldState {
        const state = createWorld({ seed: 'held-back', skipPriorAges: true, regionCount: 0 });
        state.currentDay = DAY;
        const person = (id: string, rank: number, tags: string[] = []): NpcRecord => ({
            ...setRealm(createNpc(state.seed, { id, bornOnDay: DAY - 80 * YEAR, onDay: DAY, locationId: null, occupation: 'disciple' }), 30, DAY),
            factionId: 'house-a', factionRankIndex: rank, tags
        });
        state.npcs.push(person('elder', 4), person('player', 4, [PLAYER_ROW_TAG]));
        return state;
    }
    const blocked = (atRank = 4): Blocked[] => [
        { npcId: 'elder', factionId: 'house-a', atRank, reason: 'no_seat', bar: 20 },
        { npcId: 'player', factionId: 'house-a', atRank, reason: 'no_seat', bar: 20 }
    ];
    const npc = (state: WorldState, id: string) => state.npcs.find(n => n.id === id)!;

    it('keeps the day it began across the years it stays true', () => {
        const state = aHouse();
        noteWhoIsHeldBack(state, blocked(), DAY, isTheWorldsToMove);
        noteWhoIsHeldBack(state, blocked(), DAY + 10 * YEAR, isTheWorldsToMove);
        const now = whereTheyAreHeldBack(npc(state, 'elder'));
        expect(now?.sinceDay).toBe(DAY);
        expect(now?.realmsPastTheBar).toBeGreaterThan(0);
    });

    it('starts again at a new rung, and is gone the year the house stops naming them', () => {
        const state = aHouse();
        noteWhoIsHeldBack(state, blocked(), DAY, isTheWorldsToMove);
        const i = state.npcs.findIndex(n => n.id === 'elder');
        state.npcs[i] = { ...state.npcs[i]!, factionRankIndex: 5 };
        noteWhoIsHeldBack(state, blocked(5), DAY + 10 * YEAR, isTheWorldsToMove);
        expect(whereTheyAreHeldBack(npc(state, 'elder'))?.sinceDay).toBe(DAY + 10 * YEAR);

        noteWhoIsHeldBack(state, [], DAY + 11 * YEAR, isTheWorldsToMove);
        expect(npc(state, 'elder').tags.some(t => t.startsWith('held-back|'))).toBe(false);
    });

    it('and is never written onto the player\'s row, whose choices are theirs', () => {
        const state = aHouse();
        noteWhoIsHeldBack(state, blocked(), DAY, isTheWorldsToMove);
        expect(whereTheyAreHeldBack(npc(state, 'player'))).toBeNull();
    });
});
