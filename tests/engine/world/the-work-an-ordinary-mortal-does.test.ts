/**
 * Ordinary resident replacement created lives with occupation unknown. Opening
 * physicians and other workers therefore had no successors, even in a town
 * full of grown mortals. The yearly demography path now asks those actual adult
 * residents to draw eligible catalog work. Identity is the only profession
 * store. Children, cultivators, house members, known workers and concrete
 * activities remain outside that draw. No replacement person is spawned and no
 * clinic is guaranteed to be staffed.
 *
 * The clock case finds an arrangement through the actual assignment reader,
 * bounded to 64 cheap fixture seeds, then advances that world once. It does not
 * reconstruct the occupation weights or rerun whole worlds until one passes.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { ordinaryAdultsTakeWork, ordinaryProfessionOf } from '../../../src/engine/world/the-work-an-ordinary-mortal-does.js';
import { mortalPhysicianJob } from '../../../src/engine/world/who-is-actually-seeing-to-wounds.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';

function town(seed: string) {
    const world = createWorld({ seed, regionCount: 0, skipPriorAges: true });
    world.locations.push(makeLocation({ id: 'region', name: 'Region', kind: 'region',
        data: { localCeilingOrdinal: 0 } }), makeLocation({ id: 'town', name: 'Town', kind: 'settlement',
        parentId: 'region', tags: ['city'], data: { localCeilingOrdinal: 0 } }));
    const person = (id: string, age: number, ordinal = 0) => createNpc(seed, { id, name: id,
        bornOnDay: -age * DAYS_PER_YEAR, onDay: 0, locationId: 'town', cultivation: { realmOrdinal: ordinal } });
    const physician = person('opening-physician', 30);
    physician.identity.occupation = mortalPhysicianJob().name;
    const adult = person('grown-resident', 20);
    const child = person('child', 10);
    const cultivator = person('cultivator', 20, 1);
    world.npcs.push(physician, adult, child, cultivator);
    return { world, physician, adult, child, cultivator };
}

describe('ordinary professions continue through actual grown residents', () => {
    it('preserves known workers and excludes children, cultivators, houses and concrete work', () => {
        const h = town('ordinary-worker-preservation');
        const existing = structuredClone(h.physician);
        h.adult.factionId = 'a-house';
        expect(ordinaryAdultsTakeWork(h.world, 0)).toBe(0);
        expect(h.physician).toEqual(existing);
        expect(h.child.identity.occupation).toBe('unknown');
        expect(h.cultivator.identity.occupation).toBe('unknown');
        h.adult.factionId = null;
        h.adult.activity = { kind: 'the_work_of_their_rank', note: 'A concrete commission.',
            thingId: 'fixture-commission', withIds: [], sinceDay: 0, untilDay: null };
        expect(ordinaryAdultsTakeWork(h.world, 0)).toBe(0);
        expect(h.adult.identity.occupation).toBe('unknown');
    });

    it('reaches a new actual physician through the yearly hook after the opening one dies', () => {
        const seed = Array.from({ length: 64 }, (_, i) => `ordinary-work-${i}`).find(seed => {
            const h = town(seed);
            h.physician.status = 'physically_dead';
            ordinaryAdultsTakeWork(h.world, 180);
            return ordinaryProfessionOf(h.adult)?.id === mortalPhysicianJob().id;
        });
        expect(seed, 'bounded fixture arrangement should find an ordinary doctor draw').toBeDefined();
        const h = town(seed!);
        h.physician.cultivation.lifespanEndsOnDay = 1;
        const ids = new Set(h.world.npcs.map(n => n.id));
        advanceWorldForPlay(h.world, { days: 200, stopOnInterrupt: false });
        const resident = h.world.npcs.find(n => n.id === h.adult.id)!;
        expect(ordinaryProfessionOf(resident)?.id).toBe(mortalPhysicianJob().id);
        expect(h.world.npcs.find(n => n.id === h.physician.id)?.status).not.toBe('alive');
        expect(h.world.npcs.every(n => ids.has(n.id))).toBe(true);
    });
});
