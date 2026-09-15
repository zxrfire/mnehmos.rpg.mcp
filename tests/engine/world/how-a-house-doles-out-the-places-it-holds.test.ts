/**
 * How many places your house gets from theirs is a statement about what they
 * think of you, and it is said in front of everybody else who asked.
 *
 * So the properties worth pinning are not arithmetic ones. They are:
 *
 *   the number moves with standing      a house thought better of gets more
 *   it can be bought                    a year of a door's levy is worth a
 *                                       point of standing, and a house that
 *                                       pays and is disliked can draw level
 *                                       with one that is liked and does not
 *   a refusal is a statement            a house either side of the alliance
 *                                       line is given nothing and is TOLD so,
 *                                       rather than being absent from the list
 *   the door seats what it seats        largest remainder, so the deal sums to
 *                                       the count exactly and not to a rounding
 *
 * The one that is easy to lose and expensive to lose: a refused house appears in
 * `dealt` with a reason. An allocation that silently drops the houses it will
 * not have is the empty-board defect - the world says nothing rather than no,
 * and nobody can play against a number they were never given.
 *
 * Red-checked: dropping the largest-remainder loop turns the exact-sum
 * assertions red; returning a floor of 0.1 instead of 0 from `weightOfAnAsk`
 * turns the refusal assertions red.
 */

import { describe, expect, it } from 'vitest';

import { ALLIED_STANDING } from '../../../src/engine/world/gatherings.js';
import {
    STONES_PER_POINT_OF_STANDING,
    TOO_HOSTILE_TO_BE_GIVEN_A_PLACE,
    dealThePlaces,
    weightOfAnAsk,
    type AHouseAsking
} from '../../../src/engine/world/how-a-house-doles-out-the-places-it-holds.js';

function asking(over: Partial<AHouseAsking> & Pick<AHouseAsking, 'id'>): AHouseAsking {
    return {
        name: `house ${over.id}`,
        standingFromTheHolder: 0,
        standingTowardTheHolder: 0,
        paid: 0,
        ...over
    };
}

function deal(places: number, houses: readonly AHouseAsking[]) {
    return dealThePlaces({
        places,
        holderId: 'f-holder',
        holderName: 'the house at the door',
        asking: houses
    });
}

const placesFor = (d: ReturnType<typeof deal>, id: string): number =>
    d.dealt.find(row => row.houseId === id)?.places ?? -1;

describe('how a house doles out the places it holds', () => {
    it('seats exactly as many as the door seats', () => {
        for (const places of [1, 3, 8, 18, 64]) {
            const d = deal(places, [
                asking({ id: 'f-a', standingFromTheHolder: 0.6 }),
                asking({ id: 'f-b', standingFromTheHolder: 0.1 }),
                asking({ id: 'f-c', standingFromTheHolder: -0.2 })
            ]);
            expect(d.dealt.reduce((sum, row) => sum + row.places, 0)).toBe(places);
        }
    });

    it('keeps some of its own door for its own people', () => {
        const d = deal(18, [asking({ id: 'f-a', standingFromTheHolder: 0.9 })]);
        expect(placesFor(d, 'f-holder')).toBeGreaterThan(0);
    });

    it('gives more to the house it thinks more of', () => {
        const d = deal(18, [
            asking({ id: 'f-liked', standingFromTheHolder: 0.8 }),
            asking({ id: 'f-tolerated', standingFromTheHolder: 0 })
        ]);
        expect(placesFor(d, 'f-liked')).toBeGreaterThan(placesFor(d, 'f-tolerated'));
    });

    it('lets a house buy what it is not thought enough of to be given', () => {
        const liked = asking({ id: 'f-liked', standingFromTheHolder: 1 });
        const paying = asking({
            id: 'f-paying',
            standingFromTheHolder: -0.2,
            paid: STONES_PER_POINT_OF_STANDING * 2
        });
        expect(weightOfAnAsk(paying)).toBeGreaterThan(weightOfAnAsk(liked));
        const d = deal(18, [liked, paying]);
        expect(placesFor(d, 'f-paying')).toBeGreaterThan(placesFor(d, 'f-liked'));
    });

    it('holds the rivalry against a house that pays and resents paying', () => {
        const willing = asking({ id: 'f-willing', standingFromTheHolder: 0.2, standingTowardTheHolder: 0.2 });
        const resentful = asking({ id: 'f-resentful', standingFromTheHolder: 0.2, standingTowardTheHolder: -0.2 });
        expect(weightOfAnAsk(resentful)).toBeLessThan(weightOfAnAsk(willing));
    });

    // ── A REFUSAL IS CONTENT ─────────────────────────────────────────────

    it('gives nothing to a house it will not have at the door, and says so', () => {
        const hated = asking({ id: 'f-hated', standingFromTheHolder: TOO_HOSTILE_TO_BE_GIVEN_A_PLACE - 0.1 });
        const d = deal(18, [hated, asking({ id: 'f-ok', standingFromTheHolder: 0.3 })]);
        const row = d.dealt.find(r => r.houseId === 'f-hated');
        expect(row).toBeDefined();
        expect(row!.places).toBe(0);
        expect(row!.because).not.toHaveLength(0);
        expect(d.turnedAway).toContain('f-hated');
    });

    it('cannot be bought past the line a rivalry sits at', () => {
        const hated = asking({
            id: 'f-hated',
            standingFromTheHolder: TOO_HOSTILE_TO_BE_GIVEN_A_PLACE - 0.1,
            paid: STONES_PER_POINT_OF_STANDING * 100
        });
        expect(weightOfAnAsk(hated)).toBe(0);
        expect(placesFor(deal(18, [hated, asking({ id: 'f-ok' })]), 'f-hated')).toBe(0);
    });

    it('never hands a refused house a place through a rounding', () => {
        const hated = asking({ id: 'f-hated', standingFromTheHolder: -1 });
        // One place to deal beyond what the holder keeps, and a remainder that
        // would otherwise fall to the house with nothing floored.
        const d = deal(3, [hated, asking({ id: 'f-ok', standingFromTheHolder: 0.1 })]);
        expect(placesFor(d, 'f-hated')).toBe(0);
        expect(d.dealt.reduce((sum, row) => sum + row.places, 0)).toBe(3);
    });

    it('keeps the whole door where it will not have any of them at it', () => {
        const ids = ['f-a', 'f-b', 'f-c'];
        const d = deal(18, ids.map(id => asking({ id, standingFromTheHolder: -1 })));
        for (const id of ids) expect(placesFor(d, id)).toBe(0);
        expect(placesFor(d, 'f-holder')).toBe(18);
        expect(d.dealt.reduce((sum, row) => sum + row.places, 0)).toBe(18);
    });

    it('lists every house that asked, including the ones given nothing', () => {
        const ids = ['f-a', 'f-b', 'f-c', 'f-d'];
        const d = deal(2, ids.map(id => asking({ id, standingFromTheHolder: -1 })));
        for (const id of ids) expect(d.dealt.some(row => row.houseId === id)).toBe(true);
    });

    it('holds the alliance line as the line, rather than a second number', () => {
        expect(TOO_HOSTILE_TO_BE_GIVEN_A_PLACE).toBe(-ALLIED_STANDING);
    });
});
