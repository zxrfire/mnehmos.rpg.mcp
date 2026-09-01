/**
 * Shared fixtures for the cultivation engine tests.
 *
 * Cultivators are built through `CultivatorSchema.parse` rather than by hand so
 * every fixture carries the schema's own defaults - if a default changes, the
 * tests exercise the new one instead of a stale literal.
 */

import {
    CultivatorSchema,
    type Cultivator,
    type Injury,
    type InjurySeverity,
    type InjurySource,
    type Insight
} from '../../../src/schema/cultivation.js';
import { createInjury } from '../../../src/engine/cultivation/injuries.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import {
    ROADS_BESIDES_YOUR_OWN,
    daoRequirementCurve
} from '../../../src/engine/cultivation/breakthrough.js';

/**
 * The roads besides their own that somebody standing at this rung would hold.
 *
 * Exactly what `daoRequirementCurve` asks for there and not one more, at the
 * shallowest degree, so a fixture is never accidentally given comprehension
 * DEPTH it did not ask for - `understandingEffects` prices depth and would
 * quietly move the odds every one of these tests is measuring.
 *
 * A cultivator at ordinal 44 in this world has walked roads; they could not
 * have got there otherwise. A fixture at 44 with an empty insight list is not
 * a cultivator the world can produce, and before the dao gate went live it was
 * merely unrealistic rather than illegal.
 */
export function roadsForRung(realmOrdinal: number): Insight[] {
    // The wall they will meet is the next boundary at or above them, and it is
    // the one a fixture has to be able to strike at.
    let needed = 0;
    for (let ordinal = realmOrdinal; ordinal <= realmOrdinal + 4; ordinal++) {
        needed = Math.max(needed, daoRequirementCurve(ordinal));
    }
    return ROADS_BESIDES_YOUR_OWN.slice(0, needed).map(domain => ({
        id: `fixture-road-${domain}`,
        domain,
        subject: domain,
        degree: 1 as const,
        provenance: {
            achievementId: `fixture-road-${domain}`,
            achievementKind: 'profound_principle' as const,
            onDay: 1,
            deepenedBy: [],
            account: `A road besides their own, which anybody standing this high has walked.`
        }
    }));
}

/**
 * A cultivator, with the comprehension their rung implies unless the caller
 * says otherwise.
 *
 * `insights` is defaulted rather than left empty because the dao gate is live:
 * an empty list at a high rung is refused by `canAttemptBreakthrough`, which is
 * correct behaviour and is not what the tribulation, crossing, ceiling and
 * time-skip suites are trying to measure. Pass `insights` explicitly - `[]`
 * included - whenever the comprehension itself is the subject.
 */
export function makeCultivator(overrides: Partial<Cultivator> = {}): Cultivator {
    return CultivatorSchema.parse({
        id: 'cultivator-under-test',
        name: 'Test Subject',
        kind: 'pc',
        spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        hp: 50,
        maxHp: 50,
        qi: 20,
        maxQi: 20,
        insights: roadsForRung(overrides.realmOrdinal ?? 0),
        ...overrides
    });
}

/** `count` untreated injuries of one severity, with stable seeded ids. */
export function makeInjuries(
    count: number,
    severity: InjurySeverity = 'minor',
    source: InjurySource = 'combat'
): Injury[] {
    const rng = new CultivationRNG('fixture-injuries');
    return Array.from({ length: count }, () =>
        createInjury({ severity, source, turn: 1 }, rng)
    );
}
