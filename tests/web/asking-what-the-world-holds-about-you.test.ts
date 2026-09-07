/**
 * A QUESTION ABOUT THE ASKER IS NOT A QUESTION ABOUT THE GROUND.
 *
 * Measured, six phrasings of the most ordinary question in this setting:
 *
 *     what do people think of me now   ->  the village's crop and its mill
 *     what do they think of me         ->  the same
 *
 * `what do (locals|people|folk|they) (say|think|believe|reckon)` is a good
 * reading of somebody asking after a place, and it says nothing about what is
 * being ASKED about. A player asking after their own name was answered with a
 * rice terrace. The guard is on the branch rather than inside one pattern,
 * because every pattern in that list is a place question that a first-person
 * object turns into a different question.
 *
 * ── THE WORLD'S TALK KEEPS ITS OWN, AND THE GAP IS STATED ────────────────
 *
 * `what do people say about me` stays with `news`, deliberately. `news` is the
 * only reader whose answer moves when the player does something worth
 * repeating - `who-answers-for-a-beast-you-killed.test.ts` uses that exact
 * sentence as the probe for it. Nothing in this game answers "what does the
 * world hold about me" directly: `whatTheWorldHoldsAbout` is the reader for it
 * and is wired for everybody except the player.
 */

import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions';

describe('a question about the asker', () => {
    it('never reaches the ground it is standing on', () => {
        const asTheGround: string[] = [];
        for (const said of [
            'what do people think of me now',
            'what do people think of me',
            'what do they think of me',
            'what do people say about me',
            'what are people saying about me',
            'what have you heard about me',
            'what is my reputation',
            'how am I seen here',
            'how am I regarded'
        ]) {
            const parsed = parseIntent(said) as { action?: string; intent?: string };
            if (parsed.action === 'look' && parsed.intent === 'history') {
                asTheGround.push(said);
            }
        }
        expect(asTheGround, 'a question about the asker was read as a place').toEqual([]);
    });

    it('reads standing where standing is what was asked', () => {
        for (const said of [
            'what do people think of me now',
            'what do people think of me',
            'what is my reputation',
            'how am I seen here',
            'how am I regarded'
        ]) {
            expect(parseIntent(said), said).toMatchObject({ action: 'sect', intent: 'standing' });
        }
    });

    it('leaves the ground and the world their own questions', () => {
        expect(parseIntent('what do people say about the Azure Cloud Pavilion'))
            .toMatchObject({ action: 'news' });
        expect(parseIntent('what do people say')).toMatchObject({ action: 'news' });
        expect(parseIntent('what do the locals say about this place'))
            .toMatchObject({ action: 'look', intent: 'history' });
        expect(parseIntent('what happened here'))
            .toMatchObject({ action: 'look', intent: 'history' });
    });
});
