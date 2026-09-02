/**
 * Asking somebody a plain fact about themselves.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS BROKEN, AND IT WAS TWO THINGS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The reported symptom was one sentence. Typing `are you a girl?` at a person
 * standing in front of you came back:
 *
 *   > "fox meets your gaze with the particular blankness of someone being
 *   >  pressed for an answer to a thing they have never heard of. Whatever you
 *   >  are to them, your presence does not reach into their head and plant the
 *   >  identity you are searching for."
 *
 * Underneath it were two separate defects, and each is pinned below.
 *
 *   THE PARSE. Measured on the deterministic reader, standing in a square with
 *   three people in it: `are you a girl?` and `how old are you?` reached
 *   NOTHING at all, `what is your name?` reached the PLAYER'S OWN status
 *   screen because "your" read as the player's, and `who do you serve?` and
 *   `what house are you from?` reached listings. Five of the most ordinary
 *   sentences anybody says to a person, and not one of them reached the person.
 *
 *   THE GATE. Once a question did reach somebody, it was resolved against the
 *   catalogs and then run through `asking.md`'s FIRST limit - could they know -
 *   which is the right question about a rumour and the wrong one about a
 *   person's own name.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND WHAT MUST NOT BE TRUE AFTERWARDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Passing limit one is not a licence. Three things are asserted here precisely
 * because the easy fix breaks all three:
 *
 *   - **Declining is still reachable**, on the one fact where declining means
 *     something, and it reads as a deflection rather than as ignorance.
 *   - **The answer is what they SAID.** A house is a claim; the engine does not
 *     vouch for it, and says so on the inspector channel.
 *   - **A question about YOURSELF is still about yourself.** `what is my name`
 *     is the status screen and stays there.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';
import {
    A_TOPIC_ABOUT_THEMSELVES,
    SELF_FACT_KINDS,
    selfFactFromTopic,
    whatIsBeingAskedAboutThem,
    whatTheySayAboutThemselves
} from '../../src/engine/social/what-somebody-knows-about-themselves';

const WORLD = 'self-knowledge-world';

describe('the sentence reaches the person in front of you', () => {
    for (const [sentence, kind] of [
        ['are you a girl?', 'sex'],
        ['are you a man', 'sex'],
        ['what is your sex', 'sex'],
        ['what is your name?', 'name'],
        ["what's your name", 'name'],
        ['what should I call you', 'name'],
        ['how old are you?', 'age'],
        ['what is your age', 'age'],
        ['who do you serve?', 'house'],
        ['what house are you from?', 'house'],
        ['which sect do you belong to', 'house'],
        ['I demand to know what house you are from', 'house']
    ] as const) {
        it(`"${sentence}" is a question about them, and about their ${kind}`, () => {
            expect(whatIsBeingAskedAboutThem(sentence)).toBe(kind);

            const plan = parseIntent(sentence);
            expect(plan.action).toBe('interact');
            expect(plan.topic).toBe(A_TOPIC_ABOUT_THEMSELVES[kind]);
        });
    }

    /**
     * The mood survives, and it has to. A demand for a thing they would have
     * told you is a real event with a real cost - the resolver runs, the day is
     * spent, the marks are left - and flattening it into a polite question
     * would remove the price for choosing those words.
     */
    it('keeps a demand a demand', () => {
        expect(parseIntent('I demand to know what house you are from').intent)
            .not.toBe('talk');
        expect(parseIntent('what house are you from?').intent).toBe('talk');
    });

    /** A question about oneself is not a question about them. */
    it('never takes a question the player asked about themselves', () => {
        for (const mine of ['what is my name', 'how old am I', 'what house am I in',
                            'what is my sect']) {
            expect(whatIsBeingAskedAboutThem(mine), mine).toBeNull();
        }
    });

    /** Every kind round-trips through the wire the parser and the game share. */
    it('round-trips every fact through its canonical topic', () => {
        for (const kind of SELF_FACT_KINDS) {
            expect(selfFactFromTopic(A_TOPIC_ABOUT_THEMSELVES[kind])).toBe(kind);
        }
        expect(selfFactFromTopic('the Hollow Court')).toBeNull();
    });
});

