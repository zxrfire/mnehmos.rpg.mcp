/**
 * THE CASH LINE RUNS BOTH WAYS.
 *
 * Some things money does not buy. `pillTradeTier` decides it off the grade, and
 * `pillCashPrice` says the rule in its own words:
 *
 *   *"What one costs in spirit stones, or null where money is not what buys it.
 *   Null is the whole point and callers must not fall back to `pill.value`: a
 *   barter pill has a value - it is the most valuable thing in the room - and it
 *   still does not have a price."*
 *
 * Every reader of that line faced INWARD. `buy` refuses to quote a figure for a
 * barter-grade pill, the barter verb refuses to haggle over a commodity one, and
 * `whatWouldCloseThisWound` refuses to price a cure money will not buy. Three
 * readers, all asking "can the player BUY this for stones".
 *
 * `lotFor` - the sale side - fell back to `pill.value`, the exact fallback that
 * doc forbids. So a player could cross a negotiation to obtain a heaven-grade
 * pill, type "I sell", and have a counter pay out thousands of stones for a
 * thing that counter would not part with at any price. The line was a wall on
 * one side and a door on the other.
 *
 * Found by the symmetric pass over the repo, whose whole question is which acts
 * are modelled in one direction only.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { getPill } from '../../src/data/cultivation/pills';
import {
    cashRefusalReason,
    pillCashPrice
} from '../../src/engine/cultivation/buying-and-bartering-pills';

function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

/** A grade past the cash line, and one below it, read from the catalog. */
const PAST_THE_LINE = 'pill-nine-turn-restoration';

describe('the rule itself', () => {
    it('gives no price to a thing money does not buy', () => {
        const beyond = getPill(PAST_THE_LINE);
        expect(beyond, PAST_THE_LINE).toBeDefined();
        expect(pillCashPrice(beyond!)).toBeNull();
        expect(cashRefusalReason(beyond!)).not.toBeNull();
        // And it still has a VALUE. That is the distinction the fallback lost.
        expect(beyond!.value).toBeGreaterThan(0);
    });
});

describe('selling something money does not buy', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    /**
     * ADMIN puts the pill in the pouch and settles nothing else. The refusal
     * below came out of the ordinary selling verb.
     */
    it('refuses, and names the door that is open', async () => {
        const { game } = await makeGameInWorld({
            seed: 'cash-line', worldSeed: 'both-ways', adminMode: true
        });
        await game.newRun('Holder');
        await game.act('I look around');
        await game.act(`ADMIN grant_item ${PAST_THE_LINE}`);

        const sold = said(await game.act('I sell the Nine-Turn Restoration Pill'));

        // NOT "you are not carrying it", which is what it used to say about a
        // thing sitting in the pouch, and which names no door at all.
        expect(sold).not.toMatch(/not there|nothing in it anybody would put a price/i);
        // The counter's own sentence, which is the one the BUYING side gives.
        expect(sold).toMatch(/nobody sells one of these for stones/i);
        // `asking.md`: a refusal may only name a door that exists. This one
        // names three media and the verb that reaches them.
        expect(sold).toMatch(/favour owed|art\b/i);
    }, 120000);

    /**
     * AND THE ORDINARY PILL STILL SELLS. The line is a line and not a wall:
     * everything under it is a commodity and moves for stones as it always did.
     */
    it('leaves a commodity where it was', async () => {
        const { game } = await makeGameInWorld({
            seed: 'cash-line', worldSeed: 'commodity', adminMode: true
        });
        await game.newRun('Holder');
        await game.act('I look around');
        await game.act('ADMIN grant_item pill-qi-gathering');

        const sold = said(await game.act('I sell my pills'));
        expect(sold).not.toMatch(/nobody sells one of these for stones/i);
        expect(sold).toMatch(/stones?/i);
    }, 120000);
});
