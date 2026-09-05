/**
 * Design guards on fit, and on the send-off that teaches it.
 *
 * The load-bearing assertion in this file is the one about a MISS being
 * legible. A player holding an excellent manual that does nothing, with no
 * statement of why, has been cheated by the interface rather than by the
 * world - and that is the failure this whole axis is built to avoid.
 */

import { describe, expect, it } from 'vitest';
import {
    assessFit,
    bestFor,
    mayHoldAFit,
    pillPotencyFor,
    readQualityFor,
    PILL_GRADE_FACTOR,
    PILL_HALVING_RUNGS,
    sendOffFor,
    unattachedSignFor,
    type Assessment,
    type Find,
    type Seeker
} from '../../../src/engine/encounters/index.js';
import { requireEncounter } from '../../../src/data/cultivation/encounters.js';

const fireRoot: Seeker = { ordinal: 12, elements: ['fire'], rootGrade: 'single', insights: { sword: 2 } };
const waterRoot: Seeker = { ordinal: 12, elements: ['water'], rootGrade: 'dual' };

const fireManual: Find = {
    id: 'm1', name: 'A fire method', kind: 'manual', gradeOrdinal: 13, elements: ['fire']
};
const waterManual: Find = {
    id: 'm2', name: 'A water method', kind: 'manual', gradeOrdinal: 13, elements: ['water']
};

describe('fit', () => {
    it('matches what somebody draws', () => {
        expect(assessFit(fireManual, fireRoot).fit).toBe('suited');
        expect(assessFit(waterManual, fireRoot).fit).toBe('unsuited');
    });

    it('states plainly that a good thing is not for them', () => {
        const verdict = assessFit(waterManual, fireRoot);
        expect(verdict.fit).toBe('unsuited');
        // Every clause of this sentence is load-bearing. It says the thing is
        // sound, says which axis missed, and says that patience will not fix it.
        expect(verdict.line).toContain('sound');
        expect(verdict.line).toContain('water');
        expect(verdict.line).toContain('fire');
        expect(verdict.line).toMatch(/teach them nothing/u);
    });

    it('never reports a bad fit as merely being too strong', () => {
        // The two are different facts and collapsing them loses the one that
        // matters. A thing at your own rung that does not suit you is the
        // discovery the system exists to deliver.
        const atRung = assessFit({ ...waterManual, gradeOrdinal: 12 }, fireRoot);
        expect(atRung.fit).toBe('unsuited');
        expect(atRung.fit).not.toBe('out_of_reach');

        const farAbove = assessFit({ ...fireManual, gradeOrdinal: 34 }, fireRoot);
        expect(farAbove.fit).toBe('out_of_reach');
    });

    it('separates reach from fit on every verdict', () => {
        const verdict = assessFit(waterManual, fireRoot);
        const reach = verdict.axes.find(a => a.axis === 'reach')!;
        const element = verdict.axes.find(a => a.axis === 'element')!;
        expect(reach.verdict).toBe('match');
        expect(element.verdict).toBe('miss');
    });

    it('says it cannot tell rather than passing an unknown axis', () => {
        const unknownRoot: Seeker = { ordinal: 12 };
        const verdict = assessFit(fireManual, unknownRoot);
        expect(verdict.fit).toBe('partly');
        expect(verdict.axes.find(a => a.axis === 'element')!.verdict).toBe('unknown');
    });

    it('holds comprehension short of a hard miss', () => {
        const needsSword: Find = { ...fireManual, domain: 'sword', domainDegree: 3 };
        // They hold the domain but not to the degree asked. Workable, badly.
        expect(assessFit(needsSword, fireRoot).fit).toBe('partly');
        expect(assessFit({ ...needsSword, domainDegree: 2 }, fireRoot).fit).toBe('suited');
    });

    it('bands a consumable rather than grading it', () => {
        const pill: Find = { id: 'p', name: 'A pill', kind: 'pill', gradeOrdinal: 12, band: 2 };
        expect(assessFit(pill, { ordinal: 13 }).fit).toBe('suited');
        expect(assessFit(pill, { ordinal: 18 }).fit).toBe('unsuited');
        expect(assessFit(pill, { ordinal: 18 }).line).toContain('does nothing');
    });

    it('follows the pill bands the cultivation layer ships', () => {
        // mortal/earth/heaven/immortal/chaos at 1.35/1.25/1.18/1.12/1.08,
        // each halving every eight rungs above its own realm.
        expect(pillPotencyFor('mortal', 10, 10)).toBeCloseTo(1.35, 4);
        expect(pillPotencyFor('mortal', 10, 18)).toBeCloseTo(1.175, 4);
        expect(pillPotencyFor('mortal', 10, 26)).toBeCloseTo(1.0875, 4);
        expect(PILL_GRADE_FACTOR.chaos).toBe(1.08);
        expect(PILL_HALVING_RUNGS).toBe(8);

        // Approaches doing nothing; never goes below it.
        expect(pillPotencyFor('chaos', 0, 44)).toBeGreaterThan(1);
    });

    it('says a cheap pill stops being worth taking rather than stopping working', () => {
        const pill: Find = {
            id: 'p', name: 'A qi-gathering pill', kind: 'pill', gradeOrdinal: 6, grade: 'mortal'
        };
        expect(assessFit(pill, { ordinal: 6 }).fit).toBe('suited');
        expect(assessFit(pill, { ordinal: 8 }).fit).toBe('suited');
        // Eight rungs up, half the excess is gone and it is not worth the dose.
        expect(assessFit(pill, { ordinal: 20 }).fit).toBe('unsuited');
        expect(assessFit(pill, { ordinal: 20 }).line).toContain('does nothing');
        // And the line states the number rather than asserting uselessness.
        expect(assessFit(pill, { ordinal: 20 }).axes.find(a => a.axis === 'band')!.note)
            .toMatch(/against 1/u);
    });

    it('says there is nothing left in a thing they have outgrown', () => {
        expect(assessFit({ ...fireManual, gradeOrdinal: 0 }, { ...fireRoot, ordinal: 30 }).fit)
            .toBe('outgrown');
    });
});

