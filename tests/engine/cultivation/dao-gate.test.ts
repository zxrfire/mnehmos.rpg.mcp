/**
 * The structural gate: pills that cannot carry you, and roads you cannot walk
 * alone.
 *
 * Two mechanisms, one design. Past the early rungs a cultivator needs help they
 * cannot manufacture, and both halves say so in a different currency:
 *
 *   pills   supply raises your ceiling and does not carry you. The higher you
 *           climb the dearer the help and the less it does.
 *   dao     a realm boundary asks for comprehension your own body cannot
 *           supply. Only `own_root` grants the `element` domain; every other
 *           road needs a manual, a teacher, a site, an inheritance or a
 *           house you were let into.
 *
 * Evidence this was needed, from 400 hand-played lives: 94% of deaths land on a
 * boundary rung (137 at 12, 123 at 16, 52 at 20, 31 at 24, 13 at 28, 6 at 32,
 * 8 at 36), and a sect elder dies at the same rungs at the same rates as a
 * rogue. Hard, but not structural - nothing ever asked anybody for anything.
 */

import { describe, it, expect } from 'vitest';
import {
    DAO_GATE_ENFORCED,
    DAO_GATE_FROM_ORDINAL,
    MAX_PILL_MULTIPLIER,
    PILL_GRADE_FACTOR,
    PILL_TOLERANCE_RETENTION,
    ROADS_BESIDES_YOUR_OWN,
    canAttemptBreakthrough,
    computeBreakthroughOdds,
    daoRequirementCurve,
    daoRequirementFor,
    pillBandDecay,
    pillBandOrdinal,
    pillMultiplier,
    pillToleranceDecay,
    roadsWalked
} from '../../../src/engine/cultivation/breakthrough.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    FOUNDATION_ORDINAL,
    LAST_CROSSING_ORDINAL,
    MAX_ORDINAL,
    isRealmBoundary,
    progressRequiredForOrdinal,
    realmForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import { InsightDomainSchema, type Insight } from '../../../src/schema/cultivation.js';
import { makeCultivator } from './fixtures.js';

