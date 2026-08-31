/**
 * The long-simulation primitive.
 *
 * The contract being tested: one deterministic pass, no per-day LLM
 * involvement, no O(days) blow-up, byte-identical results for the same seed,
 * early termination on anything the player needs to see, and a digest coherent
 * enough that returning after ten years is an account rather than a date change.
 */

import {
    InjurySchema,
    SATIETY_COST_PER_ACTION,
    SATIETY_MAX,
    STARVATION_TURNS,
    stagnationYearsForOrdinal,
    type Cultivator
} from '../../../src/schema/cultivation.js';
import {
    DEVIATION_CHECK_DAYS,
    simulateTimeSkip,
    type TimeSkipContext
} from '../../../src/engine/cultivation/time-skip.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import {
    lifespanForOrdinal,
    progressRequiredForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import { makeCultivator } from './fixtures.js';

const TEN_YEARS = 10 * DAYS_PER_YEAR;

function ctx(overrides: Partial<TimeSkipContext> = {}): TimeSkipContext {
    return {
        seed: 'run-seed-0001',
        locationId: 'azure-cloud-peak',
        turn: 0,
        startDay: 0,
        grainAbstinence: true,
        ...overrides
    };
}

/** A sealed decade: no encounters, no auto-breakthroughs, no hunger. */
function sealed(overrides: Partial<TimeSkipContext> = {}): TimeSkipContext {
    return ctx({ randomEvents: false, autoBreakthrough: false, ...overrides });
}

/**
 * A cultivator whose progress bar cannot be filled inside the test window.
 *
 * Ordinal 20 costs ~40,000 qi-units and a clean root in the best possible
 * ambient band earns at most ~16,000 in a decade. That matters because with
 * `autoBreakthrough: false` a low-ordinal cultivator fills the bar in a couple
 * of months and then sits on overfull qi, which is deliberately a deviation
 * hazard - real behaviour, but noise in a test that is about something else.
 * A clean single root at ordinal 20 has a flat zero deviation risk, so a sealed
 * stretch is genuinely uneventful.
 */
function secluded(overrides: Partial<Cultivator> = {}): Cultivator {
    return makeCultivator({ spiritRoot: 'single_fire', realmOrdinal: 20, ...overrides });
}

/**
 * Plateau allowance at ordinal 20. Scaled off Core Formation's own 500-year
 * lifespan rather than the mortal-scale floor, so this is not STAGNATION_YEARS.
 */
const SECLUDED_STAGNATION = stagnationYearsForOrdinal(20);

describe('determinism', () => {
    it('produces a byte-identical result for the same seed and input', () => {
        const cultivator = makeCultivator({ spiritRoot: 'dual_water_fire' });
        const a = simulateTimeSkip(cultivator, TEN_YEARS, ctx());
        const b = simulateTimeSkip(cultivator, TEN_YEARS, ctx());
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    });

    it('produces a different history for a different seed', () => {
        const cultivator = makeCultivator({ spiritRoot: 'dual_water_fire' });
        const a = simulateTimeSkip(cultivator, TEN_YEARS, ctx({ seed: 'run-A' }));
        const b = simulateTimeSkip(cultivator, TEN_YEARS, ctx({ seed: 'run-B' }));
        expect(JSON.stringify(b)).not.toBe(JSON.stringify(a));
    });

    it('is unaffected by how the caller splits the request', () => {
        // The digest of one 360-day call and the digest of the events that fall
        // in the first 360 days of a longer call must agree, because every roll
        // is keyed to an absolute day rather than to a position in a stream.
        const cultivator = makeCultivator({ spiritRoot: 'dual_water_fire' });
        const short = simulateTimeSkip(cultivator, 360, sealed());
        const long = simulateTimeSkip(cultivator, 720, sealed());
        const longPrefix = long.events.filter(e => e.dayOffset <= 360);
        expect(longPrefix.map(e => [e.kind, e.dayOffset])).toEqual(
            short.events.map(e => [e.kind, e.dayOffset])
        );
    });

    it('never mutates the cultivator it was handed', () => {
        const cultivator = makeCultivator({ spiritRoot: 'dual_water_fire' });
        const before = JSON.parse(JSON.stringify(cultivator));
        simulateTimeSkip(cultivator, TEN_YEARS, ctx());
        expect(cultivator).toEqual(before);
    });
});

