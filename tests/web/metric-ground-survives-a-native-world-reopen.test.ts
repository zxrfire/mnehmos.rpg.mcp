/**
 * Foundation02's native run loaded neither the saved-world upgrade nor the
 * played world driver. Its 66/67 controls therefore did not prove those hooks.
 * These operator-arranged legacy rows remove only metric columns before a real
 * SQLite save/reopen; they do not alter roads, names, ages or memberships.
 * The driver control adds real new ground at an actual committed boundary and
 * checks that a subsequent native boundary supplies its once-persisted point.
 * Root sequential native execution is pending; these are not model acceptance.
 */
import { describe, expect, it } from 'vitest';
import { makeGame } from './harness.js';
import { createWorld as createStoredWorld, activeWorld, resetCultivationWorlds }
    from '../../src/server/state/cultivation-world.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { createWorld } from '../../src/engine/world/world-state.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';
import { metricGroundRead } from '../../src/engine/world/the-metric-ground-under-a-journey.js';

describe('actual saved and advancing worlds retain physical geometry', () => {
    it('creates, upgrades old rows once, and persists the same points without changing roads', async () => {
        const h = makeGame({ worldEnabled: true });
        try {
            await createStoredWorld({ seed: 'metric-native-save-reopen-20261007', population: 12, presentYear: 0 });
            const original = (await activeWorld()).state;
            const actualExterior = original.locations.find(p => p.data.catalogRegionId && metricGroundRead(original.locations).point(p.id));
            if (!actualExterior) throw new Error('Native catalog world lacks an authored exterior');
            const originalPoint = metricGroundRead(original.locations).point(actualExterior.id);
            const roads = original.locations.map(p => [p.id, p.links.map(link => ({ ...link }))]);
            for (const place of original.locations) {
                delete place.data.metricXLi; delete place.data.metricYLi; delete place.data.metricExtentLi;
            }
            new WorldStateRepository(h.db).saveWorld(original);
            resetCultivationWorlds();
            const upgraded = (await activeWorld()).state;
            expect(metricGroundRead(upgraded.locations).point(actualExterior.id)).toEqual(originalPoint);
            expect(upgraded.locations.map(p => [p.id, p.links.map(link => ({ ...link }))])).toEqual(roads);
            const columns = upgraded.locations.map(p => [p.id, p.data.metricXLi, p.data.metricYLi, p.data.metricExtentLi]);
            resetCultivationWorlds();
            const reopened = (await activeWorld()).state;
            expect(reopened.locations.map(p => [p.id, p.data.metricXLi, p.data.metricYLi, p.data.metricExtentLi])).toEqual(columns);
            expect(metricGroundRead(new WorldStateRepository(h.db).loadWorld(reopened.id)!.locations)
                .point(actualExterior.id)).toEqual(originalPoint);
        } finally { resetCultivationWorlds(); h.db.close(); }
    });

    it('gives independent new ground a point at the next actual world boundary', () => {
        const world = createWorld({ seed: 'metric-native-boundary-20261007', skipPriorAges: true, regionCount: 0, presentYear: 0 });
        const parent = makeLocation({ id: 'actual-metric-parent', name: 'Test exterior', kind: 'wilds',
            data: { metricXLi: 11, metricYLi: 17, metricExtentLi: 3 } });
        world.locations.push(parent);
        const added = makeLocation({ id: 'actual-new-ground', name: 'New test ground', kind: 'wilds', parentId: parent.id });
        const started = world.currentDay;
        let inserted = false;
        advanceWorldForPlay(world, { days: 2, preciseDays: true, stopOnInterrupt: false,
            passageDates: [started + 1], pressure: { intensity: 0 }, atWorldBoundary: current => {
                if (!inserted) { current.locations.push(added); inserted = true; }
            } });
        expect(inserted).toBe(true);
        expect(world.currentDay).toBe(started + 2);
        const point = metricGroundRead(world.locations).point(added.id);
        if (!point) throw new Error('Native next boundary left actual new ground without geometry');
        expect(Math.hypot(point.xLi - 11, point.yLi - 17)).toBeLessThanOrEqual(3);
        const stored = { ...point };
        advanceWorldForPlay(world, { days: .125, preciseDays: true, stopOnInterrupt: false, pressure: { intensity: 0 } });
        expect(metricGroundRead(world.locations).point(added.id)).toEqual(stored);
    });
});