function insight(domain: Insight['domain'], subject: string): Insight {
    return {
        id: `insight-${domain}-${subject}`,
        domain,
        subject,
        degree: 2,
        provenance: {
            achievementId: `ach-${domain}-${subject}`,
            achievementKind: 'profound_principle',
            onDay: 1,
            account: 'comprehended while this test was being written',
            deepenedBy: []
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// PILLS
// ═══════════════════════════════════════════════════════════════════════════

describe('a pill multiplies and never adds', () => {
    it('descends across the grades, which is the whole inversion', () => {
        // An upper-grade pill is not a bigger lower-grade pill. It is rarer,
        // dearer and buys LESS. Catalogued values ascend 75 -> 750,000 while
        // this descends, and that opposition is the design statement.
        const order = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;
        for (let i = 1; i < order.length; i++) {
            expect(
                PILL_GRADE_FACTOR[order[i]],
                `${order[i]} should give less than ${order[i - 1]}`
            ).toBeLessThan(PILL_GRADE_FACTOR[order[i - 1]]);
        }
        expect(PILL_GRADE_FACTOR.mortal).toBe(MAX_PILL_MULTIPLIER);
    });

    it('is never a penalty and never exceeds the ceiling', () => {
        for (const grade of Object.keys(PILL_GRADE_FACTOR) as (keyof typeof PILL_GRADE_FACTOR)[]) {
            for (const ordinal of [0, 13, 21, 33, 44]) {
                for (const taken of [0, 1, 5, 40]) {
                    const factor = pillMultiplier(
                        { name: 'x', grade, priorPillsTaken: taken }, ordinal
                    );
                    expect(factor).toBeGreaterThanOrEqual(1);
                    expect(factor).toBeLessThanOrEqual(MAX_PILL_MULTIPLIER);
                }
            }
        }
    });

    it('loses effect the further above its own band it is taken', () => {
        // "A pill that is a real edge at Qi Condensation should be close to
        // noise at Tribulation Transcendence."
        const atHome = pillMultiplier({ name: 'x', grade: 'mortal' }, pillBandOrdinal('mortal'));
        const farAbove = pillMultiplier({ name: 'x', grade: 'mortal' }, 44);
        expect(farAbove).toBeLessThan(atHome);
        expect(farAbove - 1).toBeLessThan((atHome - 1) / 4);
        // A curve, not a cutoff: it never actually reaches nothing.
        expect(farAbove).toBeGreaterThan(1);
    });

    it('works in full at or below its own band, so an early pill is not punished', () => {
        expect(pillBandDecay('chaos', 0)).toBe(1);
        expect(pillBandDecay('mortal', pillBandOrdinal('mortal'))).toBe(1);
    });

    it('reads each grade off the ladder rather than a written-down rung', () => {
        // Ascending, and every one of them a realm start.
        const rungs = (['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const)
            .map(pillBandOrdinal);
        for (let i = 1; i < rungs.length; i++) {
            expect(rungs[i]).toBeGreaterThan(rungs[i - 1]);
        }
        expect(rungs[0]).toBe(FOUNDATION_ORDINAL);
    });

    it('decays permanently with every pill already eaten', () => {
        expect(pillToleranceDecay(0)).toBe(1);
        expect(pillToleranceDecay(1)).toBeCloseTo(PILL_TOLERANCE_RETENTION, 10);
        expect(pillToleranceDecay(4)).toBeLessThan(0.25);
        // Which is what makes hoarding one good pill for the one attempt that
        // matters the correct play, and "just take another" stop working.
        expect(pillToleranceDecay(6)).toBeLessThan(0.1);
    });

    it('leaves the last crossing effectively where it was', () => {
        // The number the whole correction was for. 2.0% additively became 37%,
        // which would have sold a player the ascension. It must stay ~2%.
        const atTheTop = makeCultivator({
            realmOrdinal: 44,
            cultivationProgress: progressRequiredForOrdinal(44) ?? 0
        });
        const bare = computeBreakthroughOdds(atTheTop, { ambient: 'normal' });
        const dosed = computeBreakthroughOdds(atTheTop, {
            ambient: 'normal',
            pill: { name: 'Tribulation Guiding Pill', grade: 'chaos' }
        });
        expect(dosed.finalChance).toBeGreaterThan(bare.finalChance);
        // Within a tenth of where it started: a real edge, nowhere near a
        // solution. "Nothing is climbed off either."
        expect(dosed.finalChance).toBeLessThan(bare.finalChance * 1.1);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE ROADS
// ═══════════════════════════════════════════════════════════════════════════

describe('roads besides your own', () => {
    it('counts every domain except the one your own root supplies', () => {
        expect(ROADS_BESIDES_YOUR_OWN).not.toContain('element');
        expect(ROADS_BESIDES_YOUR_OWN.length).toBe(InsightDomainSchema.options.length - 1);
    });

    it('gives a cave-bound cultivator nothing, however many elements they hold', () => {
        // The hole a naive breadth requirement would have left open: a muddled
        // five-element root reaches five comprehensions sitting perfectly still
        // and has still not been anywhere.
        const hermit = (['metal', 'wood', 'water', 'fire', 'earth'] as const)
            .map(element => insight('element', element));
        expect(roadsWalked(hermit)).toBe(0);
    });

    it('counts distinct domains, not depth', () => {
        expect(roadsWalked([
            insight('weapon', 'sword'),
            insight('weapon', 'spear'),
            insight('formation', 'arrays')
        ])).toBe(2);
    });
});

describe('the requirement curve', () => {
    it('asks nothing at all for the first three realms', () => {
        // Qi Condensation, Foundation Establishment and Core Formation are
        // soloable on a root, a book and time. That is what makes the bottom of
        // the ladder a place a nobody can actually walk, and it is why the
        // curve starts where it starts rather than at the Foundation wall.
        for (let ordinal = 0; ordinal < DAO_GATE_FROM_ORDINAL; ordinal++) {
            expect(daoRequirementCurve(ordinal), `ordinal ${ordinal}`).toBe(0);
        }
    });

    it('begins at the Nascent Soul crossing, and asks for exactly one road', () => {
        // You cannot form a nascent soul without a dao. ONE road besides your
        // own, held by somebody who has been up three realms - not a set.
        expect(daoRequirementCurve(DAO_GATE_FROM_ORDINAL)).toBe(1);
        expect(realmForOrdinal(DAO_GATE_FROM_ORDINAL + 1).key).toBe('nascent_soul');
    });

    it('charges the crossing where the attempt is made, not where it lands', () => {
        // The rung that pays is the one they are standing on. Getting this
        // backwards puts the first ask a whole realm too high and the gate
        // never bites at the Nascent Soul wall at all.
        expect(realmForOrdinal(DAO_GATE_FROM_ORDINAL).key).toBe('core_formation');
        expect(daoRequirementCurve(DAO_GATE_FROM_ORDINAL - 1)).toBe(0);
    });

    it('asks only at realm boundaries, so the rungs between walls stay soloable', () => {
        for (let ordinal = FOUNDATION_ORDINAL; ordinal < FALSE_IMMORTAL_ORDINAL; ordinal++) {
            if (!isRealmBoundary(ordinal)) {
                expect(daoRequirementCurve(ordinal), `ordinal ${ordinal}`).toBe(0);
            }
        }
    });

    it('rises one road per realm, and stops one short of every road there is', () => {
        // The requirements go up as you go. Tabulated rather than derived a
        // second time, so a change to the shape has to be restated by hand.
        const expected: Record<number, number> = {
            20: 1,  // into Nascent Soul
            24: 2,  // into Deity Transformation
            28: 3,  // into Void Refinement
            32: 4,  // into Body Integration
            36: 5,  // into Grand Ascension
            40: 6,  // into Tribulation Transcendence
            44: 7   // the last crossing
        };
        for (const [ordinal, roads] of Object.entries(expected)) {
            expect(daoRequirementCurve(Number(ordinal)), `ordinal ${ordinal}`).toBe(roads);
        }
        // Never the complete set: the last crossing must not turn on holding a
        // full house, because `understanding.ts` already prices depth.
        expect(Math.max(...Object.values(expected)))
            .toBeLessThan(ROADS_BESIDES_YOUR_OWN.length);
    });

    it('never decreases with height and never exceeds the roads that exist', () => {
        let previous = 0;
        for (let ordinal = 0; ordinal <= LAST_CROSSING_ORDINAL; ordinal++) {
            const required = daoRequirementCurve(ordinal);
            expect(required).toBeLessThanOrEqual(ROADS_BESIDES_YOUR_OWN.length);
            if (required > 0) {
                expect(required, `ordinal ${ordinal}`).toBeGreaterThanOrEqual(previous);
                previous = required;
            }
        }
    });
});

describe('the gate is wired and deliberately switched off', () => {
    it('enforces nothing anywhere on the ladder today', () => {
        // A HOLD, NOT A DOUBT. The curve is right and wanted; the substrate
        // under it does not exist. A played cultivator has an insight list and
        // `game.ts` now fills it, so the gate would bind a player today. AN NPC
        // RECORD HAS NO INSIGHT LIST AT ALL - the world runs ruins, phenomena,
        // teachers and near-deaths and writes none of them down.
        //
        // So switching it on binds the player and not the world, which is the
        // same one-sided enforcement the wound layer had, in the other
        // direction. Measured twice, independently: 0 of 1,511 living NPCs hold
        // a single road, and at 1,500 years nothing in the world crosses
        // ordinal 28 again. Not thinned - stopped. See DAO_GATE_ENFORCED.
        expect(DAO_GATE_ENFORCED).toBe(false);
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            expect(daoRequirementFor(ordinal), `ordinal ${ordinal}`).toBe(0);
        }
    });

    it('is held by the switch alone, so turning it on is a one-line act', () => {
        // The curve must NOT also be inert. If both were switched off, flipping
        // the switch would be a leap rather than a step, and nothing would have
        // been tested in the meantime.
        expect(daoRequirementCurve(DAO_GATE_FROM_ORDINAL)).toBeGreaterThan(0);
        expect(daoRequirementFor(DAO_GATE_FROM_ORDINAL)).toBe(0);
    });

    it('lets a cultivator with no comprehension at all still cross today', () => {
        const empty = makeCultivator({
            realmOrdinal: 12,
            cultivationProgress: progressRequiredForOrdinal(12) ?? 0,
            insights: []
        });
        expect(canAttemptBreakthrough(empty).eligible).toBe(true);
    });

    it('still reports what the rung would ask and what is held', () => {
        // Wired even while inert, so the web layer can WARN before it refuses.
        const check = canAttemptBreakthrough(makeCultivator({
            realmOrdinal: 12,
            cultivationProgress: progressRequiredForOrdinal(12) ?? 0,
            insights: [insight('weapon', 'sword')]
        }));
        expect(check.daoHeld).toBe(1);
        expect(check).toHaveProperty('daoRequired');
    });

    it('refuses on progress before it would ever refuse on dao', () => {
        // Ordering matters: telling somebody to go and find a teacher while
        // they are still eighty qi-units short is advice about the wrong
        // problem.
        const short = makeCultivator({ realmOrdinal: 12, cultivationProgress: 0, insights: [] });
        expect(canAttemptBreakthrough(short).reason).toBe('insufficient_progress');
    });
});
