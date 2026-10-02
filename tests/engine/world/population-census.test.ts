/**
 * Census seed area-occupancy-census-2026-10-01 exposed a 93-death tenth year
 * and villages draining from 10.9 to 1.9 people per place over 500 years.
 * The owner retained the early cohort: its unchanged lifespan cap is spread
 * only 0–4 years, and its ordinary advancement is observed, never forced.
 * The paired control on this checkout had 235 old-age deaths in thirty years,
 * 90 in year ten. The bands retain that cohort without retaining the spike.
 * The first repair had 216 old-age deaths, maximum 25 in a year; villages
 * averaged 6.9/7.1 and towns 13.9/14.6 people at years 100/500.
 * It also grew house grounds to 49.3 people per place: outside intake and
 * birth placement bypassed the catalog roll limit, while a global shortfall
 * could keep producing births after local vacancies were filled.
 * Capacity-bound intake and replacement now give villages 9.4/8.3, towns
 * 19.1/19.1 and house grounds 10.6/12.6 people at years 100/500. Living
 * population stays at 1669–1794 from year 100 onward, against 2810–2886
 * over the control's last two centuries. Both source arms ran in one command.
 * The 0–40 yearly band rejects
 * the original spike; the century ratios reject ongoing drain or growth.
 * Annual membership censuses count entries and exits separately; a round trip
 * between censuses is not counted. The paired probe runs both source arms in
 * one command, including the five-seed pyramid acceptance test.
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
    marks: Record<string, Record<string, Bucket>>;
    pyramid: Record<string, number>;
    recruits: number;
    centuries: Record<string, { births: number; entrants: number; deaths: number; otherExits: number }>;
    cost400: { living: number; rows: number; milliseconds: number[] };
    cohort: { size: number; attempted: number; succeeded: number; extended: number;
        recordedAttempted: number; recordedSucceeded: number; stampedSucceeded: number;
        derivedAttempted: number; derivedSucceeded: number;
        wallAttempted: number; wallSucceeded: number;
        died: number; diedWithoutAttempting: number; alive: number; statuses: Record<string, number> };
}

async function census(): Promise<Census> {
    const bytes = await serializedFixture('population-census', [
        'src/engine/world/catalog.ts', 'src/engine/world/seeding.ts', 'src/engine/world/driver.ts'
    ], { seed: SEED, census: 'bounded-annual-v2' }, async () => {
        const state = seedWorld({ seed: SEED, catalog: await loadCultivationCatalog() }).state;
        const start = state.currentDay;
        const deaths = Array<number>(31).fill(0);
        const marks: Census['marks'] = {};
        const flows = new Map<string, { inflow: number; outflow: number }>();
        const seeded = new Set(state.npcs.map(n => n.id));
        const centuries: Census['centuries'] = {};
        const cost400: Census['cost400'] = { living: 0, rows: 0, milliseconds: [] };
        const membership = () => {
            const places = new Map(state.locations.map(l => [l.id, kind(l)]));
            return new Map(state.npcs.filter(n => n.status === 'alive').map(n => [n.id, places.get(n.locationId ?? '') ?? 'nowhere']));
        };
        const record = (year: number) => {
            const rows: Record<string, Bucket> = {};
            for (const place of state.locations) {
                const k = kind(place);
                rows[k] ??= { places: 0, volume: 0, inflow: flows.get(k)?.inflow ?? 0, outflow: flows.get(k)?.outflow ?? 0 };
                rows[k].places++;
            }
            for (const k of membership().values()) {
                rows[k] ??= { places: 0, volume: 0, inflow: flows.get(k)?.inflow ?? 0, outflow: flows.get(k)?.outflow ?? 0 };
                rows[k].volume++;
            }
            marks[year] = rows;
        };
        let previous = membership();
        record(0);
        for (let year = 1; year <= 500; year++) {
            if (year === 401) {
                cost400.living = previous.size;
                cost400.rows = state.npcs.length;
            }
            const started = performance.now();
            const advanced = advanceWorldForPlay(state, { days: 365, stopOnInterrupt: false });
            if (year >= 401 && year <= 405) cost400.milliseconds.push(performance.now() - started);
            for (const death of advanced.time.deaths) {
                const at = Math.ceil((death.onDay - start) / 365);
                if (at >= 0 && at <= 30) deaths[at]++;
            }
            const next = membership();
            const century = Math.ceil(year / 100);
            const totals = centuries[century] ??= { births: 0, entrants: 0, deaths: 0, otherExits: 0 };
            totals.births += advanced.born;
            totals.entrants += [...next.keys()].filter(id => !previous.has(id)).length;
            const dead = new Set(advanced.deaths.map(d => d.deceasedId));
            const rows = new Map(state.npcs.map(n => [n.id, n]));
            for (const id of previous.keys()) {
                if (next.has(id)) continue;
                const row = rows.get(id);
                if (dead.has(id) || !row || isTerminal(row.status)) totals.deaths++;
                else totals.otherExits++;
            }
            for (const [id, k] of previous) if (next.get(id) !== k) {
                const f = flows.get(k) ?? { inflow: 0, outflow: 0 }; f.outflow++; flows.set(k, f);
            }
            for (const [id, k] of next) if (previous.get(id) !== k) {
                const f = flows.get(k) ?? { inflow: 0, outflow: 0 }; f.inflow++; flows.set(k, f);
            }
            previous = next;
            if (year % 50 === 0) record(year);
            if (year % 25 === 0) process.stdout.write(`[census-progress] ${process.env.POPULATION_ARM ?? 'live'} ${year}\n`);
        }
        const pyramid: Record<string, number> = {};
        for (const n of state.npcs.filter(n => n.status === 'alive')) {
            const k = realmForOrdinal(n.cultivation.realmOrdinal).key;
            pyramid[k] = (pyramid[k] ?? 0) + 1;
        }
        const recruits = state.npcs.filter(n => !seeded.has(n.id) && n.factionId !== null && n.tags.some(t => t.startsWith('region:'))).length;
        return Buffer.from(JSON.stringify({ deaths, marks, pyramid, recruits, centuries, cost400 }));
    });
    const result = JSON.parse(bytes.toString('utf8')) as Census;
    // The age derivation runs trials without writing crossing facts.
    // Observe its forward trials alongside the recorded wall strikes.
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
    expect(result.deaths.reduce((sum, n) => sum + n, 0)).toBeLessThanOrEqual(300);
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
