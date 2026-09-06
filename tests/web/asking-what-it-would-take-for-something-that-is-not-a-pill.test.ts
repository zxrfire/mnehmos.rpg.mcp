/**
 * The barter verb could price everything and ask after one catalog.
 *
 * `whatIsBeingPutDown` has always read four catalogs to decide what an OFFER
 * is worth - `ARTIFACTS.power`, `TECHNIQUES.grade`, the immortal grade ceiling,
 * the pill band - and its own header argues at length that a rated blade must
 * not fall through to the offerer's rung. The other half of the same verb
 * opened with `PILLS.find(...)` and returned null for everything else, so:
 *
 *   ask Ru Yanzhi what she would take for The Hidden Edge
 *   "Nothing by that name that anybody trades. Nothing in the world is called
 *    "Hidden Edge" that a person would barter over."
 *
 * The Hidden Edge is an ordinary power-rated row in `artifacts.ts`. The
 * sentence is a false statement about the catalog, and the same was true of
 * every artifact, every volume and every manual: a player could offer a rated
 * blade at 46 and could not ask for one at all.
 *
 * `AGENTS.md`, "every read runs both ways unless there is a reason it cannot".
 * Here there was none - the arithmetic is the same in both directions, because
 * the question is the same one: how high does this carry whoever ends up with
 * it.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { askingWhatItWouldTake } from '../../src/web/what-a-request-asks-and-of-whom';
import { theThingAskedFor, thisRowIs } from '../../src/web/what-a-holder-would-take-for-it';

describe('what can be asked after', () => {
    /** An object carries whoever holds it to its own rung. That is `power`. */
    it('prices a rated object off the field every rated object carries', () => {
        const edge = theThingAskedFor('The Hidden Edge', null);
        expect(edge?.id).toBe('carried-the-hidden-edge');
        expect(edge?.carriesTo).toBe(46);
        expect(edge?.pastTheCashLine).toBe(true);

        // And the name without its article reaches the same row, because that
        // is how the request reader hands it over.
        expect(theThingAskedFor('Hidden Edge', null)?.id).toBe('carried-the-hidden-edge');
    });

    /** An art carries somebody as far as its grade, which is the pill rule. */
    it('prices a road off its grade', () => {
        const canon = theThingAskedFor('Azure Dew Gathering Canon', null);
        expect(canon?.id).toBe('azure-dew-gathering-canon');
        expect(canon?.carriesTo).toBeGreaterThan(0);
    });

    /**
     * BELOW THE LINE THERE IS A COUNTER. A notched sabre is a KIND rather than
     * an object - `seedArtifacts` does not put a mundane row in the world at
     * all - so it is bought, and the verb says so instead of bargaining.
     */
    it('sends a mundane row to the counter rather than into a negotiation', () => {
        expect(theThingAskedFor('notched sabre', null)?.pastTheCashLine).toBe(false);
    });

    /** And a thing the world does not contain is still nothing. */
    it('still answers nothing for a name no catalog carries', () => {
        expect(theThingAskedFor('a spirit boat made of cheese', null)).toBeNull();
    });

    /**
     * The one possessions table stores three kinds of thing under three
     * conventions. The holder read used to know one of them.
     */
    it('finds a row by the id its own kind is filed under', () => {
        const artifact = { id: 'carried-the-hidden-edge', data: {} } as never;
        const pill = { id: 'obj-1', data: { pillId: 'pill-meridian-rebirth' } } as never;
        expect(thisRowIs(artifact, 'carried-the-hidden-edge')).toBe(true);
        expect(thisRowIs(pill, 'pill-meridian-rebirth')).toBe(true);
        expect(thisRowIs(pill, 'carried-the-hidden-edge')).toBe(false);
    });
});

describe('played, asking a person for something that is not a pill', () => {
    /**
     * The sentence reaches the verb and the verb answers about the object.
     * What it must never do again is deny the catalog.
     */
    it('does not tell the player the world has no such thing', async () => {
        const { game } = await makeGameInWorld({
            seed: 'ask-for-a-blade', worldSeed: 'world-ask-for-a-blade'
        });
        const { cultivator } = await game.newRun('Buyer');
        await game.act('I look around');

        const here = (game as unknown as { present(c: unknown): { name: string }[] })
            .present(cultivator);
        expect(here.length, 'nobody in the opening square to ask').toBeGreaterThan(0);
        const who = here[0]!.name;

        const said = `ask ${who} what they would take for The Long Life Candle`;
        expect(askingWhatItWouldTake(said)?.kind).toBe('terms');

        const answer = await game.act(said);
        const heard = answer.error ?? answer.narration ?? '';
        expect(heard).not.toMatch(/Nothing by that name/i);
        expect(heard).not.toMatch(/Nothing in the world is called/i);
        // It is priced, and the answer is about the object rather than about
        // the parser: either they have one, or the read says who does.
        expect(heard).toMatch(/Long Life Candle/i);
    }, 200_000);
});
