/**
 * The spread a grade's effect is drawn from.
 *
 * The design this pins, in the owner's words: **chaos grade is equal to
 * immortal grade but it's got random effects which may be bad, whereas immortal
 * ones are uniformly positive.** So the two are peers in power and differ in
 * one property only - whether the effect was settled when the thing was made or
 * is settled when somebody uses it.
 *
 * Several of these assert an ABSENCE, which is unusual and deliberate:
 *
 *  - that no reliable grade has a spread, because the moment one does, every
 *    consumer that assumed determinism is silently wrong;
 *  - that the record reports no denominator, because the outcome set is open
 *    and "4 of 12 known" is a lie the data cannot support;
 *  - that nothing in the module branches on the word `chaos`.
 */

import { describe, it, expect } from 'vitest';
import {
    GRADE_SPREAD,
    RECORD_CAVEAT,
    drawGradeOutcome,
    isSettledOnUse,
    theRoadTheyWalk,
    whatItDoesToTheSheet,
    whatStandsAgainst,
    whatTheBlastTakesFrom,
    whatTheRecordsSay,
    type SheetForOutcome
} from '../../../src/engine/cultivation/grade-spread.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { GRADE_ORDER, gradeRank } from '../../../src/data/cultivation/techniques.js';
import { pillBandOrdinal } from '../../../src/engine/cultivation/breakthrough.js';
import { OVERCOMES } from '../../../src/engine/cultivation/spirit-roots.js';
import { readFileSync } from 'node:fs';

const SHEET: SheetForOutcome = {
    spiritRoot: 'single_metal',
    insights: [],
    realmOrdinal: 10
};

const ctx = { sourceOrdinal: pillBandOrdinal('chaos') };