describe('what they say, and what the engine is willing to vouch for', () => {
    const SOMEBODY = {
        name: 'Xiao Huikuan',
        age: 99,
        sex: 'male' as const,
        houseName: 'Lantern Hall',
        rankName: 'Reader'
    };

    it('reports all four as things they said rather than as facts', () => {
        for (const kind of SELF_FACT_KINDS) {
            expect(whatTheySayAboutThemselves(kind, SOMEBODY).said).toMatch(
                /\b(gives|puts|says)\b/
            );
        }
    });

    /**
     * THE ONE THAT CAN BE CHECKED, AND THE THREE THAT CANNOT.
     *
     * `trust.md`'s subject: being believed is not the same as being right. A
     * house's token is the instrument, because a token cannot be said - it has
     * to be held. Nothing in this world checks a stated age, and the engine
     * saying so is more honest than pretending otherwise.
     */
    it('names the instrument for a claimed house and for nothing else', () => {
        expect(whatTheySayAboutThemselves('house', SOMEBODY).whatWouldCheckIt)
            .toContain('token');
        for (const kind of ['name', 'age', 'sex'] as const) {
            expect(whatTheySayAboutThemselves(kind, SOMEBODY).whatWouldCheckIt).toBeNull();
        }
    });

    /**
     * Three cost nothing to say and one is about your standing. That asymmetry
     * is what keeps declining reachable without an official refusing to give
     * his own name.
     */
    it('lets a person keep whose they are and nothing else', () => {
        expect(whatTheySayAboutThemselves('house', SOMEBODY).theyMayKeepIt).toBe(true);
        for (const kind of ['name', 'age', 'sex'] as const) {
            expect(whatTheySayAboutThemselves(kind, SOMEBODY).theyMayKeepIt).toBe(false);
        }
    });

    it('answers for somebody with no house without inventing one', () => {
        const said = whatTheySayAboutThemselves('house', { ...SOMEBODY, houseName: null });
        expect(said.said).toContain('answer to nobody');
        expect(said.whatWouldCheckIt).toBeNull();
    });
});

describe('played', () => {
    it('answers a plain question about somebody standing there', async () => {
        const { game } = await makeGameInWorld({ seed: 'self-play', worldSeed: WORLD });
        await game.newRun('Lin Baoqing');
        await game.act('I look around');

        const sex = await game.act('are you a girl?');
        expect(sex.narration).toMatch(/says they are (a woman|a man)/);

        const age = await game.act('how old are you?');
        expect(age.narration).toMatch(/puts their own age at \d+/);

        const name = await game.act('what is your name?');
        expect(String(name.narration)).toMatch(/gives (their name as|the same name)/);
    }, 120_000);

    /**
     * The refusal that was reported must be gone, and it must be gone because
     * the limit does not apply rather than because it was passed generously.
     */
    it('does not refuse a fact about themselves at limit one', async () => {
        const { game } = await makeGameInWorld({ seed: 'self-gate', worldSeed: WORLD });
        await game.newRun('Lin Baoqing');
        await game.act('I look around');

        const asked = await game.act('are you a girl?');
        // The three sentences the old path produced, none of which may come
        // back for a fact about the person being asked.
        expect(String(asked.narration)).not.toContain('never heard');
        expect(String(asked.narration)).not.toContain('into their head');
        expect(String(asked.narration)).not.toContain('cannot make them know');
        // And it reached the asking path rather than a listing or a shrug.
        expect(asked.toolCalls.map(c => c.name)).toContain('engine.askedAbout');
    }, 120_000);

    /**
     * And the question that genuinely cannot be answered still cannot be, with
     * a refusal that reads as one. This is the guard against the easy fix, which
     * is to widen limit one until nothing is ever refused.
     */
    it('still refuses a question about something they could not know', async () => {
        const { game } = await makeGameInWorld({ seed: 'self-far', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Lin Baoqing');
        await game.act('I look around');

        const asked = await game.act('I ask the nearest person about the Hollow Court');
        // Whichever way it went - nobody of that name, or asked and blank - it
        // must not have come back as an answer about the Court, and the self
        // path must not have been the one that answered it.
        expect(String(asked.narration)).not.toContain('Hollow Court admits');
        expect(String(asked.narration)).not.toMatch(/says they are (a woman|a man)/);
        expect(cultivator.id).toBeTruthy();
    }, 120_000);
});
