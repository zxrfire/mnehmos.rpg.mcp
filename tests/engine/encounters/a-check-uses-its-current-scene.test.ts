/**
 * A moving voyage formerly rolled its complete window against the departure
 * place and cast, then executed even its departure occasion at a later body
 * checkpoint. These controls preserve the old full receipts in the SAME
 * invocation, and require later cadence checks to use their supplied actual
 * scene. The old module is an independent test-only oracle, not a runtime arm.
 * No seed hunt, world rollback, horizon cap or encounter suppression is used.
 * A later census passed five controls and first diverged in the fixed native
 * batch because an interruption gained occasionKey. The independent original
 * predates that held-occasion identity. Compare every legacy field, omitting
 * only that named addition from the new receipt; leave the oracle untouched.
 * The same fixed batch must encounter actual keys and prove that holding each
 * one suppresses its occasion on replay. No legacy result field is relaxed.
 */
import { describe, expect, it } from 'vitest';
import { rollEncounters, encountersAtChecks } from '../../../src/engine/encounters/window.js';
import { activityProfile } from '../../../src/engine/encounters/activity.js';
import { rollEncounters as beforeExtraction } from './window-original-control.js';
import type { EncounterRollInput } from '../../../src/engine/encounters/types.js';

function input(seed: string, startDay = 0, days = 45): EncounterRollInput {
    return { seed, startDay, days, activity: 'travel',
        cultivator: { id: 'player', realmOrdinal: 20, fortune: 1, hp: 1000, maxHp: 1000, spiritStones: 1000 },
        place: { id: 'departure', name: 'Actual departure dock', kind: 'settlement', danger: .3 },
        cast: [{ id: 'dock-person', name: 'Person ashore', realmOrdinal: 20, known: true }] };
}

/** All original receipt fields; only the later held-occasion identity is new. */
function legacyFields(roll: ReturnType<typeof rollEncounters>) {
    return { ...roll, occurrences: roll.occurrences.map(occurrence => {
        const legacy = { ...occurrence };
        delete legacy.occasionKey;
        return legacy;
    }) };
}

