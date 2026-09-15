/**
 * Dao comprehension makes your techniques more effective.
 *
 * THE DEFECT, AS FOUND
 * --------------------
 * `daoGate` refused the top two grades to anybody without the standing, and
 * below those grades comprehension did nothing to an art at all. So a sword
 * saint forty years down the Dao of the Sword and a cultivator who had read the
 * same manual and comprehended nothing threw it at exactly the same weight: the
 * technique line of `assessPower` read mastery, element match against the
 * spirit root, and how well the book was written, and never once asked whether
 * the person swinging understood what the art was about.
 *
 * `techniqueEffectiveness` in `understanding.ts` had been written for this and
 * had NO caller in `src/` - it was reachable only from tests. The comprehension
 * that opens an art was measured and then not spent.
 *
 * WHAT IS PINNED HERE
 * -------------------
 * The same match `daoGate` gates LEARNING on decides how well the art is USED:
 * `daoMatches` is the one predicate and `wieldingWeight` is its second reader.
 * Walking the art's own road is worth x1.15 at a leaning and x1.35 at a Dao,
 * priced against `EDGE_VALUES` - a little under good ground (terrain, x1.3) and
 * nothing like a realm (x4). A road that is not this art's road is worth
 * exactly 1, and so is no standing at all, which is nearly everybody.
 *
 * RED-CHECKED, both ways: dropping `* wielding` from the technique line in
 * `assessPower` fails 2 of the 8; flattening `WIELDING_FACTOR.dao` to 1 fails 4.
 *
 * REACHABLE IN PLAY rather than only from a fixture: `combatantFromCultivator`
 * in `server/consolidated/combat-manage.ts` already passes `cultivator.insights`
 * and the declared art with its `subjects`, so a player who comprehends the road
 * their art is on fights harder with it without anything else being wired.
 *
 * ── THERE WAS A CORNER WHERE IT BOUGHT NOTHING, AND THE CEILING WAS WHY ──
 *
 * The fixture below dodges the spirit-root match on purpose, and the reason it
 * had to is a finding in its own right. Four axes multiply into one technique
 * line and the product cleared a hard ceiling of 1.9 long before any one of
 * them did. Measured on a single root holding an art of its own element:
 * 1.900 at 58% mastery and 1.900 at 100%, 1.900 on a crude copy and 1.900 on
 * the author's own hand, 1.900 with no comprehension and 1.900 with a full Dao
 * of the art's own road. 45.9% of cultivators draw a root paying x2.0 or better.
 *
 * What decided the shape rather than the number: the three axes a person EARNS
 * come to x1.976 on their own, which is already past x1.9 - so at a hard x1.9
 * there was no room for the root match at all, and no value of the constant
 * could have left any. A ceiling that one term alone overruns is not bounding a
 * runaway line, it is deleting whichever terms happen to be counted last.
 *
 * So x1.9 stayed where it is as `TECHNIQUE_FULL_WEIGHT` and stopped being a
 * wall. Below it, identity - nothing that was not already saturated moved, and
 * that is 96.7% of catalog-x-root-x-mastery-x-standing combinations. Above it,
 * an exponential approach to `MAX_TECHNIQUE_FACTOR` = 2.4, which is what a
 * mastered art of a single root's own element already computed to before any
 * book or road, and which is never reached.
 *
 * AFTER, same cultivator, same three axes (before was 1.900 for every row):
 *
 *     mastery  0.75 / 0.90 / 1.00        2.065 / 2.166 / 2.216
 *     book     crude / sound / pristine  2.155 / 2.216 / 2.336
 *     road     none / leaning / Dao      2.216 / 2.310 / 2.366
 *
 * On a real cultivator at ordinal 20 who has done all of it - single root,
 * mastered, the author's own hand, a full Dao, legal attributes, 40 fights -
 * total power goes x145.2 to x182.5, which is +0.26 of a rung. An ordinary peer
 * at the same rung does not move at all. A HARD cap raised to 2.4 would instead
 * have put that cultivator at 2.400 flat with all three axes still dead, so the
 * soft bound is both lower at the corner and the only one that responds.
 *
 * RED-CHECKED: flattening `techniqueWeight` back to a hard clamp at
 * `TECHNIQUE_FULL_WEIGHT` fails 2 of the 5 below - the axes going dead, and the
 * slope jumping at the knee. Dropping the compression clause from the note
 * fails 1; appending it unconditionally fails a different 1.
 */

