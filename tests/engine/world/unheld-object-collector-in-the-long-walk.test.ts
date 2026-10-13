/**
 * The owner requires a measured cost comparison before retaining collection.
 * Both arms live in one process and start from copies of the same untouched
 * drift-guard catalog world. Alternate each year's order to limit warm-up/order
 * effects. The original collector is disabled only for the control world; no
 * source file, expectation or other worker's change is restored as a control.
 * This measures a 150-year portion of the canonical seed, not its 1500-year gate.
 */
import { expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { cloneWorld } from '../../../src/engine/world/world-state.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import * as collector from '../../../src/engine/world/an-unheld-cheap-object-is-forgotten.js';
import { fixtureSourceHash } from '../../support/serialized-fixture.js';

it.skipIf(process.env.W05_COLLECTOR_BENCH !== '1')('compares actual object counts and yearly cost in paired long walks', async () => {
    const initial = seedWorld({ seed: 'drift-guard', catalog: await loadCultivationCatalog() }).state;
    const without = cloneWorld(initial), withCollection = cloneWorld(initial);
    const rows: { year: number; without: { objects: number; milliseconds: number };
        withCollection: { objects: number; milliseconds: number }; deleted: number; collectorMilliseconds: number }[] = [];
    const original = collector.collectUnheldCheapObjects;
    let deleted = 0, collectorMilliseconds = 0;
    const spy = vi.spyOn(collector, 'collectUnheldCheapObjects').mockImplementation((state, protectedIds) => {
        if (state === without) return 0;
        const began = performance.now(), removed = original(state, protectedIds);
        collectorMilliseconds += performance.now() - began; deleted += removed;
        return removed;
    });
    const source = fixtureSourceHash(['src/engine/world/driver.ts', 'src/engine/world/seeding.ts']);
    try {
        for (let year = 1; year <= 150; year++) {
            const measured = new Map<object, { objects: number; milliseconds: number }>();
            for (const state of year % 2 ? [without, withCollection] : [withCollection, without]) {
                const began = performance.now();
                advanceWorldForPlay(state, { days: 365 });
                measured.set(state, { objects: state.objects.length, milliseconds: performance.now() - began });
            }
            rows.push({ year, without: measured.get(without)!, withCollection: measured.get(withCollection)!, deleted, collectorMilliseconds });
            if (year % 25 === 0) console.log(`Collector paired walk: ${year}/150 years; objects ${without.objects.length}/${withCollection.objects.length}; deleted ${deleted}.`);
        }
    } finally { spy.mockRestore(); }
    const total = (key: 'without' | 'withCollection') => rows.reduce((total, row) => total + row[key].milliseconds, 0);
    const report = { seed: initial.seed, source, years: rows.length, floorStones: collector.CHEAP_UNHELD_VALUE,
        initialObjects: initial.objects.length, withoutMilliseconds: total('without'), withCollectionMilliseconds: total('withCollection'),
        withoutMillisecondsPerYear: total('without') / rows.length, withCollectionMillisecondsPerYear: total('withCollection') / rows.length,
        collectorMilliseconds, deleted, finalObjectsWithout: without.objects.length, finalObjectsWith: withCollection.objects.length, rows };
    writeFileSync('.claude/w05-long-walk-paired.json', JSON.stringify(report, null, 2));
    expect(rows).toHaveLength(150);
    expect(withCollection.objects.length).toBeLessThanOrEqual(without.objects.length);
}, 3_600_000);
