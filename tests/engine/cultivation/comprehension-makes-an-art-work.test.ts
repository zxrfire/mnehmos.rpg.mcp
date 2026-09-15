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
 * ── AND THERE IS A CORNER WHERE IT BUYS NOTHING ──────────────────────────
 *
 * The fixture below dodges the spirit-root match on purpose, and the reason it
 * has to is a finding in its own right. Four axes multiply into one technique
 * line against a ceiling of `MAX_TECHNIQUE_FACTOR`, and the product clears it
 * long before any one of them does. Measured on a single root holding an art of
 * its own element: 1.900 at 58% mastery and 1.900 at 100%, 1.900 on a crude
 * copy and 1.900 on the author's own hand, 1.900 with no comprehension and
 * 1.900 with a full Dao of the art's own road. 45.9% of cultivators draw a root
 * paying x2.0 or better.
 *
 * Whether that saturation is right is a balance question and it is open. What
 * is settled, and what the last block here pins, is that the breakdown must SAY
 * the line is against the ceiling - a note itemising four contributions under a
 * number the last three never moved is the engine describing an arithmetic it
 * did not do, and it is what kept this invisible.
 *
 * RED-CHECKED both ways: dropping the ceiling clause from the note fails 1 of
 * the 3 in that block, and appending it unconditionally fails a different 1.
 */

import { describe, it, expect } from 'vitest';
import {
    MAX_TECHNIQUE_FACTOR,
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
 * An art with no element, so the spirit-root match line is out of the way and
 * the technique factor stays under `MAX_TECHNIQUE_FACTOR`. A matched art at
 * full mastery already saturates that clamp, and a saturated line cannot show
 * a difference of any size.
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

describe('the ceiling is visible when the line is standing on it', () => {
    /** A single fire root holding a mastered fire art: the saturating corner. */
    function saturated(overrides: Partial<CombatantInput> = {}): CombatantInput {
        return combatant({
            spiritRoot: 'single_fire',
            technique: swordArt({ element: 'fire' }),
            techniqueMastery: 1,
            ...overrides
        });
    }

    it('reads the same however much of the last three axes is brought', () => {
        // The measurement, as an assertion rather than as a comment. Pin the
        // EQUALITY, not the 1.9: whether the ceiling moves is a balance
        // decision, and this must go on saying the same thing if it does.
        const plain = techniqueFactor(saturated({ insights: [] }));
        const read = techniqueFactor(
            saturated({ insights: [], technique: swordArt({ element: 'fire', quality: 'pristine' }) })
        );
        const walked = techniqueFactor(saturated({ insights: aDaoOf('weapon', 'sword') }));
        const half = techniqueFactor(saturated({ techniqueMastery: 0.75, insights: [] }));
        expect(read).toBe(plain);
        expect(walked).toBe(plain);
        expect(half).toBe(plain);
        expect(plain).toBe(MAX_TECHNIQUE_FACTOR);
    });

    it('says so, rather than listing contributions that did not reach the number', () => {
        const note = assessPower(saturated({ insights: aDaoOf('weapon', 'sword') }), NEUTRAL)
            .factors.find(f => f.source === 'technique')!.note;
        expect(note).toContain('ceiling');
        // And it states the fact once and plainly, which is the whole of what
        // an engine string is allowed to do about it.
        expect(note).toContain('not all of that reaches the number');
    });

    it('stays quiet on every line that is not against it', () => {
        // The case that must not move: nearly every cultivator in the world is
        // under this ceiling, and none of them should be told about it.
        const under = assessPower(combatant({ insights: aDaoOf('weapon', 'sword') }), NEUTRAL)
            .factors.find(f => f.source === 'technique')!;
        expect(under.factor).toBeLessThan(MAX_TECHNIQUE_FACTOR);
        expect(under.note).not.toContain('ceiling');
    });
});