describe('a haul', () => {
    it('is judged by whether any of it was for them, not by what it is worth', () => {
        const haul: Find[] = [
            { id: 'a', name: 'A heaven-grade water method', kind: 'manual', gradeOrdinal: 20, elements: ['water'] },
            { id: 'b', name: 'A plain fire method', kind: 'manual', gradeOrdinal: 11, elements: ['fire'] }
        ];
        const best = bestFor(haul, fireRoot)!;
        // The worse object wins, because it is the one that fits.
        expect(best.find.id).toBe('b');
        expect(best.suitability.fit).toBe('suited');
    });

    it('returns nothing for an empty haul, which is a real result', () => {
        expect(bestFor([], fireRoot)).toBeNull();
    });

    it('prefers something out of reach over something that will never fit', () => {
        const haul: Find[] = [
            { id: 'a', name: 'A water method', kind: 'manual', gradeOrdinal: 12, elements: ['water'] },
            { id: 'b', name: 'A fire method', kind: 'manual', gradeOrdinal: 30, elements: ['fire'] }
        ];
        // One of them may fit later. The other never will.
        expect(bestFor(haul, fireRoot)!.find.id).toBe('b');
    });
});

describe('which rows can hold a fit', () => {
    it('reads the catalog tags rather than a list', () => {
        expect(mayHoldAFit(requireEncounter('enc-manual-in-a-lost-grade').tags)).toBe(true);
        expect(mayHoldAFit(requireEncounter('enc-recovered-recipe-fragment').tags)).toBe(true);
        expect(mayHoldAFit(requireEncounter('enc-inheritance-trial-dead-sect').tags)).toBe(true);
        // A bandit is not holding your destiny.
        expect(mayHoldAFit(requireEncounter('enc-roadside-bandits').tags)).toBe(false);
        expect(mayHoldAFit(requireEncounter('enc-market-day').tags)).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────

function assessment(over: Partial<Assessment> = {}): Assessment {
    return {
        assessorId: 'npc-master',
        assessorName: 'Elder Yun',
        assessorOrdinal: 24,
        studentOrdinal: 12,
        stalled: true,
        ...over
    };
}

describe('the send-off', () => {
    it('does not fire off a bare ordinal', () => {
        // Nobody looked, so nobody says anything. The trigger is an act of
        // assessment by somebody in a position to make one.
        expect(sendOffFor({
            seed: 's', onDay: 100, studentId: 'c1', assessment: null, membership: null
        })).toBeNull();
    });

    it('says nothing when the student is still moving', () => {
        expect(sendOffFor({
            seed: 's', onDay: 100, studentId: 'c1',
            assessment: assessment({ stalled: false, assessorOrdinal: 30 }), membership: null
        })).toBeNull();
    });

    it('grants the direction and never the answer', () => {
        const sent = sendOffFor({
            seed: 's', onDay: 100, studentId: 'c1', assessment: assessment(), membership: null
        })!;
        expect(sent.verdict).toBe('go');
        expect(sent.line).toContain('nothing further for them here');
        expect(sent.line).toContain('No place was named');
        expect(sent.refusable).toBe(true);
    });

    it('is only as good as the assessor', () => {
        // Far above: they see it exactly. At the student's own rung: a guess.
        expect(readQualityFor(assessment({ assessorOrdinal: 30 }))).toBe('exact');
        expect(readQualityFor(assessment({ assessorOrdinal: 13 }))).toBe('partial');
        expect(readQualityFor(assessment({ assessorOrdinal: 10 }))).toBe('guess');
    });

    it('lets a master be wrong, and never lets an exact read be', () => {
        let wrong = 0;
        let exactWrong = 0;
        for (let day = 0; day < 400; day++) {
            const guessed = sendOffFor({
                seed: 'q', onDay: day, studentId: 'c1',
                assessment: assessment({ assessorOrdinal: 11, stalled: false }), membership: null
            });
            if (guessed) wrong++;

            const seen = sendOffFor({
                seed: 'q', onDay: day, studentId: 'c1',
                assessment: assessment({ assessorOrdinal: 30, stalled: false }), membership: null
            });
            if (seen) exactWrong++;
        }
        // A poor teacher sends a student who was doing fine. That costs years,
        // which is the most expensive currency in the game.
        expect(wrong).toBeGreaterThan(0);
        // Somebody far enough above simply sees it.
        expect(exactWrong).toBe(0);
    });

    it('keeps whether the read was right out of what gets narrated', () => {
        const sent = sendOffFor({
            seed: 's', onDay: 7, studentId: 'c1',
            assessment: assessment({ assessorOrdinal: 11 }), membership: null
        });
        if (sent) {
            expect(typeof sent.correct).toBe('boolean');
            // The player finds out by spending years, not by reading a flag.
            expect(sent.line).not.toMatch(/correct|wrong|mistaken/iu);
        }
    });

    it('is deterministic, including the mistake', () => {
        const input = {
            seed: 's', onDay: 55, studentId: 'c1',
            assessment: assessment({ assessorOrdinal: 11 }), membership: null
        };
        expect(sendOffFor(input)).toEqual(sendOffFor(input));
    });
});

describe('nobody watching', () => {
    it('gives an unattached cultivator the same direction, worse', () => {
        const sign = unattachedSignFor({
            seed: 's', onDay: 100, studentId: 'c1', stalled: true, placeName: 'Burnt Earth'
        })!;
        expect(sign.line).toContain('Burnt Earth');
        expect(sign.sourceKind).toBe('inferred');
        expect(sign.refusable).toBe(true);
        // No authority, and nobody to ask a follow-up question of.
        expect(sign.line).toContain('nobody to ask');
    });

    it('offers nothing when there is nothing to notice', () => {
        expect(unattachedSignFor({
            seed: 's', onDay: 100, studentId: 'c1', stalled: false, placeName: 'Burnt Earth'
        })).toBeNull();
    });
});