describe('the existing encounter cadence with a fresh scene at each check', () => {
    /** Same accepted crossing has one departure and keeps future grids across pauses. */
    it('splits quiet native windows without repeating departure or equal committed checks', () => {
        let quietWindows = 0;
        const drain = (given: EncounterRollInput, bounds: Parameters<typeof encountersAtChecks>[1]) => {
            const held = encountersAtChecks(given, bounds);
            const checks: Array<{ stage: string; day: number }> = [];
            let next = held.next();
            while (!next.done) {
                if (next.value.kind === 'check') checks.push({ stage: next.value.stage, day: next.value.absoluteDay });
                next = held.next(given);
            }
            return { checks, roll: next.value };
        };
        // A fixed contract batch, not a hunt for a favourable played fixture.
        for (let sample = 0; sample < 64; sample++) {
            const given = input('same-crossing-cadence-' + sample);
            const whole = drain(given, {});
            if (whole.roll.firstInterruptDay !== null) continue;
            quietWindows++;
            const first = drain(given, { throughDay: 14 });
            const second = drain(given, { departureOccasion: false, afterDay: 14, throughDay: 28 });
            const third = drain(given, { departureOccasion: false, afterDay: 28, throughDay: 45 });
            expect([...first.checks, ...second.checks, ...third.checks]).toEqual(whole.checks);
            expect([...first.roll.occurrences, ...second.roll.occurrences, ...third.roll.occurrences])
                .toEqual(whole.roll.occurrences);
        }
        expect(quietWindows).toBeGreaterThan(0);
    });

    it('a same-receipt zero-time resume omits departure while a new boarding receives it', () => {
        const given = input('departure-once');
        const accepted = encountersAtChecks(given);
        expect(accepted.next().value).toMatchObject({ kind: 'check', stage: 'occasion', dayOffset: 0 });
        const resumed = encountersAtChecks(given, { departureOccasion: false, afterDay: 0 });
        const next = resumed.next();
        expect(next.done).toBe(false);
        // Root focused09 observed day3: native travel's grid is three days,
        // unlike the generic fourteen-day grid. The actual profile owns it.
        const travelGrid = activityProfile(given.activity).gridDays!;
        expect(next.value).toMatchObject({ kind: 'check', stage: 'span', absoluteDay: travelGrid });
        const genuinelyNew = encountersAtChecks(given);
        expect(genuinelyNew.next().value).toMatchObject({ kind: 'check', stage: 'occasion', dayOffset: 0 });
    });

    it('preserves complete legacy receipts, arrivals, limits and event streams against an independent original', () => {
        for (const activity of ['travel', 'abroad', 'seclusion', 'sealed'] as const) {
            for (const startDay of [0, 14, 100]) for (const days of [0, .125, 1, 45, 365]) {
                const given = { ...input('legacy-phase-reference', startDay, days), activity,
                    limit: startDay === 14 ? 1 : 32,
                    arrivable: Array.from({ length: 140 }, (_, i) => ({ factId: `actual-fact-${i}`,
                        day: i, text: 'An actual recorded event.', magnitude: i % 3 ? .35 : .75 })) };
                expect(legacyFields(rollEncounters(given))).toEqual(beforeExtraction(given));
            }
        }
    });

    it('matches the independent original full receipt over sixty-four fixed native windows', () => {
        let heldOccasions = 0;
        for (let sample = 0; sample < 64; sample++) {
            const given = { ...input('same-invocation-original-' + sample, sample, 365),
                activity: (['travel', 'abroad', 'seclusion', 'sealed'] as const)[sample % 4],
                limit: sample % 3 === 0 ? 1 : 32,
                arrivable: [{ factId: 'actual-observed-fact', day: sample + 3, text: 'An actual recorded event.', magnitude: .75 }] };
            const current = rollEncounters(given);
            expect(legacyFields(current)).toEqual(beforeExtraction(given));
            for (const occurrence of current.occurrences) {
                const key = occurrence.occasionKey;
                if (!key) continue;
                heldOccasions++;
                const repeated = rollEncounters({ ...given, knownOccasions: new Set([key]) });
                expect(repeated.occurrences.some(row => row.occasionKey === key),
                    'an experienced departure occasion was offered again').toBe(false);
            }
        }
        expect(heldOccasions, 'the fixed batch did not exercise held occasions').toBeGreaterThan(0);
    });

    it('offers its departure check before any elapsed time and never offers that occasion again', () => {
        const given = input('departure-check');
        const held = encountersAtChecks(given);
        const first = held.next();
        expect(first.done).toBe(false);
        expect(first.value).toMatchObject({ kind: 'check', dayOffset: 0, absoluteDay: 0, stage: 'occasion' });
        let next = held.next(given), occasions = 1;
        while (!next.done) {
            if (next.value.kind === 'check' && next.value.stage === 'occasion') occasions++;
            next = held.next(given);
        }
        expect(occasions).toBe(1);
        expect(legacyFields(next.value)).toEqual(beforeExtraction(given));
    });

    it('does not grant or name a departed actor when later checks are supplied actual current company', () => {
        let laterOccurrences = 0;
        for (let sample = 0; sample < 64; sample++) {
            const original = input(`scene-contract-${sample}`);
            const held = encountersAtChecks(original);
            let next = held.next(), later = false;
            while (!next.done) {
                if (next.value.kind === 'check') {
                    later = next.value.stage === 'span';
                    next = held.next(later ? { ...original,
                        place: { id: 'actual-water', name: 'Actual open water', kind: 'river', danger: .3 },
                        cast: [{ id: 'actual-crew', name: 'Crew aboard this hull', realmOrdinal: 20, known: true }] }
                        : original);
                } else {
                    if (later) for (const occurrence of next.value.occurrences) {
                        laterOccurrences++;
                        expect(occurrence.castIds).not.toContain('dock-person');
                        expect(occurrence.grants.map(grant => grant.id)).not.toContain('dock-person');
                        expect(occurrence.event.summary).not.toContain('Person ashore');
                        expect(occurrence.event.summary).not.toContain('Actual departure dock');
                        for (const id of occurrence.castIds) expect(id).toBe('actual-crew');
                    }
                    next = held.next();
                }
            }
        }
        expect(laterOccurrences).toBeGreaterThan(0);
    });
});
