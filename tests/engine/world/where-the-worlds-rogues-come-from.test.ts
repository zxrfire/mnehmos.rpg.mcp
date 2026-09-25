/**
 * Where the world's rogues come from, one test per source.
 *
 * `rogues.ts` says the unaffiliated are most of the player's peers, and a seeded
 * world held almost none at Foundation or above. The owner: seed some, and the
 * rest comes naturally - from a house destroyed, a house that fell, somebody
 * thrown out, and somebody on no roll who finds a teacher.
 *
 * RED-CHECKED. A share of zero turns the seeded test red; killing everybody below
 * the line again turns the destroyed test red; clearing `factionId` bare again
 * turns the fell test red; dropping the teacher from the unbacked branch of
 * `newlyEntitled` turns the teacher test red; reading the capability taken as
 * leaving somebody their place turns the expelled test red.
 */
import { describe, it, expect } from 'vitest';

import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { canReproduce, manualCeilingOf, newlyEntitled } from '../../../src/engine/world/manuals.js';
import { PRESSURE_TEMPLATES } from '../../../src/engine/world/the-world-changing-on-its-own.js';

const aPressureTemplate = (kind: string) => PRESSURE_TEMPLATES.find(t => t.kind === kind);
import { standsOnAnUnreachableClock } from '../../../src/engine/world/whether-a-house-is-dying-or-simply-has-few-people.js';
import { aRoomHearsIt } from '../../../src/engine/world/bringing-what-you-know-about-somebody-to-the-room.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import {
    ROGUE_EXPELLED,
    ROGUE_FLED,
    ROGUE_HOUSE_FELL,
    ROGUE_SEEDED
} from '../../../src/engine/world/what-becomes-of-a-houses-people-when-it-is-gone.js';
import { STAYED_WITH } from '../../../src/engine/world/who-goes-down-with-the-house.js';
import { WHERE_A_ROGUE_IS_NOT_SUPPOSED_TO_BE } from '../../../src/engine/world/the-rogues-a-world-opens-with.js';
import { nowhereToStand, insideSomebodysWalls } from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

async function world(seed = 'shape-a'): Promise<WorldState> {
    return seedWorld({ seed, catalog: await loadCultivationCatalog() }).state;
}

describe('the rogues a world opens with', () => {
    it('are cultivators on no roll, below the rung nobody reaches on a book, standing where rogues stand', async () => {
        const state = await world();
        const seeded = state.npcs.filter(n => n.tags.includes(ROGUE_SEEDED));
        expect(seeded.length).toBeGreaterThan(20);
        for (const n of seeded) {
            expect(n.factionId).toBeNull();
            expect(n.cultivation.realmOrdinal).toBeGreaterThanOrEqual(FOUNDATION_ORDINAL);
            expect(n.cultivation.realmOrdinal).toBeLessThan(WHERE_A_ROGUE_IS_NOT_SUPPOSED_TO_BE);
            const place = state.locations.find(l => l.id === n.locationId)!;
            expect(place.kind).not.toBe('sect_seat');
            expect(nowhereToStand(place) || insideSomebodysWalls(place)).toBe(false);
        }
    }, 120_000);
});

describe('a house destroyed', () => {
    it('scatters its people: some fall, and the rest are rogues on the road', async () => {
        const state = await world();
        const count = (id: string) => state.npcs.filter(n => n.factionId === id && n.status === 'alive').length;
        const victim = state.factions.filter(f => f.dissolvedOnDay === null && count(f.id) >= 8)
            .sort((a, b) => count(b.id) - count(a.id))[0]!;
        const aggressor = state.factions.find(f => f.id !== victim.id && f.dissolvedOnDay === null)!;
        // Arranged: at war, and decisively stronger than everybody in the house.
        for (const f of state.factions) f.tags = f.tags.filter(t => t !== 'at_war');
        state.schedule = state.schedule.filter(e => e.data.kind !== 'war_resolution');
        victim.tags.push('at_war');
        aggressor.tags.push('at_war');
        victim.standing[aggressor.id] = -0.9;
        aggressor.standing[victim.id] = -0.9;
        victim.resources.power_ordinal = 5;
        aggressor.resources.power_ordinal = 60;
        state.schedule.push({
            id: 'eff-test-war', kind: 'war_resolution' as never, dueOnDay: state.currentDay + 3650,
            summary: 'A war.', actorIds: [], locationId: null, factionId: null, repeatDays: null,
            interrupts: false, chance: 1, fired: false,
            data: { kind: 'war_resolution', sideA: victim.id, sideB: aggressor.id }
        } as never);
        const members = state.npcs.filter(n => n.factionId === victim.id && n.status === 'alive').map(n => n.id);

        const fired = aPressureTemplate('house_destroyed')!.apply(state, state.currentDay, forStream('rogues', 'destroyed'));
        expect(fired).not.toBeNull();
        const after = members.map(id => state.npcs.find(n => n.id === id)!);
        const fled = after.filter(n => n.status === 'alive' && n.tags.includes(`${ROGUE_FLED}${victim.id}`));
        const fell = after.filter(n => n.status !== 'alive');
        expect(fled.length).toBeGreaterThan(0);
        expect(fell.length).toBeGreaterThan(0);
        for (const n of fled) expect(n.factionId).toBeNull();
    }, 120_000);
});

