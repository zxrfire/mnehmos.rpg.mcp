/**
 * Census seed area-occupancy-census-2026-10-01 exposed a 93-death tenth year
 * and villages draining from 10.9 to 1.9 people per place over 500 years.
 * The owner retained the early cohort: its unchanged lifespan cap is spread
 * only 0-4 years, and its ordinary advancement is observed, never forced.
 * The paired control on this checkout had 235 old-age deaths in thirty years,
 * 90 in year ten. The bands retain that cohort without retaining the spike.
 * Certification on 8210cf97 measured 318 distinct deaths, all on their actual
 * pre-advance lifespan deadline: 317 opening-roster members and one later
 * modelled person. The former 300 total ceiling is now 350 (about 10% margin);
 * the annual maximum of 40 and all other population/cohort bounds stay fixed.
 * The first repair had 216 old-age deaths, maximum 25 in a year; villages
 * averaged 6.9/7.1 and towns 13.9/14.6 people at years 100/500.
 * It also grew house grounds to 49.3 people per place: outside intake and
 * birth placement bypassed the catalog roll limit, while a global shortfall
 * could keep producing births after local vacancies were filled.
 * Capacity-bound intake and replacement now give villages 9.4/8.3, towns
 * 19.1/19.1 and house grounds 10.6/12.6 people at years 100/500. Living
 * population stays at 1669-1794 from year 100 onward, against 2810-2886
 * over the control's last two centuries. Both source arms ran in one command.
 * The 0-40 yearly band rejects
 * the original spike; the century ratios reject ongoing drain or growth.
 * The behavior half, local-replacement-uses-the-actual-vacancy.test.ts, arranges
 * full global population beside a local vacancy. This reachability half uses
 * the same hasLocalReplacementSituation predicate and source-keyed checkpoints
 * at 100/200/300/400/500 years. Century population bands and retained ratios
 * keep their original assertions. Five-year windows at each age measure annual
 * entry/exit flows separately; their diagnostics are windows, not century totals.
 * The first thirty years retain every year's original old-age-cohort check.
 * The 27511c66 diagnostic measured 326 deaths against the retained 300 bound.
 * The next census also records whether each death belonged to the opening
 * modelled roster, preserving the totals and every assertion. People modelled
 * later may already be old; this flag is not a birth date. Attribution and
 * pre-advance lifespan values keep a failure diagnosable without repeating
 * the walk merely to recover identities lost by its aggregate counts.
 * A contract takes a real full/vacant pair out of the aged census and runs
 * the same focused birth appointment as the small arrangement.
 * Births are the driver's demographic count. Entries and deaths reconcile
 * successive annual living censuses, including house people brought forward.
 * Timing covers five actual advances from year 400; no clone or census read.
 * Restoring the uncapped arm fails the house band and each capacity unit test.
 */
