/**
 * An art in no element does not become the wielder's element.
 *
 * THE QUESTION, AS PUT
 * --------------------
 * The design owner ruled that an art naming no road and no element is GENERAL -
 * it asks nothing, so it refuses nobody - and the reason given was that such an
 * art runs off the practitioner's own qi, which does have an element. The
 * learning gates were fixed accordingly (`asksNothingOfTheRoad` and
 * `roadPermits`). It was then asked whether the same sentence means a general
 * art should MATCH the wielder's root and take `matchedTechniqueBonus`.
 *
 * WHAT WAS MEASURED
 * -----------------
 * 73 of 157 catalog rows carry `element: null` - 46.5% of the catalog, not a
 * corner. Among them: 17 of the 42 cultivation canons including the primer
 * everybody starts with, 8 of the 9 forbidden arts, every movement art, and 56
 * rows that name a road while naming no element. 37 of 38 sects teach at least
 * one, across 177 (sect, art) pairs.
 *
 * Reading null as a match would move all 73 at once, by an amount that is a
 * property of the WIELDER rather than of the art: on a mastered art the combat
 * technique line goes x1.200 -> x1.900 for a single or mutated root (+58.3%,
 * and only that low because the clamp eats the rest of a x2.4), x1.560 for a
 * dual, and x1.200 for a muddled root - no change at all. The same page would
 * be worth 58% more to one cultivator and nothing to another for reasons the
 * page has nothing to do with.
 *
 * And the shape does not even survive the trip across the other sites that read
 * the same predicate. Three of them scale by `matchedTechniqueBonus / 2`, where
 * matching is worth x1.0 to a single root and x0.5 to a muddled one, so the
 * same change would leave 40.5% of the population untouched and SLOW 54.0% of
 * it - halving mastery-per-day on the starting primer for the cultivators who
 * already climb slowest.
 *
 * THE RULE PINNED HERE
 * --------------------
 * Admitting everybody is not the same fact as suiting anybody, and that
 * distinction has now been drawn once on each axis. `assessFit` answers a null
 * element with *it asks for no particular element* and admits every root;
 * `roadPermits` admits every road. Neither pays a bonus for it, because
 * `matchedTechniqueBonus` prices how pure a root is AT an element and an art
 * written in none gives that purity nothing to be pure at.
 *
 * What a general art IS sharpened by is the road, which is earned rather than
 * dealt, and `wieldingWeight` already pays it on the 56 elementless rows that
 * name one. That half is asserted here too, so this file cannot be read as the
 * term going inert.
 *
 * RED-CHECKED, one site at a time: relaxing `matched` in `assessPower` to admit
 * a null element fails 4 of the 5 below; relaxing `fromRoot` in
 * `techniqueEffectiveness` the same way fails the catalog sweep, which is the
 * only one that reads it. Both at once fails all 5.
 */

import { describe, it, expect } from 'vitest';

import {
    assessPower,
    type CombatantInput
} from '../../../src/engine/cultivation/combat.js';
import { techniqueEffectiveness } from '../../../src/engine/cultivation/understanding.js';
import { SPIRIT_ROOTS } from '../../../src/engine/cultivation/spirit-roots.js';
import { WIELDING_FACTOR } from '../../../src/engine/cultivation/dao.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';
import type { Insight, Technique } from '../../../src/schema/cultivation.js';

const NEUTRAL = { ambient: 'normal' as const };

function art(overrides: Partial<Technique> = {}): Technique {
    return {
        id: 'test-art',
        name: 'Test Art',
        category: 'attack',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 0,
        qiCost: 5,
        damage: '2d6',
        mastery: 1,
        description: '',
        cooldown: 0,
        subjects: [],
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

function insight(subject: string, degree: Insight['degree']): Insight {
    return {
        id: `insight-weapon-${subject}-${degree}`,
        domain: 'weapon',
        subject,
        degree,
        provenance: {
            achievementId: `ach-weapon-${subject}-${degree}`,
            achievementKind: 'profound_principle',
            onDay: 1,
            account: 'comprehended while this test was being written',
            deepenedBy: []
        }
    };
}

/** Insights that assess as a full Dao of the sword. */
const A_DAO_OF_THE_SWORD: Insight[] = [insight('sword', 4), insight('spear', 1)];

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
        technique: art(),
        techniqueMastery: 1,
        ...overrides
    };
}

function techniqueFactor(input: CombatantInput): number {
    const line = assessPower(input, NEUTRAL).factors.find(f => f.source === 'technique');
    expect(line).toBeDefined();
    return line!.factor;
}

describe('an art in no element is worth the same to every root', () => {
    it('lands identically whatever the wielder was dealt', () => {
        // The whole claim, and the thing that breaks the moment null reads as a
        // match: a single root and a muddled one are 405 and 144 of 999
        // cultivators and the page does not know which one opened it.
        const factors = SPIRIT_ROOTS.map(r =>
            techniqueFactor(combatant({ spiritRoot: r.key }))
        );
        for (const f of factors) expect(f).toBe(factors[0]);
    });

    it('and the root bonus is not inert - an art IN an element still pays it', () => {
        // Without this the block above would pass on a term that had stopped
        // working, which is the failure the equality on its own cannot see.
        const general = techniqueFactor(combatant({ spiritRoot: 'single_fire' }));
        const matched = techniqueFactor(
            combatant({ spiritRoot: 'single_fire', technique: art({ element: 'fire' }) })
        );
        expect(matched).toBeGreaterThan(general);
    });

    it('takes no root bonus anywhere in the real catalog', () => {
        // Swept over the authored rows rather than a fixture, because the size
        // of this set is the argument: it is most of the catalog.
        const elementless = TECHNIQUES.filter(t => t.element === null);
        expect(elementless.length).toBeGreaterThan(TECHNIQUES.length / 3);
        for (const t of elementless) {
            for (const r of SPIRIT_ROOTS) {
                const fit = techniqueEffectiveness({ spiritRoot: r.key }, t);
                expect(fit.fromRoot).toBe(1);
            }
        }
    });

    it('is sharpened by the road instead, which is walked rather than drawn', () => {
        // The half that must not be lost. 56 of the 73 elementless rows name a
        // road, and comprehension of it is what makes the art land harder.
        const onTheSwordRoad = art({ subjects: ['sword'] });
        const blank = techniqueFactor(
            combatant({ technique: onTheSwordRoad, insights: [] })
        );
        const walked = techniqueFactor(
            combatant({ technique: onTheSwordRoad, insights: A_DAO_OF_THE_SWORD })
        );
        expect(walked / blank).toBeCloseTo(WIELDING_FACTOR.dao, 5);
    });

    it('and a road pays the same whatever root walked it', () => {
        // Comprehension is earned, so it must not be priced by talent. If null
        // read as a match this would split by root along with everything else.
        const onTheSwordRoad = art({ subjects: ['sword'] });
        const walked = SPIRIT_ROOTS.map(r =>
            techniqueFactor(
                combatant({
                    spiritRoot: r.key,
                    technique: onTheSwordRoad,
                    insights: A_DAO_OF_THE_SWORD
                })
            )
        );
        for (const f of walked) expect(f).toBe(walked[0]);
    });
});