describe('a house that fell', () => {
    it('lets its people go: the next house takes some and the rest are rogues', async () => {
        const state = await world();
        const count = (id: string) => state.npcs.filter(n => n.factionId === id && n.status === 'alive').length;
        // Not a house with somebody on it who outlasts institutions: such a
        // house never reads as failed, which is that module's own ruling.
        const broke = state.factions.filter(f => f.dissolvedOnDay === null && count(f.id) >= 6
            && !standsOnAnUnreachableClock(state, f.id))
            .sort((a, b) => count(b.id) - count(a.id))[0]!;
        for (const f of state.factions) f.resources.spirit_stones = Math.max(1_000_000, Number(f.resources.spirit_stones ?? 0));
        broke.resources.spirit_stones = 0;
        const members = state.npcs.filter(n => n.factionId === broke.id && n.status === 'alive').map(n => n.id);

        // A house with nobody at all on its books fails too, so fire until it is
        // this one.
        for (let i = 0; i < 60 && broke.dissolvedOnDay === null; i++) {
            aPressureTemplate('faction_fell')!.apply(state, state.currentDay, forStream('rogues', 'fell', i));
        }
        expect(broke.dissolvedOnDay).not.toBeNull();
        const after = members.map(id => state.npcs.find(n => n.id === id)!);
        const rogues = after.filter(n => n.factionId === null);
        expect(rogues.length).toBeGreaterThan(0);
        // Two ways off a fallen roll, not one: the road, and the minority who
        // would not walk away from it and are standing where it stood
        // (`who-goes-down-with-the-house.ts`).
        for (const n of rogues) {
            expect(n.tags.some(t => t === `${ROGUE_HOUSE_FELL}${broke.id}`
                || t === `${STAYED_WITH}${broke.id}`), `${n.id} left the roll and said nothing`)
                .toBe(true);
        }
        expect(rogues.some(n => n.tags.includes(`${ROGUE_HOUSE_FELL}${broke.id}`)),
            'nobody took to the road at all').toBe(true);
        for (const n of after.filter(n => n.factionId !== null)) {
            expect(n.factionId).not.toBe(broke.id);
            expect(n.factionRankIndex).toBe(0);
        }
    }, 120_000);
});

describe('somebody thrown out', () => {
    it('leaves the roll a rogue when the room takes the capability off them', async () => {
        const state = await world();
        const house = state.factions.find(f => f.dissolvedOnDay === null && f.alignment === 'neutral'
            && state.npcs.filter(n => n.factionId === f.id && n.status === 'alive').length >= 6)!;
        const roll = state.npcs.filter(n => n.factionId === house.id && n.status === 'alive')
            .sort((a, b) => a.factionRankIndex - b.factionRankIndex);
        const seeker = roll[0]!;
        const holder = roll[Math.floor(roll.length / 2)]!;
        const victim = state.npcs.find(n => n.status === 'alive' && n.factionId !== house.id)!;
        const fact = appendWorldFact(state, makeFact({
            day: state.currentDay, kind: 'grudge_opened', scale: 'personal',
            summary: `${holder.name} killed ${victim.name}.`,
            actors: [{ id: holder.id, name: holder.name, role: 'killer' }, { id: victim.id, name: victim.name, role: 'victim' }],
            locationId: null, factionIds: [], visibility: 'regional', magnitude: 0.45,
            data: { deedWeight: 'unforgivable' }
        }));
        for (const id of [seeker.id, holder.id]) {
            const at = state.npcs.findIndex(n => n.id === id);
            if (!state.npcs[at]!.historyFactIds.includes(fact.id)) {
                state.npcs[at] = { ...state.npcs[at]!, historyFactIds: [...state.npcs[at]!.historyFactIds, fact.id] };
            }
        }
        const heard = aRoomHearsIt(state, house, state.npcs.find(n => n.id === seeker.id)!, state.npcs.find(n => n.id === holder.id)!,
            { fact, severity: 'unforgivable' }, state.currentDay);
        expect(heard?.place).toBe('expelled');
        const after = state.npcs.find(n => n.id === holder.id)!;
        expect(after.factionId).toBeNull();
        expect(after.tags).toContain(`${ROGUE_EXPELLED}${house.id}`);
    }, 120_000);
});

describe('somebody on no roll with a teacher', () => {
    it('is carried over a gap by whoever is teaching them, house or no house', async () => {
        const state = await world();
        const student = state.npcs.find(n => n.factionId === null && n.status === 'alive'
            && n.cultivation.realmOrdinal >= FOUNDATION_ORDINAL && n.locationId !== null)!;
        const reach = Math.max(student.cultivation.realmOrdinal, manualCeilingOf(student));
        const art = TECHNIQUES.find(t => t.cap != null && Number(t.cap) > reach + 4 && !t.element)!;
        expect(art).toBeDefined();
        const teacher = state.npcs.find(n => n.id !== student.id && n.status === 'alive' && n.cultivation.realmOrdinal >= 40)!;
        const at = state.npcs.indexOf(teacher);
        state.npcs[at] = {
            ...teacher,
            factionId: null,
            locationId: student.locationId,
            cultivation: { ...teacher.cultivation, techniqueIds: [art.id] },
            activity: { kind: 'teaching', note: 'Teaching.', withIds: [student.id], sinceDay: state.currentDay, untilDay: state.currentDay + 30, returnTo: null }
        };
        expect(canReproduce(state.npcs[at]!, art.id)).toBe(true);
        const [lesson] = newlyEntitled(state, student, state.currentDay);
        expect(lesson?.techniqueId).toBe(art.id);
        expect(lesson?.teacherId).toBe(teacher.id);
    }, 120_000);
});