import { describe, it, expect } from 'vitest';
import {
    MAX_TECHNIQUE_FACTOR,
    TECHNIQUE_FULL_WEIGHT,
    techniqueWeight,
    assessPower,
    type CombatantInput
} from '../../../src/engine/cultivation/combat.js';
import {
    DAO_BREADTH_REQUIRED,
    DAO_DEGREE,
    LEANING_DEGREE,
    WIELDING_FACTOR,
    daoOf,
    wieldingWeight
} from '../../../src/engine/cultivation/dao.js';
import type { Insight, Technique } from '../../../src/schema/cultivation.js';

const NEUTRAL = { ambient: 'normal' as const };

function insight(
    domain: Insight['domain'],
    subject: string,
    degree: Insight['degree']
): Insight {
    return {
        id: `insight-${domain}-${subject}-${degree}`,
        domain,
        subject,
        degree,
        provenance: {
            achievementId: `ach-${domain}-${subject}-${degree}`,
            achievementKind: 'profound_principle',
            onDay: 1,
            account: 'comprehended while this test was being written',
            deepenedBy: []
        }
    };
}

/** Insights that assess as a full Dao of the named subject. */
function aDaoOf(domain: Insight['domain'], subject: string): Insight[] {
    const corroborating: Insight[] = [];
    for (let i = 0; i < DAO_BREADTH_REQUIRED; i++) {
        corroborating.push(insight(domain, `${subject}-corroborating-${i}`, 1));
    }
    return [insight(domain, subject, DAO_DEGREE), ...corroborating];
}

/** Insights that assess as a leaning toward the named subject and no further. */
function aLeaningToward(domain: Insight['domain'], subject: string): Insight[] {
    return [insight(domain, subject, LEANING_DEGREE)];
}

/**
 * An art with no element, so the spirit-root match is out of the way and the
 * technique factor stays under `TECHNIQUE_FULL_WEIGHT`, where the line counts
 * every term at face value. The ratios below are exact there and would be
 * compressed above it; the last block is where the compressed half is measured.
 */
function swordArt(overrides: Partial<Technique> = {}): Technique {
    return {
        id: 'test-sword-art',
        name: 'Test Sword Art',
        category: 'attack',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 0,
        qiCost: 5,
        damage: '2d6',
        mastery: 0.5,
        description: '',
        cooldown: 0,
        subjects: ['sword'],
        requiresPeople: 1,
        runsOn: 'self',
        cap: null,
        quality: 'sound',
        rootGrades: [],
        domain: null,
        domainDegree: 1,
        volumes: null,
        derivable: false,
        opening: null,
        ...overrides
    };
}

function combatant(overrides: Partial<CombatantInput> = {}): CombatantInput {
    return {
        id: 'a',
        name: 'Subject',
        realmOrdinal: 10,
        spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [],
        hp: 100,
        maxHp: 100,
        qi: 50,
        maxQi: 50,
        technique: swordArt(),
        techniqueMastery: 0.5,
        ...overrides
    };
}

function techniqueFactor(input: CombatantInput): number {
    const line = assessPower(input, NEUTRAL).factors.find(f => f.source === 'technique');
    expect(line).toBeDefined();
    return line!.factor;
}

