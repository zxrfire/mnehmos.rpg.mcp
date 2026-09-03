/**
 * The pattern table must not send a phrasing to a verb the corpus says it is
 * not.
 *
 * `how-a-player-says-each-verb.ts` is this repository's own statement of what
 * each verb means in a player's words. The pattern table in `actions.ts` is the
 * first reader of those words. When the two disagree, one of them is wrong, and
 * nothing was checking.
 *
 * Measured before this file existed, by running every phrasing in the corpus
 * through `parseIntent`:
 *
 *     corpus 285: right 157, WRONG VERB 28, unclear 100
 *
 * Twenty-eight of the corpus's own sentences reached a DIFFERENT verb - and the
 * tier below the table cannot rescue any of them, because it only ever runs on
 * a sentence the table returned `unclear` for. A confident misroute is final.
 * Three of the twenty-eight cost real time or blood:
 *
 *     treat  "I go for care for what is torn"   -> attack
 *     wait   "I stay put rather than act"       -> gather   (seven days foraging)
 *     ride   "I hire a mount for the road"      -> buy
 *
 * ── WHY `unclear` IS NOT A FAILURE HERE ──────────────────────────────────
 *
 * The bar is deliberately "not somewhere else" rather than "reaches its verb",
 * and `AGENTS.md` is the reason: *a table entry that guesses at context is
 * worse than no entry, because it is confidently wrong in the cases it was
 * reaching for. When a phrasing is ambiguous by nature, the table should leave
 * it alone.* A phrasing the table declines is answered by the tier below it,
 * which is reading against this very file and will reach the verb it came from.
 * A phrasing the table claims for another verb is answered wrongly, forever.
 *
 * So `unclear` passes, and every one of the 104 that reach it is a sentence
 * this file hands to the tier on purpose.
 *
 * ── AND THE DISAGREEMENT RAN BOTH WAYS ───────────────────────────────────
 *
 * Four of the twenty-eight were fixed in the CORPUS, not the table, because the
 * exemplar named a different act than the verb performs. `offer` is the channel
 * through the Lid and three of its exemplars described barter with a person;
 * `investigate` claimed "I study the door for a while", and `the door` is one
 * of `site`'s threshold nouns by design. Both are recorded where they were
 * changed. That direction matters more than it looks: this file is what the
 * model tier compares against, so an exemplar filed under the wrong verb pulls
 * every sentence like it towards a verb that cannot answer them.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent, type ActionName } from '../../src/web/actions';
import {
    readyTheTier,
    verbForASentenceThePatternsMissed
} from '../../src/web/reaching-a-verb-the-pattern-table-has-no-line-for';
import { HOW_A_PLAYER_SAYS_EACH_VERB } from '../../src/web/how-a-player-says-each-verb';

interface Misroute {
    readonly meant: string;
    readonly said: string;
    readonly reached: ActionName;
}

function sweep(): { total: number; right: number; unclear: number; misrouted: Misroute[] } {
    let right = 0;
    let unclear = 0;
    const misrouted: Misroute[] = [];
    for (const [meant, phrasings] of Object.entries(HOW_A_PLAYER_SAYS_EACH_VERB)) {
        for (const said of phrasings as readonly string[]) {
            const reached = parseIntent(said).action;
            if (reached === meant) right++;
            else if (reached === 'unclear') unclear++;
            else misrouted.push({ meant, said, reached });
        }
    }
    return { total: right + unclear + misrouted.length, right, unclear, misrouted };
}

describe('the table against the corpus', () => {
    it('never sends a phrasing to a verb that is not its own', () => {
        const { misrouted } = sweep();
        expect(
            misrouted.map(m => `${m.meant}: "${m.said}" -> ${m.reached}`),
            'a phrasing in how-a-player-says-each-verb.ts reached a different verb. '
            + 'Either the table is wrong, or the exemplar describes an act that verb does not '
            + 'perform - work out which before changing either.'
        ).toEqual([]);
    });

    it('still leaves most of the corpus to the table rather than to the tier', () => {
        // The other direction, and it is worth a bar of its own: the cheapest
        // way to make the test above pass is to stop the table reading
        // anything. The tier is a fallback and costs a model load; the table is
        // what answers a turn instantly, and it should keep answering most of
        // this file.
        const { total, right } = sweep();
        expect(right / total).toBeGreaterThan(0.55);
    });
});

/**
 * The three sentences the sweep found that cost the player something real, and
 * the neighbours each fix had to leave alone.
 *
 * Pinned by hand as well as by the sweep because the sweep asserts a set and
 * these assert the reasons. A future widening that trades one of these for
 * another corpus phrasing keeps the sweep green and fails here with the
 * sentence attached.
 */
