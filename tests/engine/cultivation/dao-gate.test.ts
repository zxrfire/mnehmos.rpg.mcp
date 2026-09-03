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
import { gradeRank } from '../../../src/data/cultivation/techniques.js';
import {
    DAO_GATE_ENFORCED,
    DAO_GATE_FROM_ORDINAL,
    MAX_PILL_MULTIPLIER,
    MOST_ROADS_THE_WORLD_SUPPLIES,
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
        // DESCENDING PER BAND, AND LEVEL BETWEEN THE TWO GRADES THAT SHARE
        // ONE. The descent is about where a pill is PITCHED - a pill aimed
        // higher lifts a smaller share, because the odds it is lifting are
        // worse - so it steps only where the pitch steps. Immortal and chaos
        // are peers pitched at the same rung, and a step between them would be
        // chaos being strictly worse at the one thing both grades are for.
        for (let i = 1; i < order.length; i++) {
            const samePitch = pillBandOrdinal(order[i]) === pillBandOrdinal(order[i - 1]);
            if (samePitch) {
                expect(
                    PILL_GRADE_FACTOR[order[i]],
                    `${order[i]} and ${order[i - 1]} share a band and must give the same`
                ).toBe(PILL_GRADE_FACTOR[order[i - 1]]);
                continue;
            }
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
        // Ascending per POWER, and every one of them a realm start. The top
        // two are peers and share a pitch: both grades are for 29 and up, so
        // asserting a step there would be asserting the ordering the peer
        // ruling removed - and it was the last place chaos still outranked
        // immortal after `GRADE_POWER` tied them.
        const order = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;
        const rungs = order.map(pillBandOrdinal);
        for (let i = 1; i < rungs.length; i++) {
            if (gradeRank(order[i]) === gradeRank(order[i - 1])) {
                expect(rungs[i], `${order[i]} and ${order[i - 1]} are peers`)
                    .toBe(rungs[i - 1]);
                continue;
            }
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

    it('rises one road per realm, and stops at what the world can supply', () => {
        // The requirements go up as you go. Tabulated rather than derived a
        // second time, so a change to the shape has to be restated by hand.
        const expected: Record<number, number> = {
            20: 1,  // into Nascent Soul
            24: 2,  // into Deity Transformation
            28: 3,  // into Void Refinement
            32: 4,  // into Body Integration
            36: 5,  // into Grand Ascension
            40: 5,  // into Tribulation Transcendence - the cap bites here
            44: 5   // the last crossing
        };
        for (const [ordinal, roads] of Object.entries(expected)) {
            expect(daoRequirementCurve(Number(ordinal)), `ordinal ${ordinal}`).toBe(roads);
        }
        // The top used to read 6 and 7, on the reasoning that the curve should
        // stop one short of every road that EXISTS. It was measured instead:
        // with the world's comprehension supply live, three seeds at 1,500
        // years, nobody in any band on any seed holds 7, and 6 is held by an
        // eighth to two fifths of the people who get that high. A requirement
        // of 7 was not a hard gate, it was a rung nobody could attempt again.
        //
        // The number of domains the schema defines is a fact about the schema.
        // Only what the world can put in somebody's reach may bound this.
        expect(Math.max(...Object.values(expected))).toBe(MOST_ROADS_THE_WORLD_SUPPLIES);
        expect(MOST_ROADS_THE_WORLD_SUPPLIES).toBeLessThan(ROADS_BESIDES_YOUR_OWN.length);
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

describe('the gate is live', () => {
    it('charges exactly the curve, at every rung', () => {
        // IT WAS HELD OFF, AND WHAT IT WAS WAITING FOR NOW EXISTS. The hold was
        // never a doubt about the curve: an NPC record had no insight list, the
        // world ran ruins, phenomena, teachers and near-deaths and wrote none of
        // them down, so switching this on bound the player and not the world -
        // the same one-sided enforcement the wound layer had, running the other
        // way. Measured then: 0 of 1,511 living NPCs held a single road, and at
        // 1,500 years nothing crossed ordinal 28 again.
        //
        // The supply is `engine/world/how-a-cultivator-comes-by-a-road.ts`:
        // named ground a house lets you onto by standing, ground a province
        // leaves standing open, ruins dug out on the world's own clock, and
        // single-use materials spent once and gone. Re-measured with it live,
        // three seeds at 1,500 years, the Void band holds a mean 4.5 roads
        // against a requirement of 4 and is 87% arrivals rather than survivors.
        expect(DAO_GATE_ENFORCED).toBe(true);
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            expect(daoRequirementFor(ordinal), `ordinal ${ordinal}`)
                .toBe(daoRequirementCurve(ordinal));
        }
    });

    it('asks nothing at all below the Nascent Soul crossing', () => {
        // Three whole realms on a root, a book and time. This is what keeps the
        // bottom of the ladder soloable and what makes the first three realms
        // the ones a nobody can actually walk.
        for (let ordinal = 0; ordinal < DAO_GATE_FROM_ORDINAL; ordinal++) {
            expect(daoRequirementFor(ordinal), `ordinal ${ordinal}`).toBe(0);
        }
        expect(daoRequirementFor(DAO_GATE_FROM_ORDINAL)).toBeGreaterThan(0);
    });

    it('never asks for more roads than the world was measured to supply', () => {
        // The cap is a claim about what sects, provinces, ruins and single-use
        // objects can put in one person's reach, NOT about how many domains the
        // schema happens to define. It was the latter, at 8, and nobody in any
        // measured world ever held 7 - so the top of the curve was a rung that
        // could never be attempted again rather than a gate.
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            expect(daoRequirementCurve(ordinal), `ordinal ${ordinal}`)
                .toBeLessThanOrEqual(MOST_ROADS_THE_WORLD_SUPPLIES);
        }
        expect(MOST_ROADS_THE_WORLD_SUPPLIES).toBeLessThan(ROADS_BESIDES_YOUR_OWN.length);
    });

    it('lets a cultivator with no comprehension at all cross the early walls', () => {
        const empty = makeCultivator({
            realmOrdinal: 12,
            cultivationProgress: progressRequiredForOrdinal(12) ?? 0,
            insights: []
        });
        expect(canAttemptBreakthrough(empty).eligible).toBe(true);
    });

    it('refuses the Nascent Soul crossing to somebody who has walked no road', () => {
        // You cannot form a nascent soul without a dao. This is that sentence,
        // and it is the first moment in a run where sitting in a cave stops
        // being a complete strategy.
        const alone = makeCultivator({
            realmOrdinal: DAO_GATE_FROM_ORDINAL,
            cultivationProgress: progressRequiredForOrdinal(DAO_GATE_FROM_ORDINAL) ?? 0,
            insights: []
        });
        const check = canAttemptBreakthrough(alone);
        expect(check.eligible).toBe(false);
        expect(check.reason).toBe('insufficient_dao');

        // And one road besides their own opens it. Not a set - one.
        const taught = makeCultivator({
            realmOrdinal: DAO_GATE_FROM_ORDINAL,
            cultivationProgress: progressRequiredForOrdinal(DAO_GATE_FROM_ORDINAL) ?? 0,
            insights: [insight('weapon', 'sword')]
        });
        expect(canAttemptBreakthrough(taught).eligible).toBe(true);
    });

    it('does not count the one road a root supplies unaided', () => {
        // A muddled five-element root reaches five `element` insights and has
        // still got nowhere out of its own body. That is the hole a naive
        // breadth requirement would have left open.
        const rooted = makeCultivator({
            realmOrdinal: DAO_GATE_FROM_ORDINAL,
            cultivationProgress: progressRequiredForOrdinal(DAO_GATE_FROM_ORDINAL) ?? 0,
            insights: [insight('element', 'fire'), insight('element', 'water')]
        });
        expect(canAttemptBreakthrough(rooted).daoHeld).toBe(0);
        expect(canAttemptBreakthrough(rooted).reason).toBe('insufficient_dao');
    });

    it('still reports what the rung asks and what is held', () => {
        const check = canAttemptBreakthrough(makeCultivator({
            realmOrdinal: 12,
            cultivationProgress: progressRequiredForOrdinal(12) ?? 0,
            insights: [insight('weapon', 'sword')]
        }));
        expect(check.daoHeld).toBe(1);
        expect(check).toHaveProperty('daoRequired');
    });

    it('refuses on progress before it ever refuses on dao', () => {
        // Ordering matters: telling somebody to go and find a teacher while
        // they are still eighty qi-units short is advice about the wrong
        // problem.
        const short = makeCultivator({
            realmOrdinal: DAO_GATE_FROM_ORDINAL,
            cultivationProgress: 0,
            insights: []
        });
        expect(canAttemptBreakthrough(short).reason).toBe('insufficient_progress');
    });
});
