/**
 * A band on the road withdraws from an escort unless it is more than twice the
 * escort's number, and only bands and hostile rows are read against it.
 *
 * The owner: bandits "see and they scurry off" a carriage or a ship. The size is
 * the draw's own `count`, so the escort changes what a band does and never what
 * was drawn.
 */

import { describe, expect, it } from 'vitest';

import { whatTheEscortMet } from '../../../src/engine/encounters/an-escort-on-the-road';
import type { EncounterOccurrence, EncounterRoll } from '../../../src/engine/encounters/types';

function aBand(id: string, count: number, day: number): EncounterOccurrence {
    return {
        id, entryId: 'enc-roadside-bandits', kind: 'bandits', valence: 'hostile', dayOffset: day,
        absoluteDay: day, interrupts: true, stance: 'wary', source: 'catalog', account: null,
        duty: null, scene: null, contact: null, grants: [], castIds: [],
        deltas: { hp: 0, spiritStones: 0, satiety: 0, rations: 0 },
        confrontation: {
            threatOrdinal: 2, count, stance: 'wary', damageMultiplier: 1, reaction: '',
            avoidable: true, engageable: true
        },
        event: { kind: 'encounter', summary: '' }
    } as unknown as EncounterOccurrence;
}

function aTraveller(day: number): EncounterOccurrence {
    return { ...aBand('traveller', 1, day), entryId: 'enc-travelling-pill-merchant', kind: 'travellers', confrontation: null,
        interrupts: false } as unknown as EncounterOccurrence;
}

const ROLL = (occurrences: EncounterOccurrence[]): EncounterRoll =>
    ({ occurrences, firstInterruptDay: occurrences[0]?.absoluteDay ?? null, checks: 3, poolSize: 10 });

describe('an escort on the road', () => {
    it('sends a band of no more than twice the escort away, and lets everything else happen', () => {
        const met = whatTheEscortMet(ROLL([aBand('small', 6, 3), aTraveller(4)]), 3);
        expect(met.withdrew.map(one => one.id)).toEqual(['small']);
        expect(met.attacking).toBeNull();
        expect(met.roll.occurrences.map(one => one.id)).toEqual(['traveller']);
        expect(met.roll.firstInterruptDay).toBeNull();
    });

    it('has a band of more than twice the escort attack, on the day it was drawn', () => {
        const met = whatTheEscortMet(ROLL([aBand('big', 7, 5)]), 3);
        expect(met.attacking?.id).toBe('big');
        expect(met.roll.firstInterruptDay).toBe(5);
    });

    it('lets a smaller escort be taken on by a smaller band', () => {
        expect(whatTheEscortMet(ROLL([aBand('five', 5, 2)]), 2).attacking?.id).toBe('five');
        expect(whatTheEscortMet(ROLL([aBand('five', 5, 2)]), 3).attacking).toBeNull();
    });
});
