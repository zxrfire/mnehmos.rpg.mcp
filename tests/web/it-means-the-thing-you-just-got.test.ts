/**
 * "I buy the manual." "I study it."
 *
 * FOUND BY PLAYING. Turn one bought the Lesser Qi-Gathering Manual and the copy
 * went into the table. Turn two said *"I study it"* and the engine answered:
 *
 *     Unresolved subject "it": no knowledge record and nothing co-located.
 *     Known to this cultivator, or standing here: Bai Wanchen, Handworn Gate,
 *     Han Ciya, The Sitting Stone, Mo Yaozhi, The Swept Gate.
 *
 * It had gone looking for a PLACE or a PERSON called *it*, one turn after
 * handing over the thing.
 *
 * EVERY PART OF THE MACHINERY ALREADY EXISTED, which is what makes this worth a
 * file of its own. `resolvingAgainstTheLastTurn` runs over every plan's target
 * and topic before every verb - one seam, every verb - and `A_BARE_ONE` has
 * listed "it" since it was written. What it resolves against is
 * `namedThisTurn`, and that had exactly three writers, all of them market
 * LISTINGS.
 *
 * So the game could say "the cheaper one" about two books on a stall and could
 * not say "it" about the book it had just sold you. The gap was entirely on the
 * write side: a thing OFFERED was named and a thing HANDED OVER was not.
 *
 * This is a two-turn property. No unit test on either turn can see it.
 */

import { describe, it, expect } from 'vitest';

import { makeGame } from './harness';

describe('a pronoun reaches the thing the last turn handed over', () => {
    it('studies the manual it just bought', async () => {
        const { game, db } = makeGame({ seed: 'it-means-the-manual' });
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare('UPDATE cultivators SET spirit_stones = 400 WHERE id = ?').run(cultivator.id);

        // Read the stall out of the game's own words rather than pinning a
        // title: any name the game prints is a name the game must accept.
        const stall = await game.act('I look for a manual to buy');
        const named = /\b((?:[A-Z][A-Za-z\-]*\s+){1,4}(?:Manual|Scripture|Canon|Sutra))\b/
            .exec(stall.narration)?.[1]?.trim();
        expect(named, stall.narration.slice(0, 300)).toBeTruthy();

        const bought = await game.act(`I buy the ${named}`);
        expect(bought.outcome, bought.narration.slice(0, 200)).not.toBe('refused');

        // AND NOW THE PRONOUN.
        const studied = await game.act('I study it');
        expect(studied.narration).not.toMatch(/Unresolved subject/i);
        // It reached the book rather than a place or a person.
        const log = (studied.state.log ?? [])
            .filter((row: { role: string }) => row.role === 'engine')
            .map((row: { text: string }) => row.text)
            .join(' ');
        expect(`${studied.narration} ${log}`).toContain(named!);
    });

    /**
     * AND IT STILL REFUSES WHEN THERE IS NOTHING TO MEAN.
     *
     * The stop list that produced the original refusal is not a bug and must
     * stay: a bare pronoun scored against a catalog matched inside "B-it-ter
     * Frost Needle" and resolved to it. A pronoun is only ever allowed to mean
     * something the turn before actually named.
     */
    it('says so plainly when the last turn named nothing', async () => {
        const { game } = makeGame({ seed: 'it-means-nothing' });
        await game.newRun('Wen Shu');

        const studied = await game.act('I study it');
        expect(studied.narration + JSON.stringify(studied.state.log ?? []))
            .toMatch(/Unresolved subject|nothing here answers|does not exist/i);
    });
});