describe('performance and scale', () => {
    it('resolves a full uninterrupted decade quickly', () => {
        const started = Date.now();
        const result = simulateTimeSkip(secluded(), TEN_YEARS, sealed());
        const elapsedMs = Date.now() - started;

        expect(result.simulatedDays).toBe(TEN_YEARS);
        expect(result.interrupted).toBe(false);
        expect(result.died).toBe(false);
        // Generous: the real figure is a couple of milliseconds. This is a
        // guard against a future edit reintroducing a per-day loop.
        expect(elapsedMs).toBeLessThan(3000);
    });

    it('resolves a century without blowing up', () => {
        const started = Date.now();
        const result = simulateTimeSkip(secluded({ age: 20 }), 100 * DAYS_PER_YEAR, sealed());
        expect(Date.now() - started).toBeLessThan(3000);
        expect(result.simulatedDays).toBeGreaterThan(0);
    });

    it('accounts the elapsed time exactly, in days and in years', () => {
        const result = simulateTimeSkip(secluded(), TEN_YEARS, sealed());
        expect(result.requestedDays).toBe(TEN_YEARS);
        expect(result.simulatedDays).toBe(TEN_YEARS);
        expect(result.deltas.age).toBeCloseTo(10, 6);
    });

    it('does nothing at all for a zero-day skip', () => {
        const result = simulateTimeSkip(makeCultivator(), 0, ctx());
        expect(result.simulatedDays).toBe(0);
        expect(result.events).toHaveLength(0);
        expect(result.deltas.cultivationProgress).toBe(0);
        expect(result.died).toBe(false);
    });
});

describe('progress and advancement', () => {
    it('accrues progress at the computed rate over a sealed stretch', () => {
        const result = simulateTimeSkip(secluded(), 300, sealed());
        expect(result.deltas.cultivationProgress).toBeGreaterThan(0);
        expect(result.deltas.realmOrdinal).toBe(0);
    });

    it('climbs several ranks over a decade and reports each one', () => {
        // A run that gets through a decade of Qi Condensation without a
        // wounding breakthrough is the lucky case, not the typical one, so
        // sweep seeds deterministically for it rather than assuming one.
        let best: ReturnType<typeof simulateTimeSkip> | null = null;
        for (let i = 0; i < 40; i++) {
            const result = simulateTimeSkip(
                makeCultivator(),
                TEN_YEARS,
                ctx({ seed: `climb-${i}`, randomEvents: false })
            );
            const successes = result.events.filter(e => e.kind === 'breakthrough_success');
            if (successes.length >= 2) {
                best = result;
                break;
            }
        }
        expect(best).not.toBeNull();

        const successes = best!.events.filter(e => e.kind === 'breakthrough_success');
        expect(best!.deltas.realmOrdinal).toBe(successes.length);
        for (const event of successes) {
            expect(event.summary).toContain('Breakthrough succeeded');
            expect(event.interrupts).toBe(false);
            expect(event.data.toOrdinal).toBe((event.data.fromOrdinal as number) + 1);
        }
    });

    it('does not advance a rank when auto-breakthrough is off, however much progress banks up', () => {
        const result = simulateTimeSkip(
            makeCultivator({ cultivationProgress: progressRequiredForOrdinal(0) * 10 }),
            TEN_YEARS,
            sealed()
        );
        expect(result.deltas.realmOrdinal).toBe(0);
        expect(result.events.some(e => e.kind === 'breakthrough_success')).toBe(false);
    });

    it('keeps the event digest in chronological order', () => {
        const result = simulateTimeSkip(
            makeCultivator({ spiritRoot: 'dual_water_fire' }),
            TEN_YEARS,
            ctx()
        );
        for (let i = 1; i < result.events.length; i++) {
            expect(result.events[i].dayOffset).toBeGreaterThanOrEqual(
                result.events[i - 1].dayOffset
            );
        }
    });

    it('emits engine-authored factual summaries the narrator can render', () => {
        const result = simulateTimeSkip(
            makeCultivator({ spiritRoot: 'dual_water_fire' }),
            TEN_YEARS,
            ctx()
        );
        expect(result.events.length).toBeGreaterThan(0);
        for (const event of result.events) {
            expect(typeof event.summary).toBe('string');
            expect(event.summary.trim().length).toBeGreaterThan(0);
            expect(event.dayOffset).toBeGreaterThanOrEqual(0);
            expect(event.dayOffset).toBeLessThanOrEqual(result.simulatedDays);
        }
    });
});

