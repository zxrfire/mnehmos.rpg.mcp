/**
 * BUYING IS SELLING.
 *
 *   "buying is selling"
 *   "you give stones for a pill and you give a pill for stones is just bartering"
 *   "it's your stuff for their stuff. really doesn't matter what the stuff is
 *    really... i mean it does cuz each stuff has value"
 *   "it's all bartering, if spirit stones have value. no need to make it bespoke?"
 *
 * One exchange. Which verb it is called is only which half of it the sentence
 * happened to put first, and the engine had been reading that off the
 * VOCABULARY - so `part with` is a selling word and "I part with some stones for
 * a pill" reached the selling path, which is a person buying a pill.
 *
 * ── WHY THE PARSER CANNOT SETTLE IT, AND THE POUCH CAN ────────────────────
 *
 * "I part with some stones for a pill" and "I sell my herbs for stones" are the
 * same sentence shape. Telling them apart on the words means calling stones
 * special, which is the bespoke thing being removed. So the sentence yields
 * BOTH sides - `what-is-being-swapped-for-what.ts` - and the engine asks the one
 * question that settles it: is the thing being handed over something this
 * cultivator is actually carrying?
 *
 * ── WHICH SIDE IS THE PRICE, AND NOT WHAT IS IN THE POUCH ────────────────
 *
 * The first form of this asked whether the thing handed over was in the pouch.
 * The owner named the case that breaks it: BUYING A SECOND COPY OF SOMETHING
 * YOU ALREADY HOLD. Carrying a pill says nothing about which way a pill is
 * moving, so pouch membership cannot decide a direction.
 *
 * The sentence already says it. In "X for Y" the far side is what you want and
 * the near side is what you are paying with. Paying in coin is a purchase,
 * whoever phrased it as selling; wanting coin back is a sale; goods for goods
 * is a barter, and there is no path for that yet, so it is left unresolved
 * rather than resolved wrongly.
 *
 * The owner on why the coin may be named at all: *"the good thing about pricing
 * stuff in stones is the stuff not priced in stones falls naturally"* and
 * *"just don't give it a price"*. One common unit makes the unpriceable fall
 * out of ABSENCE rather than out of a flag.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { namesTheCoin, whatIsBeingSwapped } from '../../src/web/what-is-being-swapped-for-what';

function calls(result: unknown): string {
    return ((result as { toolCalls?: { name: string }[] }).toolCalls ?? [])
        .map(c => c.name).join(' ');
}
function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

describe('which way the goods go', () => {
    /**
     * The two failures the corpus measured, and they are mirror images: a
     * purchase read as a sale because `part with` is a selling word, and a sale
     * read as a purchase because `buyer` is a buying word. Neither is about the
     * verb; both are about which side each thing is on.
     */
    it('reads direction off the goods and not off the verb', () => {
        expect(whatIsBeingSwapped('I part with some stones for a pill'))
            .toEqual({ given: 'stones', got: 'pill' });
        expect(whatIsBeingSwapped('I take the herbs to a buyer'))
            .toEqual({ given: 'herbs', got: null });
        expect(whatIsBeingSwapped('I pick up some food from the stall'))
            .toEqual({ given: null, got: 'food' });
    });

    /** And a swap with no coin in it at all is still a swap. */
    it('reads a barter that names no money', () => {
        expect(whatIsBeingSwapped('I trade my herbs for a pill'))
            .toEqual({ given: 'herbs', got: 'pill' });
        expect(whatIsBeingSwapped('I give him a pill for his sword'))
            .toEqual({ given: 'pill', got: 'sword' });
    });

    /**
     * A destination is not a swap. Without a carrying verb this read "I go to
     * the market with my brother" as parting with a brother.
     */
    it('is not read out of every sentence with a market in it', () => {
        expect(whatIsBeingSwapped('I go to the market with my brother')).toBeNull();
        expect(whatIsBeingSwapped('I look around')).toBeNull();
    });

    it('knows the coin from the goods, in one place', () => {
        expect(namesTheCoin('stones')).toBe(true);
        expect(namesTheCoin('fifty spirit stones')).toBe(true);
        expect(namesTheCoin('a pill')).toBe(false);
        expect(namesTheCoin(null)).toBe(false);
    });
});

describe('the same trade said from either end', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    /**
     * PLAYED. Both sentences enter on the selling verb, and the engine sends
     * one of them to the board and keeps the other.
     *
     * Before this, the first spent the turn on "selling requires having
     * something first" - true, and not what they were doing.
     */
    it('buys when what is handed over is not theirs, and sells when it is', async () => {
        const { game } = await makeGameInWorld({
            seed: 'barter', worldSeed: 'either-end', adminMode: true
        });
        await game.newRun('Trader');
        await game.act('I look around');

        // Handing over stones for a thing: a purchase, whatever verb carried it.
        const bought = await game.act('I part with some stones for a pill');
        expect(calls(bought), said(bought)).toContain('storage.addToPouch');
        expect(said(bought)).toMatch(/pill is in the pouch/i);

        // AND AGAIN, NOW HOLDING ONE. The case that broke the pouch test: a
        // second copy is still a purchase, and must not read as a sale of the
        // pill just bought. It is short of stones now, and says so.
        const again = await game.act('I part with some stones for a pill');
        expect(calls(again), said(again)).not.toContain('engine.resolveHerb');
        expect(said(again)).toMatch(/short|carrying/i);

        // And wanting the COIN back is a sale, so it stays on the selling path
        // and answers honestly about a pouch that has no herbs in it.
        const sold = await game.act('I sell my herbs for stones');
        expect(calls(sold), said(sold)).not.toContain('storage.addToPouch');
        expect(said(sold)).toMatch(/not there|nothing in it|pouch/i);
    }, 120000);
});
