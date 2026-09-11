/**
 * THE ENGINE STATES A FACT. IT DOES NOT SET A MOOD OR FORECAST A DAY.
 *
 * With no narrator configured the engine's own prose IS what the player reads.
 * Measured on fresh runs through the harness, the first two paragraphs a new
 * player ever saw:
 *
 *     Clear River Ford. It is the ground they were raised on. There is nothing
 *     here they would notice, because it is what noticing has always been
 *     measured from.
 *     [...]
 *     The day asks nothing in particular.
 *
 * Both halves are defective in the same direction, and neither fix is ornament.
 * The closer forecasts the day's temper, which the engine has no view on. The
 * ground read writes a character's interiority twice inside a subordinate
 * clause. Cut the mood and the inference and the fact is what is left, which is
 * shorter and more concrete as well as the right genre.
 *
 * WHAT IS BANNED, each row a real sentence off a played turn:
 *
 *     mood or weather closer   "The day asks nothing in particular"
 *                              "It is an ordinary day and it intends to stay one"
 *                              "Nothing is pressing. That will not last"
 *                              "and then it is the weather again"
 *     a hedge that softens     "out of your reach for now"
 *     what the player would
 *     or would not notice      "there is nothing here they would notice"
 *                              "is the part worth noticing"
 *     `It is` / `There is`
 *     as a sentence opener     "It is the ground they were raised on"
 *                              "There is no address on it"
 *                              "It is spoken of as over the draw of 7"
 *
 * The opener ban is on the sentence OPENING only. `it` and `there` mid-sentence
 * are ordinary English and banning them everywhere would be a style rule rather
 * than a defect guard.
 *
 * SIX WORLDS RATHER THAN ONE: what reaches a player is keyed on where they were
 * born and who is standing there, so one seed exercises one square. The set ran
 * red on nine distinct sentences before this.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { QUIET_DAY } from '../../src/web/facts';
import { whatTheyCanTellOfTheGround } from '../../src/engine/cultivation/what-they-can-tell-of-the-ground';

/** The register habits this guard exists for, each with what it costs. */
const BANNED: Array<[RegExp, string]> = [
    [/(?:^|[.!?"]\s+)It is /, 'an `It is` sentence opener'],
    [/(?:^|[.!?"]\s+)There is /, 'a `There is` sentence opener'],
    [/(?:^|[.!?"]\s+)The day /, 'a sentence about the day'],
    [/\bfor now\b/i, 'a `for now` hedge'],
    [/\bat least for the moment\b/i, 'a `for the moment` hedge'],
    [/\bordinary day\b/i, 'the day called ordinary'],
    [/\bit is the weather\b/i, 'closing on the weather'],
    [/\bworth noticing\b/i, 'the engine saying what is worth noticing'],
    [/\bwould (?:not )?notice\b/i, 'the engine saying what the player would notice']
];

/** The sentences a new run actually produces, one per verb a player reaches for. */
const SAID = [
    'I look around', 'who is here', 'I wait', 'what is my rank',
    'I cultivate for a year', 'where can I go', 'what sects are near here',
    'what is for sale here', 'I talk to someone', 'what techniques do I know',
    'how am I doing', 'I gather herbs', 'what do I have',
    'I go into seclusion for a year', 'what duties are there', 'how hurt am I'
];

function offences(text: string, said: string): string[] {
    const found: string[] = [];
    for (const paragraph of text.split(/\n+/)) {
        for (const [pattern, name] of BANNED) {
            const hit = pattern.exec(paragraph);
            if (!hit) continue;
            const at = paragraph.indexOf(hit[0]);
            found.push(`${name}, on "${said}": ...`
                + paragraph.slice(Math.max(0, at - 40), at + 110).replace(/\s+/g, ' '));
        }
    }
    return found;
}

describe('a played turn reads as this world rather than as an English novel', () => {
    for (const seed of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
        it(`no mood, no forecast and no It-is opener in world ${seed}`, async () => {
            const h = await makeGameInWorld({ seed, worldSeed: `weather-${seed}` });
            await h.game.newRun('Probe');

            const leaks: string[] = [];
            for (const said of SAID) {
                let shown = '';
                // A refusal is prose the player reads and is held to the same rule.
                try { shown = String((await h.game.act(said)).narration ?? ''); }
                catch (err) { shown = String(err); }
                leaks.push(...offences(shown, said));
            }

            expect([...new Set(leaks)], leaks.join('\n')).toEqual([]);
        }, 240_000);
    }
});

/**
 * The two sources named in the report, pinned directly.
 *
 * The played arm above is the one that matters and it is also the slow one. A
 * relapse in either of these is the whole defect coming back, so it is worth
 * catching without a world being built first.
 */
describe('the two sentences the opening was built out of', () => {
    it('says a novice has no yardstick without writing what they would notice', () => {
        const NOVICE = 0;
        const answer = whatTheyCanTellOfTheGround('thin', NOVICE, 'thin');

        expect(answer.known).toBe('unknown');
        // The fact is still stated: they were raised on this, so they cannot read it.
        expect(answer.because).toMatch(/raised on ground like this/i);
        expect(offences(answer.because, 'a novice on the ground that raised them')).toEqual([]);
    });

    it('says nothing is wrong without forecasting the day', () => {
        expect(QUIET_DAY.length).toBeGreaterThan(0);
        for (const line of QUIET_DAY) {
            expect(offences(line, 'a quiet day'), line).toEqual([]);
            // A closer that predicts is the same defect wearing a fact's clothes.
            expect(line, line).not.toMatch(/will not last|not yet|intends to/i);
        }
    });
});