describe('survival during a skip', () => {
    it('starves to death on exactly the documented day without provisions', () => {
        // Full belly buys 50 days; five more at zero satiety is fatal.
        const expectedDeathDay = SATIETY_MAX / SATIETY_COST_PER_ACTION + STARVATION_TURNS;
        const result = simulateTimeSkip(
            secluded(),
            TEN_YEARS,
            sealed({ grainAbstinence: false, rations: 0 })
        );
        expect(result.died).toBe(true);
        expect(result.deathCause).toBe('starvation');
        expect(result.simulatedDays).toBe(expectedDeathDay);
        expect(result.interrupted).toBe(true);
        expect(result.interruptReason).toBe('death:starvation');
        expect(result.events.at(-1)?.kind).toBe('death');
    });

    it('warns when the belly empties, before it kills', () => {
        const result = simulateTimeSkip(
            secluded(),
            TEN_YEARS,
            sealed({ grainAbstinence: false, rations: 0 })
        );
        const warning = result.events.find(e => e.kind === 'starvation_warning');
        expect(warning).toBeDefined();
        expect(warning!.dayOffset).toBe(SATIETY_MAX / SATIETY_COST_PER_ACTION);
        expect(warning!.dayOffset).toBeLessThan(result.simulatedDays);
    });

    it('eats through provisions and reports when the last of them is gone', () => {
        const rations = 3;
        const result = simulateTimeSkip(
            secluded(),
            TEN_YEARS,
            sealed({ grainAbstinence: false, rations })
        );
        // Each ration buys another 50 days on top of the starting belly.
        const expectedDeathDay =
            (rations + 1) * (SATIETY_MAX / SATIETY_COST_PER_ACTION) + STARVATION_TURNS;
        expect(result.simulatedDays).toBe(expectedDeathDay);
        expect(result.deathCause).toBe('starvation');
        expect(result.events.some(e => e.kind === 'resource_depleted')).toBe(true);
    });

    it('does not starve at all on grain abstinence', () => {
        const result = simulateTimeSkip(secluded(), TEN_YEARS, sealed());
        expect(result.deltas.satiety).toBe(0);
        expect(result.events.some(e => e.kind === 'starvation_warning')).toBe(false);
        expect(result.died).toBe(false);
    });

    it('dies of old age exactly at the realm lifespan ceiling', () => {
        const ceiling = lifespanForOrdinal(20);
        const result = simulateTimeSkip(
            secluded({ age: ceiling - 10, yearsAtCurrentRealm: 0 }),
            100 * DAYS_PER_YEAR,
            sealed()
        );
        expect(result.died).toBe(true);
        expect(result.deathCause).toBe('lifespan_exhausted');
        expect(result.simulatedDays).toBe(10 * DAYS_PER_YEAR);
    });

    it('dies of stagnation exactly at the stagnation budget', () => {
        // Ordinal 20's bar cannot be filled here, so nothing can rescue this
        // cultivator by advancing them - which is precisely the situation
        // STAGNATION_YEARS exists to end.
        const result = simulateTimeSkip(
            secluded({ age: 60, yearsAtCurrentRealm: SECLUDED_STAGNATION - 10 }),
            100 * DAYS_PER_YEAR,
            sealed()
        );
        expect(result.died).toBe(true);
        expect(result.deathCause).toBe('stagnation_aging');
        expect(result.simulatedDays).toBe(10 * DAYS_PER_YEAR);
    });

    it('stops the moment it dies and simulates nothing after', () => {
        const result = simulateTimeSkip(
            secluded(),
            TEN_YEARS,
            sealed({ grainAbstinence: false, rations: 0 })
        );
        expect(result.simulatedDays).toBeLessThan(result.requestedDays);
        for (const event of result.events) {
            expect(event.dayOffset).toBeLessThanOrEqual(result.simulatedDays);
        }
        expect(result.deltas.age).toBeCloseTo(result.simulatedDays / DAYS_PER_YEAR, 6);
    });
});

