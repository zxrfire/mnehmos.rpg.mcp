/**
 * "I take the second one" bought a sword off a list of jobs.
 *
 * FOUND BY PLAYING BLIND. Two turns, following the game's own lead:
 *
 *     > what jobs are there
 *     There are porters and ferrymen who can earn a living... The innkeeper
 *     fares slightly better... there is work for a scribe or a mortal
 *     physician... The only one who earns a moderate wage is the mortal caravan
 *     guard.
 *
 *     > i take the second one
 *     Cao Ciming takes the payment. Ten spirit stones leave your purse...
 *     The sword is mortal steel, honest and unremarkable.
 *
 * Six trades named in order, and the sentence that points at the second of them
 * bought a weapon.
 *
 * ── THE GAP IS ON THE WRITE SIDE, AND IT HAS BEEN HERE BEFORE ────────────
 *
 * Nothing in the resolver is missing. `standsForSomethingNamedLastTurn` has read
 * ordinals since it was written, `whichOfTheNamedThings` indexes them, and both
 * read `namedThisTurn`. What `namedThisTurn` had was three writers, every one of
 * them a MARKET listing - so "the second one" resolved against a stall the
 * player had walked past two turns earlier rather than the board in front of
 * them.
 *
 * This is the same defect, in the same field, as the one `nameWhatTheyGot` was
 * written for: *the game could say "the cheaper one" about two books on a stall
 * and could not say "it" about the book it had just sold you.* A listing a
 * player can read and cannot point at is data with no action to take, and here
 * it was worse than nothing, because the phrase resolved confidently against
 * something else.
 *
 * ── WHY THE ORDER AND NOT THE WAGE ───────────────────────────────────────
 *
 * Named in the order the tool returned them, which is the order the player read
 * them in; an ordinal means nothing against any other order.
 *
 * The wage is deliberately NOT carried. `ThingNamed.stones` means *spirit stones
 * asked* - it is what `THE_CHEAPER` and `THE_DEARER` compare - and a month's pay
 * put in that field would print as a price the board is not charging, and would
 * make "the cheaper one" pick the worst-paid job on the wall.
 */

import { describe, it, expect } from 'vitest';

import {
    standsForSomethingNamedLastTurn,
    whichOfTheNamedThings
} from '../../src/web/last-turn-memory';
import { ScriptedProvider, makeGameInWorld } from './harness';

describe('the resolver was always ready for this', () => {
    const BOARD = [
        { name: 'Porter' },
        { name: 'Ferryman' },
        { name: 'Innkeeper' },
        { name: 'Caravan Guard' }
    ];

    it('reads an ordinal against what was listed', () => {
        expect(standsForSomethingNamedLastTurn('the second one')).toBe(true);
        expect(whichOfTheNamedThings('the second one', 'i take the second one', BOARD)?.name)
            .toBe('Ferryman');
        expect(whichOfTheNamedThings('the first one', 'i take the first one', BOARD)?.name)
            .toBe('Porter');
        expect(whichOfTheNamedThings('the last one', 'i take the last one', BOARD)?.name)
            .toBe('Caravan Guard');
    });

    /**
     * AND A PRICE COMPARISON FINDS NOTHING, which is why no wage is written
     * into the row. With pay in `stones`, "the cheaper one" would pick the
     * worst-paid line on the wall and hand it over as a bargain.
     */
    it('has no price to compare on a board', () => {
        expect(whichOfTheNamedThings('the cheaper one', 'i take the cheaper one', BOARD))
            .toBeNull();
    });
});

describe('the board writes down what it named', () => {
    /**
     * PLAYED, because the defect was on the write side and a unit test of the
     * resolver would have passed against it all along. Measured at the record
     * the next turn actually reads.
     */
    it('leaves the trades where the next sentence can find them', async () => {
        // The reader is scripted so that the SENTENCE is not what is under
        // test: the played turn handed the phrase straight through in the
        // target, which is the shape the resolver exists for, and the question
        // here is only whether there was anything for it to resolve against.
        const provider = new ScriptedProvider({
            plans: [
                JSON.stringify({ action: 'work', intent: 'board' }),
                JSON.stringify({ action: 'work', target: 'the second one' })
            ],
            narrations: ['The board is read.', 'The moment passes.']
        });
        const { game } = await makeGameInWorld({
            seed: 'board-pointed-at', worldSeed: 'board-world', worldEnabled: true, provider
        });
        await game.newRun('Prober');

        await game.act('what work is there');
        const taken = await game.act('i take the second one');

        const row = taken.toolCalls.find(call => call.name === 'engine.lastTurn');
        expect(row, 'the phrase resolved against nothing, so no reference was recorded')
            .toBeDefined();
        expect(row!.summary).toContain('"the second one" -> "');
        // Against the BOARD and not against a stall the player walked past.
        expect(row!.summary).not.toMatch(/sword|manual|pill/i);
    }, 300000);
});
