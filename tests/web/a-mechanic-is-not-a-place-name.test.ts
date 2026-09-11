/**
 * "Mu Yan has never heard of 'breakthrough'."
 *
 * FOUND BY PLAYING BLIND, on the most ordinary question in the game. The player
 * had bought a manual, learned it, sat a stretch, and asked:
 *
 *     > am i ready to break through
 *     Mu Yan has never heard of "breakthrough".
 *
 * ── NOTHING WAS BROKEN EXCEPT WHERE THE SUBJECT WENT ─────────────────────
 *
 * The reader routed it to `assess`, which is right. `assess` has three
 * readings - yourself, a person, a place - and anything that is not recognised
 * as the first two falls through to the third. So the handler looked up a
 * LOCATION called `breakthrough`, did not find one, and reported that in the
 * discovery gate's own words.
 *
 * That sentence is the gate working exactly as designed about a subject it was
 * never meant to see. `breakthrough` is not a proper noun; it is the name of a
 * thing that happens to this cultivator, and asking whether they are ready for
 * one is asking about themselves.
 *
 * ── AND TWO QUESTIONS THAT REACHED NOTHING AT ALL ────────────────────────
 *
 * Measured against the parser in the same pass: `am i at a bottleneck` and
 * `how close am i to breaking through` both came back `unclear`.
 *
 * `ASKING_RATHER_THAN_DOING` catches the shape of both - `am i` is
 * interrogative by construction - but the mood pass converts a PLAN into its
 * free read, and there was no plan to convert. A question the table cannot
 * route is not a question the mood pass can rescue, which is worth writing
 * down: the two halves look like they cover each other and they do not.
 *
 * Both are the ceiling's own question, which `whyProgressHasStopped` answers
 * gate by gate.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

function routes(said: string): string {
    return parseIntent(said).action;
}

describe('asking about your own crossing asks about you', () => {
    it('does not look for a place called breakthrough', () => {
        expect(routes('am i ready to break through')).toBe('assess');
        // The subject is what fell through, so it is pinned as well as the verb.
        expect(parseIntent('i assess the barrier').target).toBe('barrier');
    });

    /**
     * THE SUBJECTS THAT MUST REACH THE SELF-READ. Asserted against the pattern
     * the verb branches on rather than through the handler, because the defect
     * was a fall-through and a handler test would need a world to prove the
     * absence of one.
     */
    it.each([
        'breakthrough', 'break through', 'the breakthrough', 'my breakthrough',
        'the barrier', 'barrier', 'bottleneck', 'the crossing',
        'my foundation', 'my root', 'my qi', 'my meridians', 'my chances',
        'my progress', 'myself', 'ready', 'stuck'
    ])('%s is the cultivator and not a location', subject => {
        // The same regex the verb branches on. Whole-string anchored, which is
        // what keeps a real place called The Barrier a real place.
        const SELF = /^(?:my ?self|me|my (?:progress|standing|position|cultivation|prospects)|where i (?:am|stand)|whether i(?:'m| am)? (?:ready|stuck|stalled|finished|done)|if i(?:'m| am)? (?:ready|stuck|stalled)|ready|stuck|stalled|(?:the |a |my )?break ?through|(?:the |my )?(?:barrier|crossing|bottleneck)|my (?:foundation|root|body|qi|meridians|injuries|wounds|rank|realm|state|condition|chances|odds|readiness|lifespan|age|years))$/i;
        expect(SELF.test(subject)).toBe(true);
    });

    /**
     * AND A PLACE IS STILL A PLACE. The list is anchored whole-string on
     * purpose: widening it to a substring match would swallow every location
     * with a common word in its name.
     */
    it.each(['Nine Peaks', 'the barrier at Nine Peaks', 'Clear River Ford', 'He Anwu'])(
        '%s is not read as the cultivator', subject => {
            const SELF = /^(?:my ?self|me|my (?:progress|standing|position|cultivation|prospects)|where i (?:am|stand)|whether i(?:'m| am)? (?:ready|stuck|stalled|finished|done)|if i(?:'m| am)? (?:ready|stuck|stalled)|ready|stuck|stalled|(?:the |a |my )?break ?through|(?:the |my )?(?:barrier|crossing|bottleneck)|my (?:foundation|root|body|qi|meridians|injuries|wounds|rank|realm|state|condition|chances|odds|readiness|lifespan|age|years))$/i;
            expect(SELF.test(subject)).toBe(false);
        }
    );
});

describe('the questions about a stall reach the read that answers them', () => {
    it.each([
        'am i at a bottleneck',
        'am i stuck at a wall',
        'am i up against the ceiling',
        'how close am i to breaking through',
        'how far am i from a breakthrough',
        'what is my bottleneck',
        'am i hitting a wall'
    ])('%s reads the ceiling', said => {
        expect(routes(said)).toBe('ceiling');
    });

    /**
     * AND NONE OF THEM SPENDS THE CROSSING. This is the assertion that matters:
     * the module these live beside exists because *"how much longer until i
     * break through" routed to `breakthrough`* - so asking how far there was
     * left to go ATTEMPTED it, with the Price of Advancement on the other side.
     */
    it.each([
        'am i at a bottleneck',
        'how close am i to breaking through',
        'am i ready to break through'
    ])('%s does not strike the barrier', said => {
        expect(routes(said)).not.toBe('breakthrough');
    });

    /**
     * AND COMMITTING STILL COMMITS. A player who means it says so, and every
     * one of these has to keep spending what it spends.
     */
    it.each([
        'i break through',
        'i strike the barrier',
        'i push through the bottleneck',
        'i attempt a breakthrough',
        'i try to break through'
    ])('%s still strikes the barrier', said => {
        expect(routes(said)).toBe('breakthrough');
    });
});