describe('the three that cost time or blood', () => {
    it('a wounded player asking for care does not start a fight', () => {
        // `go for` is an attack verb and the attack block sits above every care
        // rule in the table. Played at 20 of 40 health, this returned
        // attack(target="care for what is torn", intent=drive_off).
        expect(parseIntent('I go for care for what is torn').action).toBe('treat');
        // And the neighbour it must not have taken with it.
        expect(parseIntent('I go for the man at the gate').action).toBe('attack');
    });

    it('saying nothing is to be done does not spend a week foraging', () => {
        // Not a table fix at all: the spelling repair rewrote `rather` to
        // `gather`, one edit away, on a sentence the table had correctly
        // declined. See `one-typo-does-not-cost-a-turn.test.ts`.
        expect(parseIntent('I stay put rather than act').action).not.toBe('gather');
        expect(parseIntent('I go out and pick herbs').action).toBe('gather');
    });

    it('hiring a mount is a journey and not a line off the price board', () => {
        expect(parseIntent('I hire a mount for the road').action).toBe('ride');
        // `hire` is a buying verb and has to stay one.
        expect(parseIntent('I hire a scribe').action).toBe('buy');
    });
});

/**
 * The employment branch's practice guard, and its precedence.
 *
 * `if ((A || B || C) && !W)` reads identically to `if (A || B || C && !W)` and
 * means something quite different: without the inner parentheses the guard
 * covers only the last alternative, and both sentences it exists for go through
 * the FIRST. Cheap to pin, and it is the kind of thing that reads correct.
 */
describe('working at a thing is not working for wages', () => {
    it.each([
        ['I work at the mill', 'work'],
        ['I work at the mill for a season', 'work'],
        ['I look for work', 'work'],
        ['is there anything here I can do for pay', 'work'],
        ['I settle in and work at it for a year', 'cultivate'],
        ['I work at the method until it is better', 'train_technique']
    ] as ReadonlyArray<readonly [string, ActionName]>)('%s -> %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });
});

/**
 * THE WHOLE READER AGAINST THE CORPUS, WHICH IS WHAT A PLAYER MEETS.
 *
 * The sweep above measures the TABLE, and its bar is deliberately loose because
 * `unclear` is a legitimate answer there: a phrasing the table declines is
 * answered by the tier below it, and a table entry that guesses at context is
 * worse than no entry.
 *
 * That leaves a hole the aggregate cannot show. Measured per verb, the table
 * answers 194 of 296 - comfortably past its bar - while `roads`, `posture` and
 * `seal` reach NONE of their own five phrasings, and six more reach one. An
 * average hides a verb rotting.
 *
 * Through the whole reader the same corpus answers 294 of 296, so those verbs
 * are not broken: the tier is doing exactly the job the table's looseness
 * assumes. Which means the number worth guarding is this one, not the table's.
 *
 * -- AND IT IS THE ALARM FOR THE TIER GOING MISSING -----------------------
 *
 * The corpus vectors and the model live on disk and can simply be absent. When
 * they are, every phrasing the table declines falls to `unclear`, the reader
 * drops from 99% to 65%, and nothing says so - the failures surface as
 * unrelated verbs behaving oddly on the page, and cost a great deal of time to
 * trace back. This fails loudly instead, and says which of the two it is.
 */
describe('the whole reader against the corpus', () => {
    it('answers almost all of it, and says so plainly when it does not', async () => {
        let tierUp = true;
        try {
            await readyTheTier();
        } catch {
            tierUp = false;
        }

        let right = 0;
        let total = 0;
        for (const [meant, phrasings] of Object.entries(HOW_A_PLAYER_SAYS_EACH_VERB)) {
            for (const said of phrasings as readonly string[]) {
                const fromTable = parseIntent(said);
                let reached = fromTable.action;
                try {
                    reached = (await verbForASentenceThePatternsMissed(said, fromTable)).action;
                } catch {
                    tierUp = false;
                }
                if (reached === meant) right += 1;
                total += 1;
            }
        }

        expect(
            right / total,
            tierUp
                ? 'the reader stopped answering phrasings the corpus lists for its own verbs'
                : 'THE SENTENCE MODEL DID NOT LOAD. Without it the table answers alone and the '
                  + 'corpus drops from about 99% to about 65%, because every phrasing the table '
                  + 'declines falls to `unclear`. Check `models/` before reading anything else '
                  + 'here as a parser fault.'
        ).toBeGreaterThan(0.97);
    }, 300_000);
});