describe('interruption', () => {
    it('hands control back on a major encounter', () => {
        // Sweep seeds until a major encounter comes up; there is nothing
        // special about which one, only that the branch is reachable and
        // correctly shaped.
        let found: ReturnType<typeof simulateTimeSkip> | null = null;
        for (let i = 0; i < 60 && found === null; i++) {
            const result = simulateTimeSkip(
                makeCultivator(),
                TEN_YEARS,
                ctx({ seed: `encounter-${i}`, autoBreakthrough: false })
            );
            if (result.interruptReason === 'major_encounter') found = result;
        }
        expect(found).not.toBeNull();
        expect(found!.interrupted).toBe(true);
        expect(found!.died).toBe(false);
        expect(found!.simulatedDays).toBeLessThan(TEN_YEARS);
        const last = found!.events.at(-1)!;
        expect(last.kind).toBe('encounter');
        expect(last.interrupts).toBe(true);
        expect(last.data.severity).toBe('major');
    });

    it('hands control back when a breakthrough leaves a wound', () => {
        let found: ReturnType<typeof simulateTimeSkip> | null = null;
        for (let i = 0; i < 60 && found === null; i++) {
            const result = simulateTimeSkip(
                makeCultivator(),
                TEN_YEARS,
                ctx({ seed: `wound-${i}`, randomEvents: false })
            );
            if (result.interruptReason?.startsWith('breakthrough_failure')) found = result;
        }
        expect(found).not.toBeNull();
        expect(found!.deltas.injuriesGained).toBeGreaterThan(0);
        expect(found!.events.at(-1)!.kind).toBe('breakthrough_failure');
        expect(found!.events.at(-1)!.interrupts).toBe(true);
    });

    it('does not interrupt for a breakthrough that failed cleanly', () => {
        const result = simulateTimeSkip(
            makeCultivator(),
            TEN_YEARS,
            ctx({ randomEvents: false })
        );
        const cleanFailures = result.events.filter(
            e => e.kind === 'breakthrough_failure' && e.data.outcome === 'failure_stable'
        );
        for (const event of cleanFailures) {
            expect(event.interrupts).toBe(false);
        }
    });

    it('hands control back when untreated injuries reach the lethal threshold', () => {
        let found: ReturnType<typeof simulateTimeSkip> | null = null;
        for (let i = 0; i < 40 && found === null; i++) {
            const result = simulateTimeSkip(
                makeCultivator({ spiritRoot: 'dual_water_fire', maxHp: 500, hp: 500 }),
                50 * DAYS_PER_YEAR,
                ctx({ seed: `deviation-${i}`, randomEvents: false, autoBreakthrough: false })
            );
            if (result.interruptReason === 'lethal_injury_threshold') found = result;
        }
        expect(found).not.toBeNull();
        expect(found!.deltas.injuriesGained).toBeGreaterThanOrEqual(3);
        expect(found!.events.at(-1)!.kind).toBe('injury_sustained');
    });
});

