/**
 * TAKING SOMEBODY'S FACE.
 *
 *   "people should react to an insult, that should exist already"
 *
 * Said in the first hour of the session that built most of this engine, and
 * every part of it did exist except the sentence. Measured on the trope corpus
 * against a live narrator, all six of these came back `unclear`:
 *
 *     I insult him        I mock him          I sneer at him
 *     I spit at his feet  I call him a dog    I laugh in his face
 *
 * Six blank looks on the commonest provocation in the genre. What existed
 * already: `how-they-took-what-you-said.ts` to decide what the hearer made of
 * it, `humiliation` as a grudge cause, the reprisal machinery, and the whole
 * obligation ledger to hold the account. What was missing was a verb, a ninth
 * `Wrong`, and one line in `ATTEMPT_INTENTS`.
 *
 * ── WHY `insulted` IS ITS OWN KIND AND NOT A SYNONYM ──────────────────────
 *
 * `SHAPE_OF` describes a wrong by what is true of it, and an insult is true of
 * things nothing else in the table is: no force is offered, nothing leaves a
 * pouch, no lie is told, no wound is made - and STANDING IS TAKEN ALL THE SAME.
 * Folding it into `threatened` would make the table lie about force. The rule
 * followed is the one `what-a-threat-promises.ts` states: a ninth phrasing needs
 * no code, a ninth KIND of harm is a row in `SHAPE_OF`.
 *
 * It is `canBeGivenBack`, which is the genre being modelled rather than a
 * kindness: face is returned the way it was taken, in public. The owner's own
 * non-exhaustive list of how - *"a public apology or a duel"*, *"a duel if you
 * lose has aura loss lol"*, *"or a sect competition"* - is deliberately NOT
 * encoded as a list of settlement types here. What the shape says is that the
 * account CAN close; which doors the world offers is the world's business.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';
import { shapeOf } from '../../src/engine/social-leverage/what-somebody-does-about-being-wronged';

function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}
function calls(result: unknown): string {
    return ((result as { toolCalls?: { name: string }[] }).toolCalls ?? [])
        .map(c => c.name).join(' ');
}

describe('saying it', () => {
    /** The six that were blank looks, and the sect-facing form beside them. */
    it('reaches a verb', () => {
        for (const sentence of [
            'I insult him',
            'I mock him',
            'I sneer at him',
            'I spit at his feet',
            'I call him a dog',
            'I laugh in his face',
            'I tell him his sect is trash'
        ]) {
            const parsed = parseIntent(sentence);
            expect(parsed.action, sentence).toBe('interact');
            expect(parsed.intent, sentence).toBe('insult');
        }
    });

    /**
     * AND IT DOES NOT EAT ITS NEIGHBOURS. `talk` sits directly under it and is
     * the catch-all; `apologise` is the act that gives face back and must not
     * read as taking it.
     */
    it('leaves the verbs around it alone', () => {
        expect(parseIntent('I talk to him').intent).toBe('talk');
        expect(parseIntent('I greet the man at the gate').intent).toBe('talk');
        expect(parseIntent('I apologise to him').intent).toBe('apologise');
        expect(parseIntent('I call him over').intent).not.toBe('insult');
    });
});

describe('what it is, as a wrong', () => {
    /**
     * The row, read off the table rather than restated. Nothing else in
     * `SHAPE_OF` has this combination, which is why it is its own kind.
     */
    it('takes something without force, and can be given back', () => {
        const shape = shapeOf('insulted');
        expect(shape.force).toBe(false);
        expect(shape.somethingWasTaken).toBe(true);
        expect(shape.canBeGivenBack).toBe(true);
        expect(shape.theySurviveToHoldIt).toBe(true);
        expect(shape.cause).toBe('humiliation');
    });

    /** And it is distinct from the two it could most easily have been folded into. */
    it('is not a threat and is not an interrogation', () => {
        expect(shapeOf('threatened').force).toBe(true);
        expect(shapeOf('interrogated').somethingWasTaken).toBe(false);
        expect(shapeOf('insulted').force).toBe(false);
        expect(shapeOf('insulted').somethingWasTaken).toBe(true);
    });
});

describe('doing it to somebody far above you', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    /**
     * THE IRON PLATE, PLAYED, AND NOBODY WROTE A RULE FOR IT.
     *
     * Insulting somebody who outranks you resolves through the ordinary attempt
     * machine, and what comes back is a reprisal answered in the body. That is
     * not an insult mechanic; it is the reprisal machinery reading a wrong it
     * already knew how to read, off a verb that finally reaches it.
     *
     * Before `insult` was in `ATTEMPT_INTENTS` this ran as a free action: the
     * sentence found the verb, the narrator wrote a scene, and the ledger stayed
     * empty. The turn cost nothing and meant nothing, which is the exact failure
     * mode the trope corpus exists to catch.
     */
    it('costs something, and the account is opened in their name', async () => {
        const { game } = await makeGameInWorld({
            seed: 'insult', worldSeed: 'face', adminMode: true
        });
        await game.newRun('Rude');
        await game.act('I look around');
        await game.act('ADMIN spawn_encounter ordinal=8 name=Wen Shuyi');

        const done = await game.act('I insult Wen Shuyi');
        // It RESOLVED rather than being a free interaction.
        expect(calls(done), said(done)).toContain('engine.resolveAttempt');
        // And it left a record. The ledger is the point of the whole thing.
        expect(calls(done)).toContain('social.createObligation');

        const ledger = said(await game.act('what is held against me'));
        expect(ledger).toMatch(/held against you/i);
        expect(ledger).toContain('Wen Shuyi');
        expect(ledger).toMatch(/humiliation/i);
    }, 120000);
});