describe('the road decides how well the art lands', () => {
    it('a road that opens the art makes it land harder', () => {
        const blank = techniqueFactor(combatant({ insights: [] }));
        const walked = techniqueFactor(combatant({ insights: aDaoOf('weapon', 'sword') }));
        expect(walked).toBeGreaterThan(blank);
        expect(walked / blank).toBeCloseTo(WIELDING_FACTOR.dao, 5);
    });

    it('a road that is not the road this art is on is worth nothing to it', () => {
        // The whole point of the match. Comprehension is not a second
        // experience bar: a water Dao does not sharpen a sword.
        const blank = techniqueFactor(combatant({ insights: [] }));
        const elsewhere = techniqueFactor(
            combatant({ insights: aDaoOf('element', 'water') })
        );
        expect(elsewhere).toBe(blank);
    });

    it('costs nothing to anybody who has not begun a road', () => {
        // Nearly everybody in the world, so this is the case that must not
        // move: adding the term may not quietly reprice the whole roster.
        expect(daoOf([]).standing).toBe('none');
        expect(wieldingWeight(daoOf([]), swordArt())).toBe(1);
    });

    it('pays a leaning less than a Dao, and both more than nothing', () => {
        const leaning = techniqueFactor(
            combatant({ insights: aLeaningToward('weapon', 'sword') })
        );
        const full = techniqueFactor(combatant({ insights: aDaoOf('weapon', 'sword') }));
        const blank = techniqueFactor(combatant({ insights: [] }));
        expect(blank).toBeLessThan(leaning);
        expect(leaning).toBeLessThan(full);
    });

    it('is worth less than good ground and far less than a rung', () => {
        // Sized deliberately. Comprehension decides which of two cultivators
        // at a height wins; it must never lift anybody past a height.
        expect(WIELDING_FACTOR.none).toBe(1);
        expect(WIELDING_FACTOR.dao).toBeLessThan(1.4);
        expect(WIELDING_FACTOR.leaning).toBeLessThan(WIELDING_FACTOR.dao);
    });

    it('is worth nothing to somebody fighting with no art at all', () => {
        const bare = combatant({ technique: null, insights: aDaoOf('weapon', 'sword') });
        const bareBlank = combatant({ technique: null, insights: [] });
        expect(techniqueFactor(bare)).toBe(techniqueFactor(bareBlank));
        expect(wieldingWeight(daoOf(aDaoOf('weapon', 'sword')), null)).toBe(1);
    });

    it('stays under the ceiling that stops any one line running away with a fight', () => {
        const walked = techniqueFactor(
            combatant({
                insights: aDaoOf('weapon', 'sword'),
                techniqueMastery: 1
            })
        );
        expect(walked).toBeLessThanOrEqual(MAX_TECHNIQUE_FACTOR);
    });

    it('the breakdown says why, so a player can read where the number came from', () => {
        const line = assessPower(
            combatant({ insights: aDaoOf('weapon', 'sword') }),
            NEUTRAL
        ).factors.find(f => f.source === 'technique');
        expect(line!.note).toContain('Dao of the Sword');
        const quiet = assessPower(combatant({ insights: [] }), NEUTRAL)
            .factors.find(f => f.source === 'technique');
        expect(quiet!.note).not.toContain('opens it');
    });
});