describe('qi deviation during a skip', () => {
    it('never deviates for a clean root cultivating an elementless art', () => {
        const result = simulateTimeSkip(secluded(), TEN_YEARS, sealed());
        expect(result.events.some(e => e.kind === 'qi_deviation')).toBe(false);
        expect(result.deltas.injuriesGained).toBe(0);
    });

    it('does put a clean root at risk once it sits on overfull qi', () => {
        // Qi that has nowhere to go turns on its owner: banking progress past
        // the bottleneck and refusing to attempt it is not a safe strategy.
        const hoarder = makeCultivator({
            spiritRoot: 'single_fire',
            cultivationProgress: progressRequiredForOrdinal(0) * 5,
            maxHp: 500,
            hp: 500
        });
        const result = simulateTimeSkip(hoarder, TEN_YEARS, sealed());
        expect(result.events.some(e => e.kind === 'qi_deviation')).toBe(true);
    });

    it('checks deviation on the fixed grid, never off it', () => {
        const result = simulateTimeSkip(
            makeCultivator({ spiritRoot: 'dual_water_fire', maxHp: 500, hp: 500 }),
            5 * DAYS_PER_YEAR,
            sealed({ })
        );
        for (const event of result.events.filter(e => e.kind === 'qi_deviation')) {
            expect(event.dayOffset % DEVIATION_CHECK_DAYS).toBe(0);
        }
    });

    it('deviates for a conflicting technique that a clean root would survive', () => {
        const base: Partial<Cultivator> = { maxHp: 500, hp: 500 };
        const safe = simulateTimeSkip(secluded(base), TEN_YEARS, sealed());
        const reckless = simulateTimeSkip(
            secluded(base),
            TEN_YEARS,
            sealed({ techniqueElement: 'water' })
        );
        expect(safe.events.filter(e => e.kind === 'qi_deviation')).toHaveLength(0);
        expect(reckless.events.filter(e => e.kind === 'qi_deviation').length).toBeGreaterThan(0);
    });
});