import { expect, it, vi } from 'vitest';
import { performance } from 'node:perf_hooks';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { realmForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { isTerminal } from '../../../src/engine/cultivation/existence.js';
import { walkingDaysFrom } from '../../../src/engine/world/locations.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import { serializedFixture } from '../../support/serialized-fixture.js';
import { sampledWorld } from '../../support/sampled-world.js';
import { hasLocalReplacementSituation } from '../../support/population-precondition.js';
import { populationWeightOf } from '../../../src/engine/world/locations.js';
import { localVacanciesCanReplaceResidents } from '../../support/population-scenario.js';
import * as npcState from '../../../src/engine/world/npc-state.js';
import * as crossings from '../../../src/engine/world/recording-what-a-crossing-did.js';
import * as seeding from '../../../src/engine/world/seeding.js';

const SEED = 'area-occupancy-census-2026-10-01';
function kind(place: WorldState['locations'][number]): string {
    return place.kind === 'settlement'
        ? place.tags.find(t => ['village', 'hamlet', 'market_town', 'sect_town', 'city', 'waystation', 'gate_town'].includes(t)) ?? 'town'
        : place.kind;
}
interface Bucket { places: number; volume: number; inflow: number; outflow: number }
interface Census {
    deaths: number[];
    mortality: { openingRosterSize: number; openingRoster: number[]; laterModelled: number[];
        records: { npcId: string; onDay: number; countedYear: number; advanceYear: number;
            rank: string; initiallyModelled: boolean; bornOnDay: number | null;
            lifespanBeforeAdvance: number | null }[] };
    marks: Record<string, Record<string, Bucket>>;
    pyramid: Record<string, number>;
    recruits: number;
    windows: Record<string, { births: number; entrants: number; deaths: number; otherExits: number }>;
    cost400: { living: number; rows: number; milliseconds: number[] };
    cohort: { size: number; attempted: number; succeeded: number; extended: number;
        recordedAttempted: number; recordedSucceeded: number; stampedSucceeded: number;
        derivedAttempted: number; derivedSucceeded: number;
        wallAttempted: number; wallSucceeded: number;
        died: number; diedWithoutAttempting: number; alive: number; statuses: Record<string, number> };
}

async function census(): Promise<Census> {
    const bytes = await serializedFixture('population-census', [
        'tests/engine/world/population-census.test.ts'
    ], { seed: SEED, census: 'sampled-checkpoints-v4-mortality-attribution' }, async () => {
        // Thirty years is the named opening cohort's lifespan window, not a
        // route to an old world. Its death distribution still uses every year.
        const early = await sampledWorld(SEED, { years: 0 });
        const start = early.currentDay;
        const deaths = Array<number>(31).fill(0);
        const seeded = new Set(early.npcs.map(person => person.id));
        const mortality: Census['mortality'] = { openingRosterSize: seeded.size,
            openingRoster: Array<number>(31).fill(0), laterModelled: Array<number>(31).fill(0), records: [] };
        for (let year = 1; year <= 30; year++) {
            const before = new Map(early.npcs.map(person => [person.id, {
                bornOnDay: person.identity.bornOnDay, lifespanEndsOnDay: person.cultivation.lifespanEndsOnDay }]));
            const result = advanceWorldForPlay(early, { days: 365, stopOnInterrupt: false });
            for (const death of result.time.deaths) {
                const at = Math.ceil((death.onDay - start) / 365);
                if (at >= 0 && at <= 30) {
                    deaths[at]++;
                    const initiallyModelled = seeded.has(death.npcId), person = before.get(death.npcId);
                    mortality[initiallyModelled ? 'openingRoster' : 'laterModelled'][at]++;
                    mortality.records.push({ npcId: death.npcId, onDay: death.onDay,
                        countedYear: at, advanceYear: year, rank: death.rank, initiallyModelled,
                        bornOnDay: person?.bornOnDay ?? null,
                        lifespanBeforeAdvance: person?.lifespanEndsOnDay ?? null });
                }
            }
        }
        const marks: Census['marks'] = {};
        const windows: Census['windows'] = {};
        const cost400: Census['cost400'] = { living: 0, rows: 0, milliseconds: [] };
        let final: WorldState | undefined;
        for (const year of [0, 100, 200, 300, 400, 500]) {
            const state = await sampledWorld(SEED, { years: year });
            expect(state.currentDay).toBe(start + year * 365);
            const membership = () => {
                const places = new Map(state.locations.map(place => [place.id, kind(place)]));
                return new Map(state.npcs.filter(person => person.status === 'alive')
                    .map(person => [person.id, places.get(person.locationId ?? '') ?? 'nowhere']));
            };
            const previous = membership();
            const rows: Record<string, Bucket> = {};
            for (const place of state.locations) {
                const k = kind(place);
                (rows[k] ??= { places: 0, volume: 0, inflow: 0, outflow: 0 }).places++;
            }
            for (const k of previous.values()) (rows[k] ??= { places: 0, volume: 0, inflow: 0, outflow: 0 }).volume++;
            marks[year] = rows;
            if (year === 500) final = state;
            if (!year) continue;
            const totals = windows[year / 100] = { births: 0, entrants: 0, deaths: 0, otherExits: 0 };
            let before = previous;
            if (year === 400) { cost400.living = before.size; cost400.rows = state.npcs.length; }
            // Five consecutive annual censuses measure flow from each genuine
            // age checkpoint. These are sampled windows, never century totals.
            for (let window = 0; window < 5; window++) {
                const began = performance.now();
                const advanced = advanceWorldForPlay(state, { days: 365, stopOnInterrupt: false });
                if (year === 400) cost400.milliseconds.push(performance.now() - began);
                const next = membership(), dead = new Set(advanced.deaths.map(death => death.deceasedId));
                const currentRows = new Map(state.npcs.map(person => [person.id, person]));
                totals.births += advanced.born;
                totals.entrants += [...next.keys()].filter(id => !before.has(id)).length;
                for (const [id, k] of before) if (next.get(id) !== k) rows[k].outflow++;
                for (const [id, k] of next) if (before.get(id) !== k) (rows[k] ??= { places: 0, volume: 0, inflow: 0, outflow: 0 }).inflow++;
                for (const id of before.keys()) if (!next.has(id)) {
                    const person = currentRows.get(id);
                    if (dead.has(id) || !person || isTerminal(person.status)) totals.deaths++; else totals.otherExits++;
                }
                before = next;
            }
            // Keep the final population at the census clock, before its window.
            if (year === 500) final = await sampledWorld(SEED, { years: 500 });
        }
        const pyramid: Record<string, number> = {};
        for (const person of final!.npcs.filter(person => person.status === 'alive')) {
            const realm = realmForOrdinal(person.cultivation.realmOrdinal).key;
            pyramid[realm] = (pyramid[realm] ?? 0) + 1;
        }
        const recruits = final!.npcs.filter(person => !seeded.has(person.id) && person.factionId !== null
            && person.tags.some(tag => tag.startsWith('region:'))).length;
        return Buffer.from(JSON.stringify({ deaths, mortality, marks, pyramid, recruits, windows, cost400 }));
    });
    const result = JSON.parse(bytes.toString('utf8')) as Census;
    result.cohort = await nearEndCohort();
    return result;
}

async function nearEndCohort(): Promise<Census['cohort']> {
    const bytes = await serializedFixture('population-cohort', [
        'src/engine/world/catalog.ts', 'src/engine/world/seeding.ts', 'src/engine/world/driver.ts'
    ], { seed: SEED, census: 'near-end-v7' }, async () => {
        const state = seedWorld({ seed: SEED, catalog: await loadCultivationCatalog() }).state;
        const start = state.currentDay;
        const nearEnd = new Map(state.npcs.filter(n => n.status === 'alive'
            && n.cultivation.lifespanEndsOnDay - start <= 14 * 365)
            .map(n => [n.id, { end: n.cultivation.lifespanEndsOnDay }]));
        const attempted = new Set<string>();
        const succeeded = new Set<string>();
        const recordedAttempted = new Set<string>();
        const recordedSucceeded = new Set<string>();
        const stampedSucceeded = new Set<string>();
        const derivedAttempted = new Set<string>();
        const derivedSucceeded = new Set<string>();
        const wallAttempted = new Set<string>();
        const wallSucceeded = new Set<string>();
        const extended = new Set<string>();
        const dead = new Set<string>();
        // Year-end cleanup can remove a crossing before the driver returns it.
        const stamping = vi.spyOn(npcState, 'setRealm');
        const recording = vi.spyOn(crossings, 'recordCrossing');
        const derive = seeding.deriveOrdinal;
        let reviewing = new Map(state.npcs.map(n => [n.cultivation.attributes, n]));
        const derivation = vi.spyOn(seeding, 'deriveOrdinal').mockImplementation((...args) => {
            const npc = reviewing.get(args[1]);
            if (!npc || !nearEnd.has(npc.id)) return derive(...args);
            const opts = args[6] ?? {};
            args[6] = { ...opts, onAttempt: trial => {
                opts.onAttempt?.(trial);
                // Earlier rungs are a replay of their life, not a new attempt.
                if (trial.ordinal < npc.cultivation.realmOrdinal) return;
                attempted.add(npc.id);
                derivedAttempted.add(npc.id);
                if (trial.crossed) {
                    succeeded.add(npc.id);
                    derivedSucceeded.add(npc.id);
                }
            } };
            return derive(...args);
        });
        try {
            for (let year = 1; year <= 30; year++) {
                reviewing = new Map(state.npcs.map(n => [n.cultivation.attributes, n]));
                const advanced = advanceWorldForPlay(state, { days: 365, stopOnInterrupt: false });
                for (let i = 0; i < stamping.mock.calls.length; i++) {
                    const [npc, ordinal] = stamping.mock.calls[i];
                    if (nearEnd.has(npc.id) && ordinal > npc.cultivation.realmOrdinal
                        && realmForOrdinal(ordinal).key !== realmForOrdinal(npc.cultivation.realmOrdinal).key) {
                        stampedSucceeded.add(npc.id);
                    }
                    const updated = stamping.mock.results[i].value as npcState.NpcRecord;
                    const opening = nearEnd.get(npc.id);
                    if (opening && updated.cultivation.lifespanEndsOnDay > opening.end) extended.add(npc.id);
                }
                for (let i = 0; i < recording.mock.calls.length; i++) {
                    const [, npc, result] = recording.mock.calls[i];
                    if (!nearEnd.has(npc.id)) continue;
                    attempted.add(npc.id);
                    wallAttempted.add(npc.id);
                    if (recording.mock.results[i].value) recordedAttempted.add(npc.id);
                    if (result.outcome === 'success') {
                        succeeded.add(npc.id);
                        wallSucceeded.add(npc.id);
                        if (recording.mock.results[i].value) recordedSucceeded.add(npc.id);
                    }
                    if (result.outcome === 'death') dead.add(npc.id);
                    if (npc.cultivation.lifespanEndsOnDay > nearEnd.get(npc.id)!.end) extended.add(npc.id);
                }
                stamping.mockClear();
                recording.mockClear();
                derivation.mockClear();
                for (const event of advanced.events) {
                    for (const actor of event.actors) {
                        if (!nearEnd.has(actor.id)) continue;
                        if (actor.role === 'deceased') dead.add(actor.id);
                        if (typeof event.data.fromOrdinal === 'number') {
                            attempted.add(actor.id);
                            recordedAttempted.add(actor.id);
                            if (event.data.outcome === 'success') {
                                succeeded.add(actor.id);
                                recordedSucceeded.add(actor.id);
                            }
                        }
                    }
                }
                for (const death of advanced.deaths) if (nearEnd.has(death.deceasedId)) dead.add(death.deceasedId);
                for (const npc of state.npcs) {
                    const opening = nearEnd.get(npc.id);
                    if (!opening) continue;
                    if (isTerminal(npc.status)) dead.add(npc.id);
                    if (npc.cultivation.lifespanEndsOnDay > opening.end) extended.add(npc.id);
                }
            }
        } finally {
            stamping.mockRestore();
            recording.mockRestore();
            derivation.mockRestore();
        }
        const statuses: Record<string, number> = {};
        const remaining = new Map(state.npcs.map(n => [n.id, n.status]));
        for (const id of nearEnd.keys()) {
            const status = remaining.get(id) ?? (dead.has(id) ? 'physically_dead' : 'not_held');
            statuses[status] = (statuses[status] ?? 0) + 1;
        }
        return Buffer.from(JSON.stringify({
            size: nearEnd.size, attempted: attempted.size, succeeded: succeeded.size,
            recordedAttempted: recordedAttempted.size, recordedSucceeded: recordedSucceeded.size,
            stampedSucceeded: stampedSucceeded.size,
            derivedAttempted: derivedAttempted.size, derivedSucceeded: derivedSucceeded.size,
            wallAttempted: wallAttempted.size, wallSucceeded: wallSucceeded.size,
            extended: extended.size, died: dead.size,
            diedWithoutAttempting: [...dead].filter(id => !attempted.has(id)).length,
            alive: state.npcs.filter(n => nearEnd.has(n.id) && n.status === 'alive').length,
            statuses
        }));
    });
    return JSON.parse(bytes.toString('utf8')) as Census['cohort'];
}

let measured: Promise<Census> | undefined;
const measuredCensus = () => measured ??= census();
const collectingControl = () => process.env.POPULATION_ARM === 'before'
    && process.env.POPULATION_ASSERT_CONTROL !== '1';

it('reaches the arranged local-replacement situation in sampled lived worlds', async () => {
    for (const [seed, years] of [[SEED, 100], [SEED, 500], ['demography', 100]] as const) {
        const world = await sampledWorld(seed, { years });
        const present = new Map<string, number>();
        for (const person of world.npcs) if (person.status === 'alive' && person.locationId) {
            present.set(person.locationId, (present.get(person.locationId) ?? 0) + 1);
        }
        const settlements = world.locations.filter(place => place.kind === 'settlement' && populationWeightOf(place) > 0);
        const full = settlements.filter(place => (present.get(place.id) ?? 0) >= populationWeightOf(place));
        const vacant = settlements.filter(place => (present.get(place.id) ?? 0) < populationWeightOf(place));
        expect(full.some(a => vacant.some(b => hasLocalReplacementSituation(world, a.id, b.id))),
            `${seed} at ${years} years has the same replacement precondition`).toBe(true);
    }
}, 3_600_000);

it('passes a real local replacement situation into the same birth scenario', async () => {
    const world = await sampledWorld(SEED, { years: 100 });
    const settlements = world.locations.filter(place => place.kind === 'settlement' && populationWeightOf(place) > 0);
    for (const full of settlements) for (const vacant of settlements) {
        if (!hasLocalReplacementSituation(world, full.id, vacant.id)) continue;
        localVacanciesCanReplaceResidents(world, full.id, vacant.id);
        return;
    }
    throw new Error('No reachable local replacement situation');
}, 120_000);

it('keeps the early old-age cohort without a single-year spike', async () => {
    const result = await measuredCensus();
    console.log(`[population-census] ${process.env.POPULATION_ARM ?? 'live'} ${JSON.stringify(result)}`);
    const count = (realm: string) => result.pyramid[realm] ?? 0;
    const bottom = count('qi_condensation') + count('foundation_establishment') + count('core_formation');
    const middle = count('nascent_soul') + count('deity_transformation') + count('void_tribulation');
    const top = Object.values(result.pyramid).reduce((sum, n) => sum + n, 0) - bottom - middle;
    expect(count('foundation_establishment')).toBeLessThan(count('qi_condensation'));
    expect(middle).toBeLessThan(bottom);
    expect(top).toBeLessThan(middle);
    if (collectingControl()) return;
    // The cohort should remain visible, but no single year should hold it all.
    expect(Math.max(...result.deaths)).toBeLessThanOrEqual(40);
    expect(result.deaths.reduce((sum, n) => sum + n, 0)).toBeGreaterThanOrEqual(180);
    // The 8210cf97 census measured 318 distinct deaths, 317 from the opening
    // roster and one later-modelled, all on their pre-advance deadline.
    // That merged-world total exceeds the earlier 216/235 measurements;
    // 350 leaves about 10% headroom over 318. Keep the 40-death annual guard,
    // the 180 floor and the year 10-14 cohort check unchanged.
    expect(result.deaths.reduce((sum, n) => sum + n, 0)).toBeLessThanOrEqual(350);
    expect(result.deaths.slice(10, 15).reduce((sum, n) => sum + n, 0)).toBeGreaterThanOrEqual(50);
}, 3_600_000);

it('retains settlement populations in measured century bands', async () => {
    const result = await measuredCensus();
    if (collectingControl()) return;
    for (const year of [100, 500]) {
        for (const [kind, low, high] of [['village', 5, 16], ['market_town', 4, 32]] as const) {
            const row = result.marks[year][kind];
            expect(row.volume / row.places, `${kind} at ${year} years`).toBeGreaterThanOrEqual(low);
            expect(row.volume / row.places, `${kind} at ${year} years`).toBeLessThanOrEqual(high);
        }
    }
    for (const kind of ['village', 'market_town']) {
        const ratio = result.marks[500][kind].volume / result.marks[100][kind].volume;
        expect(ratio, `${kind} retains its century population`).toBeGreaterThanOrEqual(0.75);
        expect(ratio, `${kind} does not grow without bound`).toBeLessThanOrEqual(1.33);
    }
    const townPopulation = (year: number) => {
        const towns = ['market_town', 'sect_town', 'gate_town'].map(k => result.marks[year][k]);
        return towns.reduce((sum, row) => sum + row.volume, 0) / towns.reduce((sum, row) => sum + row.places, 0);
    };
    for (const year of [100, 500]) {
        expect(townPopulation(year), `towns at ${year} years`).toBeGreaterThanOrEqual(8);
        expect(townPopulation(year), `towns at ${year} years`).toBeLessThanOrEqual(28);
    }
    expect(townPopulation(500) / townPopulation(100)).toBeGreaterThanOrEqual(0.75);
    expect(townPopulation(500) / townPopulation(100)).toBeLessThanOrEqual(1.33);
    expect(result.recruits).toBeGreaterThan(0);
}, 3_600_000);

it('prices a far town from the capital in days', async () => {
    const state = seedWorld({ seed: SEED, catalog: await loadCultivationCatalog() }).state;
    const capital = state.locations.find(l => l.tags.includes('city'))!;
    const reach = walkingDaysFrom(state.locations, capital.id);
    const towns = state.locations.filter(l => l.kind === 'settlement' && l.id !== capital.id && l.parentId === capital.parentId);
    const far = Math.max(...towns.map(t => reach.get(t.id) ?? 0));
    console.log(`[capital-distance] ${capital.name}: ${far}`);
    if (collectingControl()) return;
    expect(far).toBeGreaterThan(0);
});

it('holds the whole population and house grounds in century bands', async () => {
    const result = await measuredCensus();
    if (collectingControl()) return;
    const volume = (year: number) => Object.values(result.marks[year]).reduce((sum, r) => sum + r.volume, 0);
    for (const year of [200, 300, 400, 500]) {
        expect(volume(year) / volume(100), `population at ${year}`).toBeGreaterThanOrEqual(0.75);
        expect(volume(year) / volume(100), `population at ${year}`).toBeLessThanOrEqual(1.3);
        const seats = result.marks[year].sect_seat;
        expect(seats.volume / seats.places, `house grounds at ${year}`).toBeGreaterThanOrEqual(8);
        expect(seats.volume / seats.places, `house grounds at ${year}`).toBeLessThanOrEqual(24);
    }
}, 3_600_000);
