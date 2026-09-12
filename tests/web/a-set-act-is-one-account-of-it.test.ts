/**
 * AN ACT AIMED AT TEN PEOPLE IS NOT TEN ACCOUNTS OF IT.
 *
 * A set act runs the same resolver once per member, so when the members are
 * alike the sentences come out identical by construction - which is exactly
 * when a player is most likely to aim at a set. Measured at Void Refinement
 * against a market square of ten, `I attack everyone here` answered with ten
 * paragraphs of sixty words, in which four facts were stated ten times each.
 */

import { describe, expect, it } from 'vitest';
import {
    saidOnceForEverybodyItHappenedTo,
    theAccountOfASetAct,
    whoWasNeverReached
} from '../../src/web/acts-over-a-set';
import { makeGameInWorld } from './harness';

describe('what was the same for all of them, said once', () => {
    it('splits what was true of all of them from what is true of each', () => {
        const account = theAccountOfASetAct([
            { who: 'A', lines: ['Driven off. A is left at 13 of 67.'] },
            { who: 'B', lines: ['Driven off. B is left at 15 of 75.'] }
        ]);
        // `lines` is a list of statements; `prose` wants a paragraph and then
        // the figures. Joined a sentence to a paragraph, an account of one act
        // arrived as twenty one-sentence paragraphs.
        expect(account.forAll).toEqual(['Driven off.']);
        expect(account.theirOwn).toEqual(['A is left at 13 of 67.', 'B is left at 15 of 75.']);
    });

    it('says a sentence every one of them produced exactly once', () => {
        const said = saidOnceForEverybodyItHappenedTo([
            { who: 'Gu Nuohe', lines: ['Driven off. Gu Nuohe is left at 13 of 67.'] },
            { who: 'Cao Ronghe', lines: ['Driven off. Cao Ronghe is left at 15 of 75.'] },
            { who: 'Shen Wanyi', lines: ['Driven off. Shen Wanyi is left at 16 of 80.'] }
        ]);
        expect(said.filter(line => line === 'Driven off.')).toHaveLength(1);
        expect(said).toContain('Gu Nuohe is left at 13 of 67.');
        expect(said).toContain('Shen Wanyi is left at 16 of 80.');
    });

    it('fills the name slot with a SINGULAR phrase, and capitalises it', () => {
        // Every template here was written about one person and carries a
        // singular verb somewhere in it, so a list of names disagrees with the
        // sentence it is dropped into: "A and B IS carrying a wound now."
        const said = saidOnceForEverybodyItHappenedTo([
            { who: 'A', lines: ['A is carrying a wound now.'] },
            { who: 'B', lines: ['B is carrying a wound now.'] }
        ]);
        expect(said).toEqual(['Each of them is carrying a wound now.']);
    });

    it('says `each of them` however many of them there are', () => {
        const many = ['A', 'B', 'C', 'D', 'E'].map(who => ({
            who, lines: [`${who} was driven off.`]
        }));
        expect(saidOnceForEverybodyItHappenedTo(many)).toEqual(['Each of them was driven off.']);
    });

    it('keeps a sentence only one of them produced under their own name', () => {
        const said = saidOnceForEverybodyItHappenedTo([
            { who: 'A', lines: ['A was driven off. A dropped a purse.'] },
            { who: 'B', lines: ['B was driven off.'] }
        ]);
        expect(said).toContain('A dropped a purse.');
        expect(said.filter(line => /driven off/.test(line))).toHaveLength(1);
    });

    it('says who the act never got to, as a sentence rather than a label', () => {
        // "Untouched: Wei Rongya, Bai Wanhe, Cao Jingshi, Kong Fuping, He
        // Lanyi." A colon and a list is how a field is written down.
        expect(whoWasNeverReached(['A'])).toBe('A was never reached');
        expect(whoWasNeverReached(['A', 'B'])).toBe('A and B were never reached');
        // Was `'5 others behind them were never reached'`. A tally of the
        // people standing around is not how this genre says a crowd - see
        // `a-group-is-named-not-counted.ts` for the corpus figures - and the
        // names were already in hand, so the fold costs nothing.
        expect(whoWasNeverReached(['A', 'B', 'C', 'D', 'E']))
            .toBe('A and the others behind them were never reached');
    });

    it('leaves a single member alone', () => {
        expect(saidOnceForEverybodyItHappenedTo([{ who: 'A', lines: ['A was driven off.'] }]))
            .toEqual(['A was driven off.']);
    });
});

describe('played: a square attacked all at once', () => {
    it('does not state the same fact once per person', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'set-fold', worldSeed: 'set-fold', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Reader');
        db.prepare('UPDATE cultivators SET realm_ordinal = 20 WHERE id = ?').run(cultivator.id);
        await game.act('who is here');
        const fight = await game.act('I attack everyone here') as unknown as { narration: string };

        // Whatever the seed put in the square, no sentence in the account is
        // printed more than once. The figures differ per person and are what
        // is left; the shape of the act is stated once.
        const sentences = fight.narration
            .split('\n')
            .flatMap(line => line.split('. '))
            .map(said => said.trim())
            .filter(said => said.length > 20);
        const twice = sentences.filter((said, at) => sentences.indexOf(said) !== at);
        expect([...new Set(twice)], 'a sentence was printed more than once').toEqual([]);
    }, 600_000);
});
