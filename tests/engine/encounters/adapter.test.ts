/**
 * The turn loop's adapter, at the two places it is easy to get wrong.
 *
 * Everything else in `src/web/encounters.ts` is a field copy. These two are
 * decisions, and both were found by asking what happens on the SECOND call
 * rather than the first.
 */

import { describe, expect, it } from 'vitest';
import {
    consumeArrivals,
    activityForVerb,
    daysActuallySpent,
    withEncounterDeltas
} from '../../../src/web/encounters.js';
import { rollEncounters, type ArrivableFact, type EncounterPlace } from '../../../src/engine/encounters/index.js';
import type { Cultivator } from '../../../src/schema/cultivation.js';

const cave: EncounterPlace = { id: 'c', name: 'a cave', kind: 'cave', danger: 0.3 };

const world: ArrivableFact[] = Array.from({ length: 60 }, (_, i) => ({
    factId: `f${i}`,
    day: i * 100,
    text: 'Something happened and nobody is saying whose doing it was.',
    magnitude: i % 5 === 0 ? 0.7 : 0.4
}));

function seclusion(seed: string, startDay: number, arrivable: readonly ArrivableFact[]) {
    return rollEncounters({
        seed,
        startDay,
        days: 10 * 360,
        activity: 'seclusion',
        cultivator: { id: 'c1', realmOrdinal: 12, fortune: 1, maxHp: 60, hp: 60, spiritStones: 40 },
        place: cave,
        limit: 32,
        arrivable
    });
}

describe('arrival bookkeeping', () => {
    it('never lets one event reach somebody twice', () => {
        // The bug this exists to prevent: arrival is rolled once per fact and
        // is therefore stable forever, so a caller that hands the same list
        // back sees the same thing turn up in every window until it is dropped.
        let pending: ArrivableFact[] = [...world];
        const seen: string[] = [];

        for (let window = 0; window < 12; window++) {
            const roll = seclusion('bookkeeping', window * 3600, pending);
            for (const o of roll.occurrences) {
                if (o.source === 'digest') seen.push(String(o.event.data.factId));
            }
            pending = consumeArrivals(pending, roll);
        }

        expect(seen.length).toBeGreaterThan(0);
        expect(new Set(seen).size, 'the same event reached them more than once').toBe(seen.length);
    });

    it('keeps what never arrived, because consequences run late', () => {
        const roll = seclusion('late', 0, world);
        const arrived = roll.occurrences.filter(o => o.source === 'digest').length;
        expect(consumeArrivals(world, roll)).toHaveLength(world.length - arrived);
    });
});

describe('truncation', () => {
    it('spends only the days the cultivator actually gets', () => {
        const roll = seclusion('trunc', 400, world);
        const lived = daysActuallySpent(roll, 400, 3600);
        if (roll.firstInterruptDay === null) {
            expect(lived).toBe(3600);
        } else {
            expect(lived).toBe(roll.firstInterruptDay - 400);
            expect(lived).toBeLessThan(3600);
        }
    });

    it('always advances the clock, so a caller cannot loop', () => {
        // A window that interrupts on its own first day still spends a day.
        expect(daysActuallySpent(
            { occurrences: [], firstInterruptDay: 400, checks: 1, poolSize: 1 },
            400, 3600
        )).toBe(1);
    });
});

describe('verbs', () => {
    it('maps closed-door seclusion to the door that holds', () => {
        expect(activityForVerb('seclude')).toBe('sealed');
        expect(activityForVerb('cultivate')).toBe('seclusion');
        expect(activityForVerb('move')).toBe('travel');
    });

    it('sends anything it has not been told about somewhere quiet and safe', () => {
        expect(activityForVerb('some-verb-nobody-has-written-yet')).toBe('labour');
    });
});

describe('folding deltas', () => {
    const base = { id: 'c1', hp: 40, maxHp: 60, spiritStones: 10 } as Cultivator;

    it('never takes somebody below one, or a purse below zero', () => {
        const roll = {
            occurrences: [
                { deltas: { hp: -900, spiritStones: -900, satiety: 0, rations: 0 } },
                { deltas: { hp: 0, spiritStones: 0, satiety: 0, rations: 0 } }
            ],
            firstInterruptDay: null,
            checks: 1,
            poolSize: 1
        } as unknown as ReturnType<typeof rollEncounters>;

        const after = withEncounterDeltas(base, roll);
        expect(after.hp).toBe(1);
        expect(after.spiritStones).toBe(0);
        // And the input is never mutated.
        expect(base.hp).toBe(40);
    });

    it('returns the same object when nothing was settled', () => {
        const roll = { occurrences: [], firstInterruptDay: null, checks: 1, poolSize: 1 } as
            unknown as ReturnType<typeof rollEncounters>;
        expect(withEncounterDeltas(base, roll)).toBe(base);
    });
});
