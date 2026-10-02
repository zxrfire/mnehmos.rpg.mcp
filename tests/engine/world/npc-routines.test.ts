/**
 * A street held the same people forever and placement filled areas three at a time.
 * The owner's ruling is an hourly routine, read without advancing every person.
 * These seeded reads cover two days, sleep, sparse occupancy, shared scenes,
 * away activities and immutable, repeatable output.
 * A dated watch stays on duty through its last day, including nightfall.
 * On road-world day 365000, Three Walls (18 living residents) previously had
 * occupied-area counts 1/2/3 = 1/1/5 at all three hours. The new counts are
 * 6/3/2 at 08:00, 7/4/1 at noon and 18/0/0 at 22:00. Both arms were read
 * together from the same seeded world. Ten alternating yearly driver runs
 * after warmup measured medians 275 ms before and 279 ms after, with 860
 * routine reads per year. The budget below detects an hourly population pass.
 */
import { describe, expect, it, vi } from 'vitest';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { seedWorld } from '../../../src/engine/world/seeding';
import { WORLD_POPULATION } from '../../../src/server/state/cultivation-world';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing';
import { npcsStandingIn, whereCompoundsAre } from '../../../src/engine/world/where-inside-a-house-somebody-is-standing';
import * as routines from '../../../src/engine/world/npc-routines';
import { applyPressure } from '../../../src/engine/world/the-world-changing-on-its-own';
import { routineOf } from '../../../src/engine/world/npc-routines';
import { isAwayOnSomething } from '../../../src/engine/world/npc-state';

const seeded = async () => seedWorld({ seed: 'road-world', catalog: await loadCultivationCatalog(), population: WORLD_POPULATION }).state;

describe('people keep daily routines', () => {
    it('changes the street across hours and days, sparsely, with nobody lost or over the ceiling', async () => {
        const world = await seeded();
        const town = world.locations.filter(l => l.kind === 'settlement').sort((a, b) =>
            world.npcs.filter(n => n.locationId === b.id && n.status === 'alive').length
            - world.npcs.filter(n => n.locationId === a.id && n.status === 'alive').length)[0]!;
        const scenes: string[] = [];
        const histogram = [0, 0, 0, 0];
        for (const day of [world.currentDay, world.currentDay + 1]) {
            for (const hour of [8, 12, 22]) {
                const clock = { ...world, currentDay: day, currentHour: hour };
                const before = JSON.stringify(clock.npcs);
                const read = theAreasOf(clock, town);
                const sizes = read.areas.map(area => [...read.whereIs.values()].filter(id => id === area.id).length);
                for (const n of sizes) { expect(n).toBeLessThanOrEqual(3); histogram[n]!++; }
                expect(read.whereIs.size).toBe(npcsStandingIn(clock, town.id).length);
                const streets = read.areas.filter(area => area.for === 'street').map(area => area.id);
                scenes.push([...read.whereIs].filter(([, at]) => streets.includes(at)).map(([id, at]) => `${id}@${at}`).sort().join(','));
                expect(theAreasOf(clock, town)).toEqual(read);
                expect(JSON.stringify(clock.npcs)).toBe(before);
                console.log(`[routine] ${town.name}, day ${day}, hour ${hour}: `
                    + [0, 1, 2, 3].map(n => `${n}:${sizes.filter(size => size === n).length}`).join(' '));
            }
        }
        expect(new Set(scenes).size).toBeGreaterThan(3);
        expect(histogram[1]! + histogram[2]!).toBeGreaterThan(histogram[3]!);
        expect(Math.max(histogram[1]!, histogram[2]!)).toBeGreaterThan(histogram[3]!);
    });

    it('lodges most people at night, using the house quarters that their rung already receives', async () => {
        const world = await seeded();
        world.currentHour = 22;
        const ordinary = world.npcs.filter(n => n.status === 'alive' && n.locationId !== null
            && !n.tags.includes('spirit-beast') && !(n.activity && isAwayOnSomething(n.activity.kind)));
        expect(ordinary.filter(n => routineOf(world, n).home).length).toBeGreaterThan(ordinary.length / 2);
        const compounds = whereCompoundsAre(world);
        let lodged = 0;
        for (const place of world.locations) {
            const read = theAreasOf(world, place, compounds);
            for (const area of read.areas) {
                expect([...read.whereIs.values()].filter(id => id === area.id).length).toBeLessThanOrEqual(3);
            }
            if (place.data.purpose === 'dormitory' || place.data.purpose === 'residence') lodged += read.whereIs.size;
        }
        expect(lodged).toBeGreaterThan(0);
        const traveller = ordinary[0]!;
        const away = { ...traveller, activity: { kind: 'travelling' as const, note: 'walking', withIds: [], sinceDay: world.currentDay } };
        expect(routineOf(world, away).home).toBe(false);
        expect(routineOf(world, away).activity).toEqual(away.activity);
        const watch = { ...traveller, activity: { kind: 'the_work_of_their_rank' as const,
            note: 'on watch at the gate', withIds: [], sinceDay: world.currentDay, untilDay: world.currentDay } };
        expect(routineOf(world, watch).home).toBe(false);
        expect(routineOf(world, watch).activity).toEqual(watch.activity);
    });
    it('advances a year without enumerating everybody at every hour', async () => {
        const world = await seeded();
        const read = vi.spyOn(routines, 'routineOf');
        try {
            const year = applyPressure(world, world.currentDay, world.currentDay + 365);
            expect(year.yearsStepped).toBe(1);
            expect(read.mock.calls.length).toBeLessThan(world.npcs.length * 365);
        } finally {
            read.mockRestore();
        }
    });

});