describe('injuriesSustained', () => {
    /**
     * The point of this block: a caller must be able to persist the wounds a
     * skip produced without inferring anything. No reading severity off an
     * event payload, and above all no scraping a severity word out of a
     * narration string the engine happens to have worded a particular way.
     */

    /** First skip in the sweep whose digest contains an event of `kind`. */
    function findWith(kind: string, runs: ReturnType<typeof simulateTimeSkip>[]) {
        return runs.find(result => result.events.some(e => e.kind === kind)) ?? null;
    }

    // Built once and shared. These sweeps are deterministic, so rebuilding
    // them per test only burns time.
    let deviationCache: ReturnType<typeof simulateTimeSkip>[] | null = null;
    let failureCache: ReturnType<typeof simulateTimeSkip>[] | null = null;

    function deviationRuns() {
        deviationCache ??= Array.from({ length: 40 }, (_, i) =>
            simulateTimeSkip(
                makeCultivator({ spiritRoot: 'dual_water_fire', maxHp: 500, hp: 500 }),
                TEN_YEARS,
                ctx({ seed: `injury-dev-${i}`, randomEvents: false, autoBreakthrough: false })
            )
        );
        return deviationCache;
    }

    function breakthroughFailureRuns() {
        failureCache ??= Array.from({ length: 60 }, (_, i) =>
            simulateTimeSkip(
                makeCultivator(),
                TEN_YEARS,
                ctx({ seed: `injury-bt-${i}`, randomEvents: false })
            )
        );
        return failureCache;
    }

    it('always agrees with the count in deltas', () => {
        for (const result of [...deviationRuns(), ...breakthroughFailureRuns()]) {
            expect(result.injuriesSustained).toHaveLength(result.deltas.injuriesGained);
        }
    });

    it('is empty for a skip that produced no wounds', () => {
        const result = simulateTimeSkip(secluded(), TEN_YEARS, sealed());
        expect(result.injuriesSustained).toEqual([]);
        expect(result.deltas.injuriesGained).toBe(0);
    });

    it('hands back complete, directly persistable Injury records', () => {
        const result = findWith('qi_deviation', deviationRuns());
        expect(result).not.toBeNull();
        expect(result!.injuriesSustained.length).toBeGreaterThan(0);

        for (const injury of result!.injuriesSustained) {
            // Round-trips through the schema, so it is writable as-is.
            expect(() => InjurySchema.parse(injury)).not.toThrow();
            expect(injury.id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
            );
            expect(injury.treated).toBe(false);
            expect(injury.description.length).toBeGreaterThan(0);
            expect(injury.cultivationPenalty).toBeGreaterThan(0);
            expect(injury.breakthroughPenalty).toBeGreaterThan(0);
        }
    });

    it('carries the ids that are actually on the cultivator, with no duplicates', () => {
        const result = findWith('qi_deviation', deviationRuns());
        const ids = result!.injuriesSustained.map(i => i.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('includes deviation wounds, tagged at the source rather than described', () => {
        const result = findWith('qi_deviation', deviationRuns());
        const deviationInjuries = result!.injuriesSustained.filter(
            i => i.source === 'qi_deviation'
        );
        expect(deviationInjuries.length).toBeGreaterThan(0);

        // The severity the event reported and the severity on the record agree,
        // so nothing has to be recovered from the payload either.
        const events = result!.events.filter(e => e.kind === 'qi_deviation');
        expect(events.length).toBe(deviationInjuries.length);
        events.forEach((event, i) => {
            expect(deviationInjuries[i].severity).toBe(event.data.severity);
        });
    });

    it('includes breakthrough-failure wounds - the case that was read from prose', () => {
        const result = findWith('breakthrough_failure', breakthroughFailureRuns());
        expect(result).not.toBeNull();
        const failure = result!.events.find(e => e.kind === 'breakthrough_failure')!;

        if (failure.interrupts) {
            // A wounding failure. The record must be present and must NOT need
            // the narration hint to be parsed for its severity.
            const fromBreakthrough = result!.injuriesSustained.filter(
                i => i.source === 'failed_breakthrough' || i.source === 'qi_deviation'
            );
            expect(fromBreakthrough.length).toBeGreaterThan(0);
            const wound = result!.injuriesSustained.at(-1)!;
            expect(['minor', 'serious', 'crippling']).toContain(wound.severity);
            // Belt and braces: the prose agrees with the record, but callers
            // no longer have to take the prose's word for it.
            expect(failure.summary).toContain(wound.severity);
        }
    });

    it('is chronological', () => {
        for (const result of [...deviationRuns(), ...breakthroughFailureRuns()]) {
            const turns = result.injuriesSustained.map(i => i.sustainedOnTurn);
            for (let i = 1; i < turns.length; i++) {
                expect(turns[i]).toBeGreaterThanOrEqual(turns[i - 1]);
            }
        }
    });

    it('records the burns of a SURVIVED tribulation', () => {
        // The third case that used to be recovered from prose, and the worst
        // of them: the caller was pulling the number of strikes that landed
        // out of the narration with a regex. Every one of those burns is now
        // a record in the array.
        // A one-day window, so exactly one crossing is attempted per seed and
        // the run cannot climb on into 41, 42 and 43 behind the assertion.
        let weathered = null;
        for (let i = 0; i < 400 && weathered === null; i++) {
            const result = simulateTimeSkip(
                makeCultivator({ realmOrdinal: 40, cultivationProgress: 1e12 }),
                1,
                ctx({ seed: `trib-burn-${i}`, randomEvents: false, toll: { candidates: [] } })
            );
            const success = result.events.find(
                e => e.kind === 'breakthrough_success' && e.data.tribulation !== null
            );
            if (success && result.injuriesSustained.length > 0) weathered = result;
        }
        expect(weathered).not.toBeNull();

        const burns = weathered!.injuriesSustained.filter(i => i.source === 'tribulation');
        expect(burns.length).toBeGreaterThan(0);
        expect(weathered!.deltas.realmOrdinal).toBe(1);
        for (const burn of burns) {
            expect(() => InjurySchema.parse(burn)).not.toThrow();
            expect(burn.description).toContain('Heavenly lightning');
        }
    });

    it('records the wounds of a fatal breakthrough too', () => {
        let fatal = null;
        for (let i = 0; i < 400 && fatal === null; i++) {
            const result = simulateTimeSkip(
                makeCultivator({ realmOrdinal: 12, cultivationProgress: progressRequiredForOrdinal(12) }),
                TEN_YEARS,
                ctx({ seed: `fatal-${i}`, randomEvents: false, toll: { candidates: [] } })
            );
            if (result.deathCause === 'failed_breakthrough') fatal = result;
        }
        expect(fatal).not.toBeNull();
        expect(fatal!.injuriesSustained.length).toBeGreaterThan(0);
        expect(fatal!.injuriesSustained.at(-1)!.source).toBe('failed_breakthrough');
    });
});

describe('endState', () => {
    it('reports starvation as an absolute count, not a delta', () => {
        const result = simulateTimeSkip(
            secluded(),
            TEN_YEARS,
            sealed({ grainAbstinence: false, rations: 0 })
        );
        expect(result.deathCause).toBe('starvation');
        expect(result.endState.starvationTurns).toBe(STARVATION_TURNS);
    });

    it('reports zero starvation for a well-fed skip', () => {
        const result = simulateTimeSkip(secluded(), TEN_YEARS, sealed());
        expect(result.endState.starvationTurns).toBe(0);
    });

    it('reports years-at-realm reset by an advance, which no delta could express', () => {
        // The counter returns to zero on a rank advance, so "before + delta"
        // is not just imprecise, it is wrong. Absolute is the only honest form.
        let advanced = null;
        for (let i = 0; i < 40 && advanced === null; i++) {
            const result = simulateTimeSkip(
                makeCultivator({ yearsAtCurrentRealm: 30 }),
                TEN_YEARS,
                ctx({ seed: `reset-${i}`, randomEvents: false })
            );
            if (result.deltas.realmOrdinal > 0 && !result.interrupted) advanced = result;
        }
        expect(advanced).not.toBeNull();
        expect(advanced!.endState.yearsAtCurrentRealm).toBeLessThan(30);
        expect(advanced!.endState.yearsAtCurrentRealm).toBeLessThanOrEqual(
            advanced!.simulatedDays / DAYS_PER_YEAR
        );
    });

    it('accumulates years-at-realm when nothing advanced', () => {
        const result = simulateTimeSkip(
            secluded({ yearsAtCurrentRealm: 5 }),
            TEN_YEARS,
            sealed()
        );
        expect(result.deltas.realmOrdinal).toBe(0);
        expect(result.endState.yearsAtCurrentRealm).toBeCloseTo(15, 4);
    });

    it('matches the stagnation threshold exactly when stagnation kills', () => {
        const result = simulateTimeSkip(
            secluded({ age: 60, yearsAtCurrentRealm: SECLUDED_STAGNATION - 10 }),
            100 * DAYS_PER_YEAR,
            sealed()
        );
        expect(result.deathCause).toBe('stagnation_aging');
        expect(result.endState.yearsAtCurrentRealm).toBeCloseTo(SECLUDED_STAGNATION, 4);
    });
});

describe('the price of advancement, during a long seclusion', () => {
    /** Standing at the Foundation boundary with the progress already banked. */
    function atBoundary(overrides: Partial<Cultivator> = {}) {
        return makeCultivator({
            realmOrdinal: 12,
            cultivationProgress: progressRequiredForOrdinal(12),
            ...overrides
        });
    }

    const POOL = [
        { kind: 'bond' as const, id: 'npc-brother', label: 'their brother', weight: 5 },
        { kind: 'memory' as const, id: 'mem-fall', label: 'the summer at the low fall', weight: 2 }
    ];

    it('charges a boundary crossed mid-skip and records it in the digest', () => {
        let charged = null;
        for (let i = 0; i < 60 && charged === null; i++) {
            const result = simulateTimeSkip(
                atBoundary(),
                TEN_YEARS,
                ctx({ seed: `skip-toll-${i}`, randomEvents: false, toll: { candidates: POOL } })
            );
            if (result.tolls.length > 0) charged = result;
        }
        expect(charged).not.toBeNull();
        expect(charged!.events.some(e => e.kind === 'toll_charged')).toBe(true);
        expect(charged!.tolls[0].boundaryIndex).toBe(0);
    });

    it('hands control back when a crossing actually takes something', () => {
        // Losing a brother must not be a footnote the player reads ten years
        // late in a list of events.
        let taken = null;
        for (let i = 0; i < 80 && taken === null; i++) {
            const result = simulateTimeSkip(
                atBoundary(),
                TEN_YEARS,
                ctx({ seed: `skip-taken-${i}`, randomEvents: false, toll: { candidates: POOL } })
            );
            if (result.tolls.some(t => t.outcome === 'taken')) taken = result;
        }
        expect(taken).not.toBeNull();
        expect(taken!.interrupted).toBe(true);
        expect(taken!.interruptReason).toBe('toll_charged');
        expect(taken!.simulatedDays).toBeLessThan(TEN_YEARS);
        const event = taken!.events.at(-1)!;
        expect(event.kind).toBe('toll_charged');
        expect(event.interrupts).toBe(true);
        expect(event.data.taken).not.toBeNull();
    });

    it('lets a Severed cultivator cross without interrupting the seclusion', () => {
        const result = simulateTimeSkip(
            atBoundary(),
            TEN_YEARS,
            ctx({ randomEvents: false, toll: { candidates: POOL, severed: true } })
        );
        for (const toll of result.tolls) {
            expect(toll.outcome).toBe('prepaid');
        }
        expect(result.interruptReason).not.toBe('toll_charged');
    });

    it('reports the foundation laid by a crossing during the skip', () => {
        let laid = null;
        for (let i = 0; i < 60 && laid === null; i++) {
            const result = simulateTimeSkip(
                atBoundary(),
                TEN_YEARS,
                ctx({
                    seed: `skip-foundation-${i}`,
                    randomEvents: false,
                    foundation: { preparation: 1 },
                    toll: { candidates: [] }
                })
            );
            if (result.foundationEstablished !== null) laid = result;
        }
        expect(laid).not.toBeNull();
        expect(laid!.deltas.realmOrdinal).toBeGreaterThan(0);
        expect(
            laid!.events.some(
                e => e.kind === 'breakthrough_success' && e.data.foundationEstablished !== null
            )
        ).toBe(true);
    });

    it('reports no foundation and no toll for a skip that crosses nothing', () => {
        const result = simulateTimeSkip(secluded(), TEN_YEARS, sealed());
        expect(result.tolls).toEqual([]);
        expect(result.foundationEstablished).toBeNull();
    });

    it('stays byte-identical with the toll and foundation in play', () => {
        const conditions = ctx({
            randomEvents: false,
            toll: { candidates: POOL },
            foundation: { preparation: 0.5 }
        });
        const a = simulateTimeSkip(atBoundary(), TEN_YEARS, conditions);
        const b = simulateTimeSkip(atBoundary(), TEN_YEARS, conditions);
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    });
});

describe('deltas', () => {
    it('reports net change rather than absolute state', () => {
        const cultivator = makeCultivator({ spiritStones: 100, cultivationProgress: 0 });
        const result = simulateTimeSkip(cultivator, TEN_YEARS, ctx({ randomEvents: false }));
        expect(result.deltas.spiritStones).toBe(0);
        expect(result.deltas.qi).toBe(0);
        expect(result.deltas.cultivationProgress).toBeGreaterThan(0);
        expect(result.deltas.age).toBeGreaterThan(0);
    });

    it('credits an opportunity to the spirit-stone delta', () => {
        let found: ReturnType<typeof simulateTimeSkip> | null = null;
        for (let i = 0; i < 60 && found === null; i++) {
            const result = simulateTimeSkip(
                makeCultivator({ attributes: { might: 2, insight: 2, fortune: 3, charm: 2 } }),
                TEN_YEARS,
                ctx({ seed: `opportunity-${i}`, autoBreakthrough: false })
            );
            if (result.events.some(e => e.kind === 'opportunity')) found = result;
        }
        expect(found).not.toBeNull();
        expect(found!.deltas.spiritStones).toBeGreaterThan(0);
    });
});
