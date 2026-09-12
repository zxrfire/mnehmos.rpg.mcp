/**
 * Asking somebody about a topic that reached nothing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `scripts/probe-what-a-refusal-is-still-for.ts` plays 744 turns across two
 * pinned worlds and three situations. 394 came back refused (53.0%), and 18 of
 * them were `engine.askedAbout/talk`: 12 of `I ask around about work` and 6 of
 * `I ask him about the sect`, both topics that resolve to nothing in the
 * catalogs.
 *
 * Playing those turns showed the cluster is not what the count implied. The
 * person DOES answer - `guesses`, `deflects` and `blank` each produce prose,
 * and the same turn writes `knowledge.learn/name_given` because answering is
 * how a stranger stops being one. What was wrong was two things.
 *
 * ── ONE. THE FLAG DISAGREED WITH THE TURN ────────────────────────────────
 *
 *     ok: answer.reach === 'answers' || answer.reach === 'partial'
 *
 * `ToolCallRecord.ok` is documented as *false when the engine declined to act*.
 * `askedAbout` never declines: it runs three limits and returns one of five
 * reaches, and every one of them is a ruling. So a turn where the person gave
 * a name, the name was recorded, and a proper noun was dropped into the
 * player's world reported on the inspector channel that the ask had not come
 * off. `a-sentence-can-be-more-than-one-call.ts` reads that flag and calls the
 * whole leg `did_not_come_off`, so a sentence that asked and then did something
 * else reported the asking as having failed.
 *
 * `reach` is the fact. `ok` was a second, lossy copy of it that disagreed.
 *
 * ── TWO. WHAT THEY DO HAVE ON THEIR MIND WAS NEVER SAID ──────────────────
 *
 * Asked about something they cannot place, a person turns it onto their own
 * subject. That is what people do, and the world already computes the subject:
 * `whatTheyWouldBeHeardOnAbout` derives it from years against the years a rung
 * buys, the rank worn, a house's mark, and a thing carried that is not theirs.
 * `askAround` never read it.
 *
 * The square already prints that reading, as what you overhear - `company()`
 * has carried it since the preoccupation pass. Walking up to the same person
 * and asking them something could not reach it, so looking at somebody got
 * more out of them than talking to them did. Both channels now derive it in
 * one place, so they cannot disagree about the same person in the same turn.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS ASSERTED, AND WHAT IS DELIBERATELY NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Not asserted: that a deflection teaches anything. It must not. `teaches` and
 * the knowledge writes stay exactly where they were, and the assertions below
 * check that a turn that turned the subject wrote no record of the subject.
 *
 * Not asserted: which reach a given person gives. That is a function of who the
 * world seeded into the square and pinning it would pin the deal rather than
 * the rule.
 */

import { describe, it, expect } from 'vitest';

import { askedAbout } from '../../src/web/asked.js';
import type { Cultivator } from '../../src/schema/cultivation.js';
import type { RosterEntry } from '../../src/storage/repos/cultivator.repo.js';
import { makeGameInWorld } from './harness.js';

/** A player, at the bottom of the ladder, with nothing going for them. */
const asker = {
    id: 'asker',
    name: 'Asker',
    realmOrdinal: 0,
    attributes: { might: 3, insight: 4, fortune: 0, charm: 2 }
} as unknown as Cultivator;

/** Somebody on a house's roll, so they have a position to protect. */
function attached(over: Partial<RosterEntry> = {}): RosterEntry {
    return {
        id: 'asked-1',
        name: 'Shen Qiao',
        realmOrdinal: 2,
        age: 60,
        sex: 'female',
        sectId: 'house-1',
        sectName: 'The Quiet Ford',
        sectRank: 'outer disciple',
        ...over
    } as unknown as RosterEntry;
}

/** Somebody on nobody's roll, who owes no account to anyone. */
function unattached(over: Partial<RosterEntry> = {}): RosterEntry {
    return attached({ id: 'asked-2', name: 'Wei Zhenlin', sectId: null, sectName: null, sectRank: null, ...over });
}

const base = {
    asker,
    subject: null,
    rawTopic: 'work',
    holdsIt: false,
    priorDealings: 0,
    speakerName: 'Shen Qiao'
};

describe('a question that lands on nothing still gets an answer', () => {
    it('says what they turn it onto, when the question reached nothing they can place', () => {
        const onTheirMind = {
            state: 'the years this rung allows, nearly all spent, and no rung gained by them',
            plainly: 'have spent most of the years this rung allows and are still standing at the same wall'
        };

        const withIt = askedAbout({ ...base, asked: attached(), onTheirMind });
        const withoutIt = askedAbout({ ...base, asked: attached(), onTheirMind: null });

        // The engine states the subject they moved to. It does not write the
        // sentence they say about it - which is why the narrator's copy carries
        // the STATE and the copy a player with no narrator reads carries the
        // plain sentence. See `WhatIsOnTheirMind`.
        expect(withIt.lines.join(' ')).toContain(onTheirMind.state);
        expect(withIt.lines.join(' ')).not.toContain(onTheirMind.plainly);
        expect(withIt.linesToThePlayer!.join(' ')).toContain(onTheirMind.plainly);
        expect(withoutIt.lines.join(' ')).not.toContain('still standing at the same wall');
        expect(withoutIt.linesToThePlayer).toBeUndefined();

        // And says on the inspector channel that this is what happened, so a
        // reader can tell a subject-change from an answer.
        expect(withIt.structure.join(' ').toLowerCase()).toContain('their own');
    });

    it('teaches nothing by turning the subject', () => {
        const answer = askedAbout({
            ...base,
            asked: attached(),
            onTheirMind: {
                state: 'a blade in their hands, lent by somebody above them, owed back to them',
                plainly: 'carry a blade somebody above them lent out of their own hands'
            }
        });
        expect(answer.teaches).toBe(false);
    });

    it('does not turn the subject when they answered the question that was asked', () => {
        const subject = {
            kind: 'sect' as const,
            id: 'house-9',
            name: 'The Quiet Ford',
            facts: ['It admits at Qi Condensation.'],
            structure: ['ordinal 4']
        };
        const answer = askedAbout({
            ...base,
            asked: unattached(),
            subject,
            holdsIt: true,
            onTheirMind: {
                state: 'the years this rung allows, nearly all spent, and no rung gained by them',
                plainly: 'have spent most of the years this rung allows and are still standing at the same wall'
            }
        });
        expect(answer.reach).toBe('answers');
        expect(answer.lines.join(' ')).not.toContain('still standing at the same wall');
    });

    it('a played ask that reaches nothing does not report the ask as having failed', async () => {
        const { game } = await makeGameInWorld({
            seed: 'refusal-audit-a-town',
            worldSeed: 'refusal-audit-a'
        });
        await game.newRun('Prober0');

        const turn = await game.act('I ask around about work');
        const ask = turn.toolCalls.find(call => call.name === 'engine.askedAbout');

        // The ask was put and a ruling came back. Which ruling is in `reach`,
        // on the same row, and that is where a reader should have to look.
        expect(ask).toBeDefined();
        expect(ask!.ok).toBe(true);
        expect(ask!.summary).toMatch(/Reach: /);

        // And the person said something. Silence is not the answer here.
        expect(turn.narration.trim().length).toBeGreaterThan(0);
    });
});