/** Every distinct outcome key the chaos spread produces over many draws. */
function drawMany(seed: string, n: number): Map<string, number> {
    const seen = new Map<string, number>();
    for (let i = 0; i < n; i++) {
        const key = drawGradeOutcome('chaos', forStream(seed, 'probe', i)).key;
        seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return seen;
}

describe('grade spread: the two top grades are peers, and only one of them is reliable', () => {
    it('immortal and chaos tie on power', () => {
        expect(gradeRank('chaos')).toBe(gradeRank('immortal'));
        expect(gradeRank('chaos')).toBeGreaterThan(gradeRank('heaven'));
    });

    it('exactly one grade is settled at use, and it is not the reliable one', () => {
        const settled = GRADE_ORDER.filter(isSettledOnUse);
        expect(settled).toEqual(['chaos']);
        // The load-bearing half. An immortal-grade object does what it says
        // every time, and this is where that stops being a claim in prose.
        expect(isSettledOnUse('immortal')).toBe(false);
    });

    it('every reliable grade is a point mass at "it did what it said"', () => {
        for (const grade of GRADE_ORDER) {
            if (isSettledOnUse(grade)) continue;
            const spread = GRADE_SPREAD[grade];
            expect(spread).toHaveLength(1);
            expect(spread[0].potencyMultiplier).toBe(1);
            expect(spread[0].toxicityMultiplier).toBe(1);
        }
    });

    it('a reliable grade draws the same row from every seed', () => {
        for (const seed of ['a', 'b', 'ninety-nine']) {
            expect(drawGradeOutcome('immortal', forStream(seed, 'probe')).key).toBe('as_promised');
        }
    });
});

describe('grade spread: the draw', () => {
    it('is reproducible from the seed, which is the whole determinism promise', () => {
        const once = drawGradeOutcome('chaos', forStream('pinned', 'pill_outcome', 3, 'p'));
        const twice = drawGradeOutcome('chaos', forStream('pinned', 'pill_outcome', 3, 'p'));
        expect(once.key).toBe(twice.key);
    });

    it('reaches every row in the spread, so nothing in the table is unreachable', () => {
        const seen = drawMany('sweep', 4000);
        for (const outcome of GRADE_SPREAD.chaos) {
            expect(seen.get(outcome.key), `${outcome.key} was never drawn`).toBeGreaterThan(0);
        }
    });

    it('does the thing on the tin about half the time, so it is a decision not a trap', () => {
        const seen = drawMany('sweep', 4000);
        const asPromised = (seen.get('as_promised') ?? 0) / 4000;
        // Pooled over four thousand draws, which is enormous next to the claim.
        expect(asPromised).toBeGreaterThan(0.2);
        expect(asPromised).toBeLessThan(0.35);
    });
});

describe('grade spread: the outcomes are not a good/bad axis', () => {
    it('a redrawn root is the same outcome whether it ruins or rescues', () => {
        const row = GRADE_SPREAD.chaos.find(o => o.key === 'root_redrawn')!;
        const rng = forStream('roots', 'probe');

        const fromGood = whatItDoesToTheSheet(row, { ...SHEET, spiritRoot: 'single_fire' }, ctx, rng);
        const fromWorst = whatItDoesToTheSheet(
            row, { ...SHEET, spiritRoot: 'muddled_five_element' }, ctx, rng
        );

        // Same fields set, same accumulation loss, no branch anywhere that
        // could tell a good hand from a bad one. Which of these is a disaster
        // is a fact about the sheet it landed on, and the engine does not have
        // an opinion.
        expect(fromGood.spiritRoot).toBeDefined();
        expect(fromWorst.spiritRoot).toBeDefined();
        expect(fromGood.losesAccumulation).toBe(true);
        expect(fromWorst.losesAccumulation).toBe(true);
    });

    it('the opposing road lands on the element that destroys theirs', () => {
        const row = GRADE_SPREAD.chaos.find(o => o.key === 'opposing_road')!;
        // A single-wood root walks wood. Metal is what overcomes wood.
        const change = whatItDoesToTheSheet(
            row, { ...SHEET, spiritRoot: 'single_wood' }, ctx, forStream('dao', 'probe')
        );
        expect(change.comprehension?.subject).toBe('metal');
        expect(OVERCOMES.metal).toBe('wood');
        expect(change.losesAccumulation).toBe(false);
    });

    it('a mutated root has no opposite, and the gift lands on their own road instead', () => {
        // NOT AN OVERSIGHT TO PAPER OVER. `OVERCOMES` maps lightning and ice to
        // null and neither is a value of anything, so nothing in the cycle
        // stands against a mutation. Inventing an opposite here would be a
        // second elemental system living in an outcome table.
        expect(whatStandsAgainst('lightning')).toBeNull();
        const row = GRADE_SPREAD.chaos.find(o => o.key === 'opposing_road')!;
        const change = whatItDoesToTheSheet(
            row, { ...SHEET, spiritRoot: 'mutated_lightning' }, ctx, forStream('dao', 'probe')
        );
        expect(change.comprehension?.subject).toBe('lightning');
    });

    it('comprehension already held decides the road, ahead of the root', () => {
        const sheet: SheetForOutcome = {
            ...SHEET,
            spiritRoot: 'single_metal',
            insights: [{
                id: 'insight:a:element:water',
                domain: 'element',
                subject: 'water',
                degree: 3,
                provenance: {
                    achievementId: 'a',
                    achievementKind: 'enlightenment',
                    onDay: 1,
                    deepenedBy: [],
                    account: 'test'
                }
            }]
        };
        expect(theRoadTheyWalk(sheet)).toBe('water');
        // Earth overcomes water; metal would have been the answer off the root.
        expect(whatStandsAgainst('water')).toBe('earth');
    });

    it('the bloodline and the beast are one mechanic at two tiers', () => {
        const line = GRADE_SPREAD.chaos.find(o => o.key === 'a_line_begins')!;
        const shape = GRADE_SPREAD.chaos.find(o => o.key === 'the_shape_changes')!;
        const lineChange = whatItDoesToTheSheet(line, SHEET, ctx, forStream('blood', 'a'));
        const shapeChange = whatItDoesToTheSheet(shape, SHEET, ctx, forStream('blood', 'b'));

        expect(lineChange.bloodline?.tier).not.toBe('final');
        expect(shapeChange.bloodline?.tier).toBe('final');
        // Same field, same shape. `final` is not a stronger `latent`; it is the
        // whole thing with the beast form available, which is `abilityAt`'s own
        // rule and is not restated in the outcome table.
        expect(lineChange.bloodline?.speciesId).toBeTruthy();
        expect(shapeChange.bloodline?.speciesId).toBeTruthy();
    });
});

describe('grade spread: the overdraw is a burst you buy and a residue you keep', () => {
    const row = GRADE_SPREAD.chaos.find(o => o.key === 'overdrawn_and_half_mad')!;
    const change = whatItDoesToTheSheet(row, SHEET, ctx, forStream('over', 'probe'));

    it('puts the body several rungs up for a window and leaves one behind', () => {
        expect(change.overdraw!.rungs).toBeGreaterThan(change.overdraw!.residueRungs);
        expect(change.overdraw!.residueRungs).toBeGreaterThan(0);
        expect(change.overdraw!.days).toBeGreaterThan(0);
    });

    it('leaves the rung standing on nothing, in the Unearned Step\'s own word', () => {
        // A rung arrived at with no crossing under it is `incomplete` - the
        // schema's "rushed; part of the structure was never formed". Reusing
        // the constant means the world reads somebody carrying this exactly the
        // way it reads somebody who took a Step.
        expect(change.overdraw!.foundation).toBe('incomplete');
    });

    it('prices the damage in the crossing toll\'s own currency, not a new harm', () => {
        expect(change.overdraw!.bodyCost).toBeGreaterThan(0);
        expect(change.overdraw!.bodyCost).toBeLessThan(1);
    });

    it('costs control during the window, which is a state to show and not a refusal', () => {
        expect(change.overdraw!.halfMad).toBe(true);
    });
});

describe('grade spread: the detonation is the existing one, powered by the object', () => {
    const row = GRADE_SPREAD.chaos.find(o => o.key === 'it_goes_off')!;
    const change = whatItDoesToTheSheet(row, SHEET, ctx, forStream('boom', 'probe'));

    it('reads its power off the object, not off whoever swallowed it', () => {
        // The whole of what "empowered" means. The sheet is at ordinal 10 and
        // the blast is priced from where the pill is pitched, which is why a
        // nobody takes out something a nobody could never touch.
        expect(change.detonation!.poweredFromOrdinal).toBe(ctx.sourceOrdinal);
        expect(change.detonation!.poweredFromOrdinal).toBeGreaterThan(SHEET.realmOrdinal);
    });

    it('kills level with its own power, and falls away against somebody above it', () => {
        const level = whatTheBlastTakesFrom(ctx.sourceOrdinal, ctx.sourceOrdinal);
        const beneath = whatTheBlastTakesFrom(ctx.sourceOrdinal, 0);
        const wellAbove = whatTheBlastTakesFrom(pillBandOrdinal('mortal'), ctx.sourceOrdinal);

        expect(level).toBe(1);
        // Anybody at or under the blast's own weight is finished by it. That is
        // what makes swallowing one in a crowded market a thing somebody did to
        // everybody standing there, and each of them a wrong with a name on it.
        expect(beneath).toBe(1);
        // And it still falls away upward, because nothing here is unanswerable.
        expect(wellAbove).toBeLessThan(level);
        expect(wellAbove).toBeGreaterThan(0);
    });

    it('does not let the taker walk away', () => {
        expect(change.detonation!.theTakerIsGone).toBe(true);
    });
});

describe('grade spread: what the records say', () => {
    it('gives a reliable grade nothing to research', () => {
        const record = whatTheRecordsSay('immortal', 5);
        expect(record.settledWhenMade).toBe(true);
    });

    it('turns up more the deeper the reach, which makes who you ask a real question', () => {
        const village = whatTheRecordsSay('chaos', 1);
        const house = whatTheRecordsSay('chaos', 6);
        expect(house.accounts.length).toBeGreaterThan(village.accounts.length);
        // The commonest outcome surfaces first, which needs no rule: an outcome
        // that happens often is one many people wrote about.
        expect(village.accounts[0].key).toBe('as_promised');
    });

    it('never turns up the outcome nobody was left to report, at any reach', () => {
        const everything = whatTheRecordsSay('chaos', 1000);
        const keys = everything.accounts.map(a => a.key);
        expect(keys).not.toContain('the_shape_changes');
        // ...and the archive is missing it for a reason, not at random.
        expect(GRADE_SPREAD.chaos.find(o => o.key === 'the_shape_changes')!.recordedAs)
            .toBe('unrecorded');
    });

    it('carries the detonation as an event with no settled cause, not as a silence', () => {
        const everything = whatTheRecordsSay('chaos', 1000);
        const blast = everything.accounts.find(a => a.key === 'it_goes_off')!;
        // A clue rather than a hole: the compound going up is the most visible
        // thing on the table and gets written down every time. What is missing
        // is why, and the annal files it under a confident wrong answer.
        expect(blast.standing).toBe('unattributed');
        expect(blast.blamedOn).toBeTruthy();
        expect(blast.account).not.toMatch(/pill|swallow/i);
    });

    it('reports NO denominator, because the set of outcomes is open', () => {
        const record = whatTheRecordsSay('chaos', 3) as Record<string, unknown>;
        // "4 of 12 known" would be a lie the data cannot support - the owner's
        // ruling is that these are non-exhaustive examples, so there is no
        // total to divide by. Anything rendering this must not invent one.
        const forbidden = [
            'total', 'outcomesInTheSpread', 'outcomesEverRecorded',
            'outOf', 'denominator', 'known', 'complete'
        ];
        for (const key of Object.keys(record)) {
            expect(forbidden, `${key} implies a denominator the data cannot support`)
                .not.toContain(key);
        }
        expect(record.caveat).toBe(RECORD_CAVEAT);
    });
});

describe('grade spread: no bespoke branch on the word chaos', () => {
    it('the module never compares a grade to the string', () => {
        // The rule the design owner gave for how a spirit boat breaks, applied
        // here: read the property. A new grade with a spread of its own must
        // get this behaviour for free, and the mechanical check is that no
        // comparison against the literal exists to be edited.
        const source = readFileSync(
            new URL('../../../src/engine/cultivation/grade-spread.ts', import.meta.url),
            'utf8'
        );
        const code = source
            // Strip block and line comments; the header quotes the ruling and
            // says the word many times, correctly.
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/[^\n]*/g, '');
        expect(code).not.toMatch(/===\s*['"]chaos['"]/);
        expect(code).not.toMatch(/['"]chaos['"]\s*===/);
        // The one appearance left is the table key itself, which is the point:
        // the grade is a row, not a condition.
        expect((code.match(/chaos/g) ?? []).length).toBe(1);
    });

    it('the pill catalog and the spread agree about which grades are reliable', () => {
        // `GRADE_SPREAD` is keyed by TechniqueGrade, so a grade added to the
        // schema without a spread will not compile. This asserts the other
        // half: nothing is in the table that is not on the ladder.
        expect(Object.keys(GRADE_SPREAD).sort()).toEqual([...GRADE_ORDER].sort());
    });
});
