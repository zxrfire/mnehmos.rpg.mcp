/**
 * Three phrasings of one act, and only one of them reached a verb.
 *
 * Measured by `scripts/probe-what-a-refusal-is-still-for.ts` over 744 played
 * turns, from one heading of the corpus - *ruining a crossing somebody else is
 * making*:
 *
 *     "I attack him while he is crossing"    attack, answered 6 / 6
 *     "I break his tribulation"              unclear, refused 6 / 6
 *     "I interfere with her breakthrough"    unclear, refused 6 / 6
 *
 * Twelve turns on the two phrasings a player is likelier to type, and the
 * failing half is the more natural one - which is the case AGENTS.md names as a
 * bug rather than a gap.
 *
 * ── WHAT THE ENGINE ACTUALLY HAS, AND WHAT IT DOES NOT ───────────────────
 *
 * It has the crossing: `readyToStrike` says whether somebody is at a wall and
 * `strikeAtTheWall` resolves it, and `standing-guard.ts` reaches both.
 *
 * It has no interference term. `computeBreakthroughOdds` clamps `protection`
 * into [0, 1] and its own field note forbids a second protection term, so there
 * is no honest way to hand a crossing a penalty. `interfered_with_a_crossing`
 * is a `Wrong` with a producer nowhere in `src/` - only `what-a-threat-
 * promises.ts` reads it, to price PROMISING one.
 *
 * So this pins the reading rather than a new mechanic: reaching into somebody
 * else's crossing is force put on a person who cannot answer, which is what the
 * phrasing that already worked resolves as.
 *
 * ── AND IT MUST NOT EAT THE TWO NEIGHBOURS ───────────────────────────────
 *
 * Standing over a crossing and making your own are both spelled with the same
 * nouns. Both are asserted here, and the crossing word alone must never be
 * enough: "I break through" is the player's own wall.
 */
import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

describe('reaching into somebody else\'s crossing', () => {
    it('is a verb, and the same one the phrasing that worked already reached', () => {
        for (const said of [
            'I break his tribulation',
            'I interfere with her breakthrough',
            'I ruin his breakthrough',
            'I disrupt her tribulation',
            'I interrupt their crossing'
        ]) {
            expect(parseIntent(said).action, said).toBe('attack');
        }
    });

    it('carries whose crossing it was, as somebody the resolver can find', () => {
        expect(parseIntent('I break his tribulation').target).toBe('him');
        expect(parseIntent('I interfere with her breakthrough').target).toBe('her');
        expect(parseIntent('I break Wen Shu\'s tribulation').target).toBe('Wen Shu');
    });

    it('does not take standing over one', () => {
        for (const said of [
            'I stand guard while she crosses',
            'I watch over his breakthrough',
            'I protect her while she attempts it'
        ]) {
            expect(parseIntent(said).action, said).toBe('guard');
        }
    });

    it('does not take the player\'s own wall', () => {
        for (const said of [
            'I break through',
            'I attempt the breakthrough',
            'I break through to the next realm'
        ]) {
            expect(parseIntent(said).action, said).not.toBe('attack');
        }
    });
});
