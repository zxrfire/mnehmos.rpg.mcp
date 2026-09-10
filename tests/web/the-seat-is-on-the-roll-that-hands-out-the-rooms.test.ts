/**
 * The house's own head was missing from the roll that hands out its rooms.
 *
 * `seatElders` stops one rung short of the top, and that is CORRECT for every
 * consumer of `view.elders` inside `sect-leadership.ts`: challenging for the
 * seat, dismissing an elder, pricing a dismissal. All three are acts the head
 * performs on the people under them, and a head who appeared in their own list
 * of elders would be a defect of its own. The `- 1` in that file's disciple
 * count is the same decision said in arithmetic.
 *
 * `whoDecidesIn` is not one of those consumers, and it disagrees. It filters a
 * roll with `isElderRank`, whose header states the rule the omission breaks:
 * *the top rung is one too*. So the roll assembled for `portfoliosIn` was every
 * decider in the house EXCEPT the one who decides most.
 *
 * That matters because of what is done with it. `whoIsInChargeOfWhat` sorts the
 * sealed rooms deepest-first and hands them to the heaviest voice first, round
 * robin. Drop the head and every room shifts up one: the innermost room of a
 * house goes to its second most senior person, and an elder claiming the
 * house's word over that room is told they hold it.
 *
 * ── WHY IT WAS INVISIBLE ─────────────────────────────────────────────────
 *
 * The order path gates on `canOrder` - whether this rung reaches that rung -
 * and not on the seat, so any rung that can send anybody at all reaches it. The
 * caller then puts the cultivator on the roll itself. Where the cultivator IS
 * the head the roll was already whole, and that is the case anybody testing
 * house leadership reaches for first.
 *
 * ── AND THE TWO ORDERS A PLAYER ACTUALLY MEETS ───────────────────────────
 *
 * Asked for directly: an elder ordering somebody on the house's behalf, and the
 * same elder asking for something as themselves. The engine already models the
 * difference as `AuthorityClaim`, and it is the whole of what "on what
 * authority" means:
 *
 *   DELEGATED  taking a group into a forbidden ground to train, which is the
 *              house's business and is done in the house's name. Legitimate
 *              only where the giver actually runs the room it falls under, and
 *              a claim on a room somebody else holds is refused with the holder
 *              named.
 *
 *   PERSONAL   go and buy me something at the auction. Nothing of the house is
 *              being claimed, so the ladder is the only question and the ladder
 *              has already answered it. Always legitimate, and that is not a
 *              loophole - it buys less, and `resolveAct` prices it.
 *
 * The distinction is what the fix protects. Both orders are priced against the
 * portfolio table, so a roll missing the head misprices the delegated one and a
 * room's real holder cannot be named correctly in the refusal.
 */

import { describe, it, expect } from 'vitest';

import { SECTS } from '../../src/data/cultivation/index';
import { getMembersOf } from '../../src/data/cultivation/members';
import {
    elderRungOf,
    isElderRank,
    isHeadOfHouse
} from '../../src/engine/cultivation/leadership';
import {
    whetherTheyMayGiveThisOrder
} from '../../src/engine/social-leverage/authority-for-an-order';
import {
    whoIsInChargeOfWhat
} from '../../src/engine/social-leverage/what-an-elder-is-in-charge-of';

/** A house with enough ladder to have a head above its elders. */
const HOUSE = SECTS.find(s => s.ranks.length >= 4)!;
const RANK_COUNT = HOUSE.ranks.length;
const THE_SEAT = RANK_COUNT - 1;

/**
 * The roll as `sect-leadership.ts` assembled it BEFORE the fix: the cultivator,
 * plus the elders, with the top rung dropped.
 */
function theRollAsItWas(meRung: number): Array<{ id: string; rankIndex: number }> {
    const elders: Array<{ id: string; rankIndex: number }> = [];
    for (let rung = elderRungOf(RANK_COUNT); rung < RANK_COUNT - 1; rung++) {
        elders.push({ id: `elder:${HOUSE.id}:${rung}:0`, rankIndex: rung });
    }
    return [{ id: 'me', rankIndex: meRung }, ...elders];
}