describe('the axes go on counting past the point where they used to stop', () => {
    /** A single fire root holding a mastered fire art: the corner that saturated. */
    function corner(overrides: Partial<CombatantInput> = {}): CombatantInput {
        return combatant({
            spiritRoot: 'single_fire',
            technique: swordArt({ element: 'fire' }),
            techniqueMastery: 1,
            ...overrides
        });
    }

    it('moves for each of mastery, the book and the road, with the others maxed', () => {
        // The whole point, and the same measurement that exposed the problem:
        // every one of these three returned an identical number before.
        const plain = techniqueFactor(corner({ insights: [] }));
        const lessMastery = techniqueFactor(corner({ insights: [], techniqueMastery: 0.75 }));
        const betterBook = techniqueFactor(
            corner({ insights: [], technique: swordArt({ element: 'fire', quality: 'pristine' }) })
        );
        const walked = techniqueFactor(corner({ insights: aDaoOf('weapon', 'sword') }));
        expect(lessMastery).toBeLessThan(plain);
        expect(betterBook).toBeGreaterThan(plain);
        expect(walked).toBeGreaterThan(plain);
        // And a leaning still sits between nothing and a Dao up here, which a
        // clamp cannot express at all.
        const leaning = techniqueFactor(corner({ insights: aLeaningToward('weapon', 'sword') }));
        expect(leaning).toBeGreaterThan(plain);
        expect(leaning).toBeLessThan(walked);
    });

    it('is bounded, and the bound is approached rather than taken', () => {
        // Every term at once, on the root that pays most. Nothing reaches the
        // number, which is what makes it safe to have raised it.
        const most = techniqueFactor(
            corner({
                spiritRoot: 'mutated_lightning',
                technique: swordArt({ element: 'lightning', quality: 'pristine' }),
                insights: aDaoOf('weapon', 'sword')
            })
        );
        expect(most).toBeLessThan(MAX_TECHNIQUE_FACTOR);
        // The largest raw the four terms can produce at all, mastered on a
        // mutated root with the author's own hand fully realised and a Dao.
        expect(techniqueWeight(1.2 * 2.5 * 1.22 * 1.35)).toBeLessThan(MAX_TECHNIQUE_FACTOR);
        // And it is a bound rather than only a limit: nothing exceeds it even
        // at inputs no arithmetic in this game produces.
        expect(techniqueWeight(Number.MAX_SAFE_INTEGER)).toBeLessThanOrEqual(MAX_TECHNIQUE_FACTOR);
    });

    it('leaves everything under full weight exactly where it was', () => {
        // 96.7% of combinations are down here and none of them may move. The
        // identity below the knee is what makes this a fix and not a reprice.
        for (const raw of [0.6, 1, 1.35, 1.8, TECHNIQUE_FULL_WEIGHT]) {
            expect(techniqueWeight(raw)).toBe(raw);
        }
        // And it does not jump across the knee - slope 1 on both sides.
        const step = 1e-6;
        const below = (TECHNIQUE_FULL_WEIGHT - techniqueWeight(TECHNIQUE_FULL_WEIGHT - step)) / step;
        const above = (techniqueWeight(TECHNIQUE_FULL_WEIGHT + step) - TECHNIQUE_FULL_WEIGHT) / step;
        expect(above).toBeCloseTo(below, 4);
        // The floor is still read off full weight, so raising the bound did not
        // deepen how bad a half-learned art on a bad copy is allowed to be.
        expect(techniqueWeight(0)).toBeCloseTo(1 / TECHNIQUE_FULL_WEIGHT, 10);
    });

    it('says when the line is being compressed, and what it was before', () => {
        const note = assessPower(corner({ insights: aDaoOf('weapon', 'sword') }), NEUTRAL)
            .factors.find(f => f.source === 'technique')!.note;
        // Stated once, plainly, with both numbers, because a note listing four
        // contributions over a number they did not all reach is the breakdown
        // claiming an arithmetic it did not do.
        expect(note).toContain('counts for less');
        expect(note).toMatch(/a raw x\d+\.\d\d carries as x\d+\.\d\d/);
    });

    it('stays quiet on every line that is not being compressed', () => {
        // Nearly every cultivator in the world is under full weight, and none of
        // them should be told about a rule that is not acting on them.
        const under = assessPower(combatant({ insights: aDaoOf('weapon', 'sword') }), NEUTRAL)
            .factors.find(f => f.source === 'technique')!;
        expect(under.factor).toBeLessThan(TECHNIQUE_FULL_WEIGHT);
        expect(under.note).not.toContain('counts for less');
    });
});
