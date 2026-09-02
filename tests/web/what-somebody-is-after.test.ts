/**
 * WHAT SOMEBODY IS AFTER - THE VERB, THE GATE, AND THE DOORS THE REFUSAL NAMES.
 *
 * `resolveAttempt` has priced a `wants` term since it was written and no caller
 * in the played game ever supplied it, so it read zero in every social attempt
 * any player has ever made. Wiring the term is half the fix; the other half is
 * that the player has a sentence for it, because odds that move for a reason
 * nobody can see are odds nobody can play toward.
 *
 * Measured at the real parser before this existed:
 *
 *   what does Jiang Anyi want         {"action":"unclear"}
 *   what is Jiang Anyi after          {"action":"unclear"}
 *   what is Jiang Anyi looking for    {"action":"unclear"}
 *   ask Jiang Anyi what she wants     talk, topic "she wants"
 *
 * Four phrasings, and not one of them reached the person.
 *
 * Three things are pinned here:
 *
 *   1. THE SENTENCE REACHES THE PERSON, in every phrasing somebody would use.
 *   2. NOTHING NEXT DOOR IS SWALLOWED. Every pattern needs the word that names
 *      the wanting, so the roster questions and `askAround` are untouched.
 *   3. THE REFUSAL NAMES DOORS THAT EXIST. The four acts it advises are put
 *      through `courtesyPaidTo` here, one by one, because the first draft of
 *      the asking refusals named three routes the parser had no branch for.
 */

import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions.js';
import {
    askingWhatSomebodyIsAfter,
    courtesyPaidTo
} from '../../src/web/what-a-request-asks-and-of-whom.js';
import {
    factsForSomebodyWhoWillNotSay,
    factsForSomebodyWithNoOpenBusiness,
    factsForWhatTheyAreAfter
} from '../../src/web/what-somebody-is-after.js';
import type { NpcGoal } from '../../src/engine/world/npc-state.js';
import type { SomebodyWithGoals } from '../../src/engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';

const goal = (over: Partial<NpcGoal> = {}): NpcGoal => ({
    id: 'g1',
    kind: 'cultivation',
    text: 'Advance a rank.',
    priority: 0.55,
    progress: '',
    obstacles: ['Time.'],
    deadlineOnDay: null,
    status: 'active',
    targetId: null,
    openedOnDay: 0,
    closedOnDay: null,
    note: '',
    inheritedFromId: null,
    originHolderId: 'them',
    generation: 0,
    ...over
});

const them: SomebodyWithGoals = {
    id: 'them', ordinal: 6, factionId: null, holds: ['iron-shirt'], goals: [goal()]
};

describe('the sentence reaches the person', () => {
    const phrasings = [
        'what does Jiang Anyi want',
        'what does Jiang Anyi want from me',
        'what is Jiang Anyi after',
        'what is Jiang Anyi looking for',
        'what Jiang Anyi wants',
        'ask Jiang Anyi what she wants',
        'find out what Jiang Anyi is after'
    ];

    it('takes every phrasing somebody would actually use', () => {
        for (const said of phrasings) {
            expect(askingWhatSomebodyIsAfter(said), said).toBe('Jiang Anyi');
        }
    });

    it('reaches the read through the parser, and not a description of it', () => {
        for (const said of phrasings) {
            expect(parseIntent(said), said).toEqual({
                action: 'request', intent: 'wants', target: 'Jiang Anyi'
            });
        }
    });

    it('names nobody where the sentence names nobody', () => {
        for (const said of ['what do I want', 'what does it want', 'what do we want']) {
            expect(askingWhatSomebodyIsAfter(said), said).toBeNull();
        }
    });
});

describe('nothing next door is swallowed', () => {
    // Every one of these used to reach something, and still must. The patterns
    // all require the word that names the wanting, which is what makes that
    // safe - `AGENTS.md` records what the last widening in this area cost.
    it('leaves the sentences beside it exactly where they were', () => {
        for (const said of [
            'what does she know',
            'who can teach me',
            'what can I refine',
            'am I stuck',
            'where can I go',
            'I ask Jiang Anyi to teach me',
            'I buy Jiang Anyi a drink'
        ]) {
            expect(parseIntent(said).intent, said).not.toBe('wants');
        }
    });
});

describe('the refusal names doors that exist', () => {
    it('every act the gate refusal advises is a sentence the parser takes', () => {
        const advised = [
            'I buy Jiang Anyi a drink',
            'I sit with Jiang Anyi',
            'I do Jiang Anyi a small favour',
            'I turn up where Jiang Anyi is'
        ];
        for (const said of advised) {
            const courtesy = courtesyPaidTo(said);
            expect(courtesy, said).not.toBeNull();
            expect(courtesy!.kind, said).toBe('nothing');
            expect(courtesy!.person, said).toBe('Jiang Anyi');
        }
    });

    it('says they have no reason to tell you, and how that changes', () => {
        const facts = factsForSomebodyWhoWillNotSay('Jiang Anyi');
        expect(facts.prose).toContain('drink');
        expect(facts.prose).toContain('turn up where they are');
        expect(facts.headline).toContain('Jiang Anyi');
    });

    it('says an absence is an absence rather than inventing a want', () => {
        expect(factsForSomebodyWithNoOpenBusiness('Jiang Anyi').prose)
            .toContain('nothing they are chasing');
    });
});

describe('what they are after, once they are talking', () => {
    it('says the want in its own words, with what is in the way and how long', () => {
        const facts = factsForWhatTheyAreAfter('Jiang Anyi', them, them.goals[0], null, 365 * 6);
        expect(facts.prose).toContain('Advance a rank.');
        expect(facts.prose).toContain('Time.');
        expect(facts.prose).toContain('6 years');
    });

    it('names what WOULD reach it when nothing the asker holds does', () => {
        const facts = factsForWhatTheyAreAfter('Jiang Anyi', them, them.goals[0], null, 0);
        expect(facts.prose).toContain('A road they have not walked');
        expect(facts.structure.join(' ')).toContain('reads zero');
    });

    it('says the asker is part of it when they are, and says which row said so', () => {
        const facts = factsForWhatTheyAreAfter(
            'Jiang Anyi', them, them.goals[0],
            { goal: them.goals[0], because: 'your_shelf' }, 0
        );
        expect(facts.prose).toContain('carrying a road they have not walked');
        expect(facts.structure.join(' ')).toContain('your_shelf');
    });
});