/** And with the seat on it, which is what the fix adds. */
function theRollAsItIs(meRung: number): Array<{ id: string; rankIndex: number }> {
    const roll = theRollAsItWas(meRung);
    return isHeadOfHouse(meRung, RANK_COUNT)
        ? roll
        : [...roll, { id: `elder:${HOUSE.id}:${THE_SEAT}:0`, rankIndex: THE_SEAT }];
}

/** Two sealed rooms at different depths, so "deepest first" is observable. */
const ROOMS = ['treasury', 'punishment_hall'] as const;

describe('the seat is a decider, and the ladder already said so', () => {
    /**
     * THE RULE THE OMISSION BROKE, asserted against the module that owns it
     * rather than restated here.
     */
    it('counts the top rung as an elder rank', () => {
        expect(isElderRank(THE_SEAT, RANK_COUNT)).toBe(true);
        expect(isHeadOfHouse(THE_SEAT, RANK_COUNT)).toBe(true);
    });

    it('puts the seat on the roll when the asker is not sitting in it', () => {
        const anElder = elderRungOf(RANK_COUNT);
        expect(theRollAsItWas(anElder).some(p => p.rankIndex === THE_SEAT)).toBe(false);
        expect(theRollAsItIs(anElder).some(p => p.rankIndex === THE_SEAT)).toBe(true);
    });

    /**
     * AND NEVER TWICE. The caller already puts the cultivator on the roll, so a
     * head who was seated again would be two people at the top rung and the
     * deepest room would go to somebody who is not there.
     */
    it('does not seat the head twice when the asker is the head', () => {
        const roll = theRollAsItIs(THE_SEAT);
        expect(roll.filter(p => p.rankIndex === THE_SEAT)).toHaveLength(1);
        expect(roll.filter(p => p.rankIndex === THE_SEAT)[0]!.id).toBe('me');
    });

    /**
     * THE CONSEQUENCE, which is the reason any of this matters. The rooms are
     * handed out deepest-first to the heaviest voice first, so a roll missing
     * its head shifts every room up one.
     */
    it('gives the deepest room to the seat rather than to the elder below it', () => {
        const anElder = elderRungOf(RANK_COUNT);

        const before = whoIsInChargeOfWhat({
            rooms: ROOMS, roll: theRollAsItWas(anElder), rankCount: RANK_COUNT
        });
        const after = whoIsInChargeOfWhat({
            rooms: ROOMS, roll: theRollAsItIs(anElder), rankCount: RANK_COUNT
        });

        const deepestBefore = [...before].sort((a, b) => b.depth - a.depth)[0]!;
        const deepestAfter = [...after].sort((a, b) => b.depth - a.depth)[0]!;

        // Somebody holds it either way - the defect was never a missing room,
        // it was the wrong person answering for one.
        expect(deepestBefore.holderId).not.toBeNull();
        expect(deepestAfter.holderId).not.toBeNull();
        expect(deepestAfter.holderId).not.toBe(deepestBefore.holderId);
        expect(deepestAfter.holderId).toContain(`:${THE_SEAT}:`);
    });
});

