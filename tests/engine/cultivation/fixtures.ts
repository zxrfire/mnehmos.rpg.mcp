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
    type InjurySource
} from '../../../src/schema/cultivation.js';
import { createInjury } from '../../../src/engine/cultivation/injuries.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';

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