describe('an elder ordering somebody on the house\'s behalf', () => {
    const anElder = elderRungOf(RANK_COUNT);
    const portfolios = () => whoIsInChargeOfWhat({
        rooms: ROOMS, roll: theRollAsItIs(anElder), rankCount: RANK_COUNT
    });

    /**
     * Taking a group into a forbidden ground to train is the house's business,
     * done in the house's name. It stands on what the giver actually runs.
     */
    /**
     * WHOEVER ACTUALLY HOLDS ONE, rather than a rung picked by hand. There are
     * more deciders in a house than sealed rooms, so the rooms stop part way
     * down the ladder and which rung they stop at is a property of the house.
     * An earlier cut of this asserted the lowest elder rung held one, and it
     * held nothing - the two rooms went to the seat and the rung under it.
     */
    it('lets somebody who runs a room speak for the house', () => {
        const rooms = portfolios();
        const belowTheSeat = rooms.find(
            p => p.holderId !== null && !p.holderId.includes(`:${THE_SEAT}:`)
        );
        expect(belowTheSeat, 'nobody under the seat holds a room here').toBeDefined();

        const said = whetherTheyMayGiveThisOrder({
            claim: 'delegated',
            giverId: belowTheSeat!.holderId!,
            portfolios: rooms
        });
        expect(said.legitimate).toBe(true);
        expect(said.held.length).toBeGreaterThan(0);
    });

    /**
     * AND REFUSES A CLAIM ON A ROOM SOMEBODY ELSE HOLDS, naming who does. This
     * is the assertion the fix is really for: before it, the room the SEAT
     * holds was reported as held by the elder below, so this refusal named the
     * wrong person - or did not happen at all.
     */
    it('refuses a room the seat holds, and names the seat', () => {
        const rooms = portfolios();
        const theSeatHolds = rooms.find(p => p.holderId?.includes(`:${THE_SEAT}:`))!;
        const theElder = rooms.find(
            p => p.holderId !== null && !p.holderId.includes(`:${THE_SEAT}:`)
        )!;
        expect(theSeatHolds).toBeDefined();
        expect(theElder).toBeDefined();
        expect(theSeatHolds.purpose).not.toBe(theElder.purpose);

        const overreach = whetherTheyMayGiveThisOrder({
            claim: 'delegated',
            giverId: theElder.holderId!,
            portfolios: rooms,
            under: theSeatHolds.purpose
        });
        expect(overreach.legitimate).toBe(false);
        expect(overreach.heldInstead).toBe(theSeatHolds.holderId);
        expect(overreach.heldInstead).toContain(`:${THE_SEAT}:`);
    });

    it('refuses somebody who claims the house and runs none of it', () => {
        const said = whetherTheyMayGiveThisOrder({
            claim: 'delegated', giverId: 'a-disciple', portfolios: portfolios()
        });
        expect(said.legitimate).toBe(false);
        expect(said.held).toHaveLength(0);
    });
});

describe('the same elder asking as themselves', () => {
    const anElder = elderRungOf(RANK_COUNT);

    /**
     * Go and buy me something at the auction. Nothing of the house is claimed,
     * so the ladder is the only question and it has already been answered.
     */
    it('is legitimate on the ladder alone, holding no room at all', () => {
        const said = whetherTheyMayGiveThisOrder({
            claim: 'personal',
            giverId: 'holds-nothing',
            portfolios: whoIsInChargeOfWhat({
                rooms: ROOMS, roll: theRollAsItIs(anElder), rankCount: RANK_COUNT
            })
        });
        expect(said.legitimate).toBe(true);
        expect(said.under).toBeNull();
        expect(said.heldInstead).toBeNull();
    });

    /**
     * AND IT CLAIMS NO ROOM EVEN WHERE THE GIVER HOLDS ONE. A personal errand
     * from somebody who runs the treasury is still a personal errand; letting
     * the portfolio attach itself would make every order the house's.
     */
    it('claims no room even when the person asking runs one', () => {
        const rooms = whoIsInChargeOfWhat({
            rooms: ROOMS, roll: theRollAsItIs(anElder), rankCount: RANK_COUNT
        });
        const holder = rooms.find(p => p.holderId !== null)!;

        const said = whetherTheyMayGiveThisOrder({
            claim: 'personal', giverId: holder.holderId!, portfolios: rooms
        });
        expect(said.legitimate).toBe(true);
        expect(said.claim).toBe('personal');
        expect(said.under).toBeNull();
    });

    /**
     * The two claims are different answers to the same sentence, which is the
     * point of having a claim at all.
     */
    it('is answered differently from the same order given in the house\'s name', () => {
        const rooms = whoIsInChargeOfWhat({
            rooms: ROOMS, roll: theRollAsItIs(anElder), rankCount: RANK_COUNT
        });
        const nobody = 'holds-nothing';
        expect(
            whetherTheyMayGiveThisOrder({ claim: 'personal', giverId: nobody, portfolios: rooms })
                .legitimate
        ).toBe(true);
        expect(
            whetherTheyMayGiveThisOrder({ claim: 'delegated', giverId: nobody, portfolios: rooms })
                .legitimate
        ).toBe(false);
    });
});

describe('the house this is measured against is a real one', () => {
    it('has a ladder with a head above its elders, and a catalog behind it', () => {
        expect(RANK_COUNT).toBeGreaterThanOrEqual(4);
        expect(elderRungOf(RANK_COUNT)).toBeLessThan(THE_SEAT);
        // Not asserted as a count: some houses name nobody to the top rung and
        // the seat is synthetic there, which is the case `seatTheHead` covers.
        expect(Array.isArray(getMembersOf(HOUSE.id))).toBe(true);
    });
});
